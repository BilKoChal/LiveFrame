/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileEntry,
  FileType,
  FileId,
  ProjectId,
  TreeNode,
  FlatTreeNode,
} from '../types/project';

/**
 * VirtualFileSystem — Utility class for querying and building tree structures
 * from the flat file map stored in projectStore.
 *
 * The VFS does NOT own state. It receives the files Record as input and
 * produces derived data (trees, directory lists, etc.) on demand.
 * This avoids duplicating state and keeps Zustand as the single source of truth.
 */
export class VirtualFileSystem {
  // ─── Tree Building ──────────────────────────────────────────

  /**
   * Build a hierarchical TreeNode from a flat Record<FileId, FileEntry>.
   * Directories are sorted before files, and items are sorted alphabetically.
   */
  buildTree(files: Record<FileId, FileEntry>, projectId: ProjectId): TreeNode {
    const root: TreeNode = {
      id: 'root',
      name: projectId,
      type: 'directory',
      children: [],
    };

    const projectFiles = Object.values(files).filter(
      (f) => f.projectId === projectId
    );

    for (const file of projectFiles) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          current.children.push({
            id: file.id,
            name: part,
            type: 'file',
            fileType: file.type,
            isDirty: file.isDirty,
            fileId: file.id,
            children: [],
          });
        } else {
          let dir = current.children.find(
            (c) => c.type === 'directory' && c.name === part
          );
          if (!dir) {
            dir = {
              id: `dir:${parts.slice(0, i + 1).join('/')}`,
              name: part,
              type: 'directory',
              children: [],
            };
            current.children.push(dir);
          }
          current = dir;
        }
      }
    }

    // Sort: directories first, then files, alphabetical within each group
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    };
    sortChildren(root);

    return root;
  }

  /**
   * Flatten a TreeNode into a FlatTreeNode[] for virtualized rendering.
   * Only expanded directories and their children are included.
   */
  flattenTree(
    tree: TreeNode,
    expandedDirs: Set<string>
  ): FlatTreeNode[] {
    const result: FlatTreeNode[] = [];

    const walk = (node: TreeNode, depth: number, parentPath: string) => {
      const currentPath =
        parentPath ? `${parentPath}/${node.name}` : node.name;

      if (node.type === 'file') {
        result.push({
          id: node.fileId ?? node.id,
          name: node.name,
          type: 'file',
          depth,
          fileId: node.fileId,
          fileType: node.fileType,
          isDirty: node.isDirty,
          path: currentPath,
        });
      } else {
        // Directory node
        const dirId = node.id;
        const isExpanded = expandedDirs.has(dirId);

        result.push({
          id: dirId,
          name: node.name,
          type: 'directory',
          depth,
          isExpanded,
          path: currentPath,
        });

        if (isExpanded) {
          for (const child of node.children) {
            walk(child, depth + 1, currentPath);
          }
        }
      }
    };

    // Walk root's children (skip the root node itself)
    for (const child of tree.children) {
      walk(child, 0, '');
    }

    return result;
  }

  // ─── Path Utilities ─────────────────────────────────────────

  /** Get all files in a specific directory (non-recursive) */
  getFilesInDirectory(
    files: Record<FileId, FileEntry>,
    projectId: ProjectId,
    dirPath: string
  ): FileEntry[] {
    const result: FileEntry[] = [];

    for (const file of Object.values(files)) {
      if (file.projectId !== projectId) continue;

      const parentDir = file.path.includes('/')
        ? file.path.substring(0, file.path.lastIndexOf('/'))
        : '';

      if (parentDir === dirPath) {
        result.push(file);
      }
    }

    return result;
  }

  /** Get all subdirectory paths at a given level */
  getSubdirectories(
    files: Record<FileId, FileEntry>,
    projectId: ProjectId,
    parentPath: string
  ): string[] {
    const dirs = new Set<string>();
    const prefix = parentPath ? parentPath + '/' : '';

    for (const file of Object.values(files)) {
      if (file.projectId !== projectId) continue;
      if (!file.path.startsWith(prefix)) continue;

      const remainder = file.path.substring(prefix.length);
      const slashIndex = remainder.indexOf('/');

      if (slashIndex !== -1) {
        const dirName = remainder.substring(0, slashIndex);
        const fullPath = prefix + dirName;
        dirs.add(fullPath);
      }
    }

    return Array.from(dirs).sort();
  }

  /** Check if a path already exists in the project */
  pathExists(
    files: Record<FileId, FileEntry>,
    projectId: ProjectId,
    path: string
  ): boolean {
    return Object.values(files).some(
      (f) => f.projectId === projectId && f.path === path
    );
  }

  /** Generate a unique path for a new file (avoids collisions) */
  generateUniquePath(
    files: Record<FileId, FileEntry>,
    projectId: ProjectId,
    basePath: string,
    extension: string
  ): string {
    let path = `${basePath}.${extension}`;
    let counter = 1;

    while (this.pathExists(files, projectId, path)) {
      path = `${basePath}-${counter}.${extension}`;
      counter++;
    }

    return path;
  }

  /** Get the file extension from a filename */
  getExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf('.');
    return dotIndex === -1 ? '' : filename.substring(dotIndex + 1).toLowerCase();
  }

  /** Get directory path from a full file path */
  getDirectoryPath(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash === -1 ? '' : filePath.substring(0, lastSlash);
  }
}

/** Singleton instance */
export const vfs = new VirtualFileSystem();
