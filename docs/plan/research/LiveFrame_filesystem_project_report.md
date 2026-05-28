# LiveFrame: File System & Project Mode Design Report

> **Sub-agent**: File System & Project Mode Designer  
> **Date**: 2026-03-05  
> **Project**: LiveFrame — Browser-based HTML/CSS/JS Code Editor  
> **Stack**: React + Vite + TypeScript + Tailwind CSS + CodeMirror 6 + Zustand + shadcn/ui

---

## Table of Contents

1. [Data Model Design](#1-data-model-design)
2. [Zustand Store Design](#2-zustand-store-design)
3. [In-Memory Virtual File System](#3-in-memory-virtual-file-system)
4. [IndexedDB Persistence](#4-indexeddb-persistence)
5. [File Tree UI](#5-file-tree-ui)
6. [Single-File vs Project Mode Switching](#6-single-file-vs-project-mode-switching)
7. [ZIP Export](#7-zip-export)
8. [External Resources](#8-external-resources)
9. [Starter Templates](#9-starter-templates)
10. [Undo/Redo & History](#10-undoredo--history)

---

## 1. Data Model Design

### Core Type Definitions

The data model is the foundation of LiveFrame's file system. It must cleanly represent both the simplicity of single-file mode (three tabs: HTML, CSS, JS) and the complexity of a full multi-file project tree. The design uses a **flat map with path-based keys** rather than a nested tree structure for the runtime store — this dramatically simplifies state updates in Zustand and avoids deep-cloning issues. The tree structure is derived on-the-fly for the UI layer.

```typescript
// ─── Identifiers ───────────────────────────────────────────

/** NanoID-based unique identifiers for projects and files */
type ProjectId = string & { readonly __brand: unique symbol };
type FileId = string & { readonly __brand: unique symbol };

/** File type discriminator for the three core web languages */
type FileType = 'html' | 'css' | 'javascript' | 'json' | 'markdown' | 'text' | 'image' | 'other';

/** Editor mode — determines which UI shell to render */
type EditorMode = 'single-file' | 'project';

// ─── File Entry ────────────────────────────────────────────

interface FileEntry {
  /** Unique file identifier (NanoID) */
  id: FileId;
  /** Project this file belongs to */
  projectId: ProjectId;
  /** Full path relative to project root, e.g. "src/components/App.tsx" */
  path: string;
  /** File name with extension, e.g. "App.tsx" */
  name: string;
  /** File type derived from extension */
  type: FileType;
  /** Text content of the file (null for binary/image files) */
  content: string | null;
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last modification */
  updatedAt: string;
  /** Whether the file has unsaved changes */
  isDirty: boolean;
  /** Whether this is a virtual file (single-file mode internal) */
  isVirtual: boolean;
}

// ─── Directory Entry (virtual, not persisted) ──────────────

interface DirectoryNode {
  /** Full path of this directory, e.g. "src/components" */
  path: string;
  /** Directory name, e.g. "components" */
  name: string;
  /** Child file IDs */
  fileIds: FileId[];
  /** Child directory paths */
  childDirectories: string[];
}

// ─── External Resource ─────────────────────────────────────

interface ExternalResource {
  id: string;
  /** 'css' for <link> or 'javascript' for <script> */
  type: 'css' | 'javascript';
  /** Full URL to the resource */
  url: string;
  /** Display label (auto-extracted from URL or user-provided) */
  label: string;
  /** Loading strategy */
  placement: 'head' | 'body';
}

// ─── Project ───────────────────────────────────────────────

interface Project {
  /** Unique project identifier */
  id: ProjectId;
  /** Human-readable project name */
  name: string;
  /** Editor mode */
  mode: EditorMode;
  /** IDs of files belonging to this project */
  fileIds: FileId[];
  /** External CSS/JS resources */
  externalResources: ExternalResource[];
  /** ISO 8601 timestamp of creation */
  createdAt: string;
  /** ISO 8601 timestamp of last modification */
  updatedAt: string;
  /** Which file is currently open in the editor */
  activeFileId: FileId | null;
  /** Template used to create this project (if any) */
  templateId: string | null;
  /** Preview settings */
  previewSettings: PreviewSettings;
}

interface PreviewSettings {
  /** Auto-refresh preview on code change */
  autoRefresh: boolean;
  /** Debounce delay in ms before refreshing */
  refreshDebounceMs: number;
  /** Preview viewport size preset */
  viewport: 'desktop' | 'tablet' | 'mobile' | 'custom';
  /** Custom viewport dimensions */
  customViewport?: { width: number; height: number };
}

// ─── Workspace ─────────────────────────────────────────────

interface Workspace {
  /** Currently active project */
  activeProjectId: ProjectId | null;
  /** All project IDs in the workspace */
  projectIds: ProjectId[];
  /** Global editor settings */
  settings: WorkspaceSettings;
  /** Recently opened project IDs (max 10) */
  recentProjectIds: ProjectId[];
}

interface WorkspaceSettings {
  /** Editor theme */
  theme: 'light' | 'dark' | 'system';
  /** Font size in px */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Tab size */
  tabSize: number;
  /** Word wrap */
  wordWrap: boolean;
  /** Auto-save interval in ms (0 = disabled) */
  autoSaveIntervalMs: number;
  /** Default editor mode for new projects */
  defaultMode: EditorMode;
}
```

### Single-File Mode as Virtual Project

Single-file mode is internally represented as a **virtual project** with exactly three files at the root level. This means the same data model and store logic serves both modes, with zero conditional branching in the core file-management code. The only difference is how the UI renders the file list: as three tabs instead of a tree.

```typescript
/** Creates the default single-file virtual project */
function createSingleFileProject(name: string = 'Untitled'): Project {
  const projectId = nanoid() as ProjectId;
  
  const htmlFile: FileEntry = {
    id: nanoid() as FileId,
    projectId,
    path: 'index.html',
    name: 'index.html',
    type: 'html',
    content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello, LiveFrame!</h1>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    isVirtual: true,
  };

  const cssFile: FileEntry = {
    id: nanoid() as FileId,
    projectId,
    path: 'style.css',
    name: 'style.css',
    type: 'css',
    content: `body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    isVirtual: true,
  };

  const jsFile: FileEntry = {
    id: nanoid() as FileId,
    projectId,
    path: 'script.js',
    name: 'script.js',
    type: 'javascript',
    content: `// Your JavaScript code here\nconsole.log('Hello from LiveFrame!');\n`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    isVirtual: true,
  };

  return {
    id: projectId,
    name,
    mode: 'single-file',
    fileIds: [htmlFile.id, cssFile.id, jsFile.id],
    externalResources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeFileId: htmlFile.id,
    templateId: null,
    previewSettings: {
      autoRefresh: true,
      refreshDebounceMs: 300,
      viewport: 'desktop',
    },
  };
}
```

The key insight is that `isVirtual: true` marks these as single-file-mode internal files. When the user switches to project mode, these virtual files are **promoted** to real files (their `isVirtual` flag is cleared), and the project's `mode` is changed. This avoids data loss during transitions.

### Path Convention

File paths follow POSIX conventions but are always relative to the project root:

- **Root files**: `"index.html"`, `"style.css"`, `"app.js"`
- **Nested files**: `"src/components/Header.jsx"`, `"assets/logo.svg"`
- **No leading slash**: Paths never start with `/`
- **No trailing slash**: Directory paths are implicit (derived from file paths)
- **Path separator**: Always `/` regardless of OS

The `type` field is derived from the file extension using a lookup map:

```typescript
const EXTENSION_TYPE_MAP: Record<string, FileType> = {
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.less': 'css',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.mjs': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.txt': 'text',
  '.svg': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.gif': 'image',
  '.webp': 'image',
};

function getFileType(filename: string): FileType {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return EXTENSION_TYPE_MAP[ext] ?? 'other';
}
```

---

## 2. Zustand Store Design

The store is split into two slices to separate concerns: **project/file management** (structural operations like create, delete, rename) and **editor content** (text content, dirty state, cursor positions). This split allows the editor slice to be updated at high frequency (on every keystroke) without triggering re-renders in components that only care about the file tree structure.

### Store Slice: `useProjectStore`

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ProjectState {
  // ─── State ────────────────────────────────────────
  /** Currently active project */
  activeProject: Project | null;
  /** Map of all files by ID */
  files: Record<FileId, FileEntry>;
  /** All projects (metadata only, files loaded on demand) */
  projects: Record<ProjectId, Project>;
  /** Workspace-level settings */
  workspace: Workspace;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;

  // ─── Project Actions ──────────────────────────────
  createProject: (name: string, mode: EditorMode, templateId?: string) => ProjectId;
  loadProject: (projectId: ProjectId) => Promise<void>;
  saveProject: (projectId: ProjectId) => Promise<void>;
  deleteProject: (projectId: ProjectId) => Promise<void>;
  duplicateProject: (projectId: ProjectId, newName: string) => ProjectId;
  renameProject: (projectId: ProjectId, newName: string) => void;
  setActiveProject: (projectId: ProjectId) => void;

  // ─── File Actions ─────────────────────────────────
  addFile: (projectId: ProjectId, path: string, content?: string) => FileId;
  deleteFile: (fileId: FileId) => void;
  renameFile: (fileId: FileId, newPath: string) => void;
  moveFile: (fileId: FileId, newDirectoryPath: string) => void;
  duplicateFile: (fileId: FileId, newPath: string) => FileId;
  setActiveFile: (fileId: FileId | null) => void;

  // ─── External Resources ───────────────────────────
  addExternalResource: (projectId: ProjectId, resource: Omit<ExternalResource, 'id'>) => void;
  removeExternalResource: (projectId: ProjectId, resourceId: string) => void;
  reorderExternalResources: (projectId: ProjectId, resourceIds: string[]) => void;

  // ─── Mode Switching ───────────────────────────────
  switchToProjectMode: (projectId: ProjectId) => void;
  switchToSingleFileMode: (projectId: ProjectId) => void;

  // ─── Utility ──────────────────────────────────────
  getFileByPath: (projectId: ProjectId, path: string) => FileEntry | undefined;
  getFilesByProject: (projectId: ProjectId) => FileEntry[];
  getDirectoryTree: (projectId: ProjectId) => DirectoryNode[];
  clearError: () => void;
}
```

### Store Slice: `useEditorStore`

```typescript
interface EditorState {
  // ─── State ────────────────────────────────────────
  /** Content of each file, keyed by FileId (mirrors FileEntry.content for fast access) */
  contents: Record<FileId, string>;
  /** Dirty state per file (separate from FileEntry.isDirty for performance) */
  dirtyMap: Record<FileId, boolean>;
  /** Cursor positions per file for restoration */
  cursorPositions: Record<FileId, { line: number; column: number }>;
  /** Scroll positions per file */
  scrollPositions: Record<FileId, number>;
  /** Currently active file ID */
  activeFileId: FileId | null;
  /** CodeMirror editor instances (not persisted) */
  editorViews: Record<FileId, EditorView>;

  // ─── Content Actions ──────────────────────────────
  updateContent: (fileId: FileId, content: string) => void;
  markClean: (fileId: FileId) => void;
  markAllClean: () => void;

  // ─── Editor View Actions ──────────────────────────
  registerEditorView: (fileId: FileId, view: EditorView) => void;
  unregisterEditorView: (fileId: FileId) => void;
  saveCursorPosition: (fileId: FileId, line: number, column: number) => void;
  saveScrollPosition: (fileId: FileId, scrollTop: number) => void;

  // ─── Selection ────────────────────────────────────
  setActiveFile: (fileId: FileId | null) => void;

  // ─── Bulk Operations ──────────────────────────────
  loadContents: (entries: { fileId: FileId; content: string }[]) => void;
  clearAll: () => void;
}
```

### Store Implementation Sketch

```typescript
const useProjectStore = create<ProjectState>()(
  immer(
    persist(
      (set, get) => ({
        // ─── Initial State ──────────────────────────
        activeProject: null,
        files: {},
        projects: {},
        workspace: {
          activeProjectId: null,
          projectIds: [],
          settings: {
            theme: 'dark',
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            tabSize: 2,
            wordWrap: true,
            autoSaveIntervalMs: 3000,
            defaultMode: 'single-file',
          },
          recentProjectIds: [],
        },
        isLoading: false,
        error: null,

        // ─── Create Project ─────────────────────────
        createProject: (name, mode, templateId) => {
          const project = mode === 'single-file'
            ? createSingleFileProject(name)
            : createBlankProject(name);

          if (templateId) {
            applyTemplate(project, templateId);
          }

          set((state) => {
            state.projects[project.id] = project;
            state.workspace.projectIds.push(project.id);
            state.workspace.recentProjectIds.unshift(project.id);
            // Trim recent list to 10
            if (state.workspace.recentProjectIds.length > 10) {
              state.workspace.recentProjectIds = state.workspace.recentProjectIds.slice(0, 10);
            }
            state.activeProject = project;
            state.workspace.activeProjectId = project.id;

            // Register files
            for (const fileId of project.fileIds) {
              // Files are created by the factory functions and injected
            }
          });

          return project.id;
        },

        // ─── Add File ───────────────────────────────
        addFile: (projectId, path, content = '') => {
          const fileId = nanoid() as FileId;
          const name = path.split('/').pop()!;
          const now = new Date().toISOString();

          const file: FileEntry = {
            id: fileId,
            projectId,
            path,
            name,
            type: getFileType(name),
            content,
            createdAt: now,
            updatedAt: now,
            isDirty: false,
            isVirtual: false,
          };

          set((state) => {
            state.files[fileId] = file;
            if (state.projects[projectId]) {
              state.projects[projectId].fileIds.push(fileId);
              state.projects[projectId].updatedAt = now;
            }
          });

          // Also update editor store
          useEditorStore.getState().loadContents([{ fileId, content }]);

          return fileId;
        },

        // ─── Delete File ────────────────────────────
        deleteFile: (fileId) => {
          set((state) => {
            const file = state.files[fileId];
            if (!file) return;

            const project = state.projects[file.projectId];
            if (project) {
              project.fileIds = project.fileIds.filter((id) => id !== fileId);
              project.updatedAt = new Date().toISOString();

              // If deleting active file, switch to first remaining file
              if (project.activeFileId === fileId) {
                project.activeFileId = project.fileIds[0] ?? null;
              }
            }

            delete state.files[fileId];
          });

          // Clean up editor store
          const editorState = useEditorStore.getState();
          delete editorState.contents[fileId];
          delete editorState.dirtyMap[fileId];
          delete editorState.cursorPositions[fileId];
          delete editorState.scrollPositions[fileId];
        },

        // ─── Rename File ────────────────────────────
        renameFile: (fileId, newPath) => {
          set((state) => {
            const file = state.files[fileId];
            if (!file) return;

            const oldPath = file.path;
            file.path = newPath;
            file.name = newPath.split('/').pop()!;
            file.type = getFileType(file.name);
            file.updatedAt = new Date().toISOString();
            file.isDirty = true;

            // Update any other files that reference this file by path
            // (e.g., CSS <link> href, JS <script src>)
            // This is best-effort and can be enhanced later
          });
        },

        // ─── Get Directory Tree ─────────────────────
        getDirectoryTree: (projectId) => {
          const state = get();
          const projectFiles = state.projects[projectId]?.fileIds
            .map((id) => state.files[id])
            .filter(Boolean) ?? [];

          const tree: Record<string, DirectoryNode> = {};
          
          for (const file of projectFiles) {
            const parts = file.path.split('/');
            // Create directory entries for all parent directories
            for (let i = 0; i < parts.length - 1; i++) {
              const dirPath = parts.slice(0, i + 1).join('/');
              if (!tree[dirPath]) {
                tree[dirPath] = {
                  path: dirPath,
                  name: parts[i],
                  fileIds: [],
                  childDirectories: [],
                };
              }
              // Register child relationship
              if (i > 0) {
                const parentPath = parts.slice(0, i).join('/');
                if (!tree[parentPath].childDirectories.includes(dirPath)) {
                  tree[parentPath].childDirectories.push(dirPath);
                }
              }
            }
            // Add file to its parent directory
            if (parts.length > 1) {
              const parentDir = parts.slice(0, -1).join('/');
              tree[parentDir]?.fileIds.push(file.id);
            }
          }

          return Object.values(tree).sort((a, b) => a.path.localeCompare(b.path));
        },

        // ... other actions implemented similarly
      }),
      {
        name: 'liveframe-project-store',
        // Only persist project metadata and workspace settings
        // File contents are handled separately via IndexedDB
        partialize: (state) => ({
          projects: state.projects,
          workspace: state.workspace,
        }),
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
);
```

### Editor Store Implementation

```typescript
const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    contents: {},
    dirtyMap: {},
    cursorPositions: {},
    scrollPositions: {},
    activeFileId: null,
    editorViews: {},

    updateContent: (fileId, content) => {
      set((state) => {
        state.contents[fileId] = content;
        state.dirtyMap[fileId] = true;
      });

      // Also update the FileEntry in project store
      const projectState = useProjectStore.getState();
      const file = projectState.files[fileId];
      if (file) {
        useProjectStore.setState((state) => {
          state.files[fileId].content = content;
          state.files[fileId].isDirty = true;
          state.files[fileId].updatedAt = new Date().toISOString();
        });
      }

      // Trigger debounced auto-save
      debouncedAutoSave(fileId);
    },

    markClean: (fileId) => {
      set((state) => {
        state.dirtyMap[fileId] = false;
      });
      useProjectStore.setState((state) => {
        state.files[fileId].isDirty = false;
      });
    },

    markAllClean: () => {
      set((state) => {
        for (const fileId of Object.keys(state.dirtyMap)) {
          state.dirtyMap[fileId as FileId] = false;
        }
      });
    },

    registerEditorView: (fileId, view) => {
      set((state) => {
        state.editorViews[fileId] = view;
      });
    },

    unregisterEditorView: (fileId) => {
      set((state) => {
        delete state.editorViews[fileId];
      });
    },

    saveCursorPosition: (fileId, line, column) => {
      set((state) => {
        state.cursorPositions[fileId] = { line, column };
      });
    },

    saveScrollPosition: (fileId, scrollTop) => {
      set((state) => {
        state.scrollPositions[fileId] = scrollTop;
      });
    },

    setActiveFile: (fileId) => {
      // Save state of current file before switching
      const currentFileId = get().activeFileId;
      if (currentFileId) {
        const view = get().editorViews[currentFileId];
        if (view) {
          const pos = view.state.selection.main.head;
          const line = view.state.doc.lineAt(pos);
          get().saveCursorPosition(currentFileId, line.number, pos - line.from);
          get().saveScrollPosition(currentFileId, view.scrollDOM.scrollTop);
        }
      }

      set((state) => {
        state.activeFileId = fileId;
      });

      // Also update project store
      const projectState = useProjectStore.getState();
      if (projectState.activeProject) {
        useProjectStore.setState((state) => {
          if (state.activeProject) {
            state.activeProject.activeFileId = fileId;
          }
        });
      }
    },

    loadContents: (entries) => {
      set((state) => {
        for (const { fileId, content } of entries) {
          state.contents[fileId] = content;
          state.dirtyMap[fileId] = false;
        }
      });
    },

    clearAll: () => {
      set((state) => {
        state.contents = {};
        state.dirtyMap = {};
        state.cursorPositions = {};
        state.scrollPositions = {};
        state.editorViews = {};
        state.activeFileId = null;
      });
    },
  }))
);
```

### Debounced Auto-Save

```typescript
const autoSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedAutoSave(fileId: FileId): void {
  const settings = useProjectStore.getState().workspace.settings;
  const interval = settings.autoSaveIntervalMs;
  
  if (interval === 0) return; // Auto-save disabled

  if (autoSaveTimers[fileId]) {
    clearTimeout(autoSaveTimers[fileId]);
  }

  autoSaveTimers[fileId] = setTimeout(async () => {
    const file = useProjectStore.getState().files[fileId];
    if (file?.isDirty) {
      await saveFileToIndexedDB(file);
      useEditorStore.getState().markClean(fileId);
    }
    delete autoSaveTimers[fileId];
  }, interval);
}
```

---

## 3. In-Memory Virtual File System

### Architecture Decision: Flat Map vs. Nested Tree

After careful analysis, LiveFrame uses a **flat map** (`Record<FileId, FileEntry>`) as the primary data structure, with the tree structure **derived on demand** for the UI. This approach was chosen over a nested tree for several compelling reasons:

1. **Zustand/Immer compatibility**: Deeply nested trees cause performance issues with immer's structural sharing. A flat map produces minimal diffs.
2. **O(1) file access**: Looking up a file by ID is a hash map lookup, not a tree traversal.
3. **Simpler state updates**: Moving a file from one directory to another is just changing the `path` string — no tree reparenting logic.
4. **Consistent with IDE patterns**: VS Code internally uses a similar flat resource map.

### Virtual File System Class

```typescript
class VirtualFileSystem {
  private files: Map<FileId, FileEntry>;
  private pathIndex: Map<string, FileId>; // path -> fileId for fast path lookups

  constructor() {
    this.files = new Map();
    this.pathIndex = new Map();
  }

  // ─── Core Operations ──────────────────────────────

  addFile(file: FileEntry): void {
    this.files.set(file.id, file);
    this.pathIndex.set(this.makePathKey(file.projectId, file.path), file.id);
  }

  removeFile(fileId: FileId): void {
    const file = this.files.get(fileId);
    if (file) {
      this.pathIndex.delete(this.makePathKey(file.projectId, file.path));
      this.files.delete(fileId);
    }
  }

  getFile(fileId: FileId): FileEntry | undefined {
    return this.files.get(fileId);
  }

  getFileByPath(projectId: ProjectId, path: string): FileEntry | undefined {
    const fileId = this.pathIndex.get(this.makePathKey(projectId, path));
    return fileId ? this.files.get(fileId) : undefined;
  }

  updateContent(fileId: FileId, content: string): void {
    const file = this.files.get(fileId);
    if (file) {
      file.content = content;
      file.updatedAt = new Date().toISOString();
      file.isDirty = true;
    }
  }

  // ─── Path Operations ──────────────────────────────

  private makePathKey(projectId: ProjectId, path: string): string {
    return `${projectId}::${path}`;
  }

  /** Get all files in a specific directory (non-recursive) */
  getFilesInDirectory(projectId: ProjectId, dirPath: string): FileEntry[] {
    const result: FileEntry[] = [];
    const prefix = dirPath ? dirPath + '/' : '';
    
    for (const file of this.files.values()) {
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

  /** Get all directories at a given level */
  getSubdirectories(projectId: ProjectId, parentPath: string): string[] {
    const dirs = new Set<string>();
    const prefix = parentPath ? parentPath + '/' : '';

    for (const file of this.files.values()) {
      if (file.projectId !== projectId) continue;
      if (!file.path.startsWith(prefix)) continue;
      
      const remainder = file.path.substring(prefix.length);
      const slashIndex = remainder.indexOf('/');
      
      if (slashIndex !== -1) {
        // This file is inside a subdirectory
        const dirName = remainder.substring(0, slashIndex);
        const fullPath = prefix + dirName;
        dirs.add(fullPath);
      }
    }

    return Array.from(dirs).sort();
  }

  /** Recursively get all files under a directory */
  getAllFilesUnderDirectory(projectId: ProjectId, dirPath: string): FileEntry[] {
    const prefix = dirPath ? dirPath + '/' : '';
    const result: FileEntry[] = [];

    for (const file of this.files.values()) {
      if (file.projectId !== projectId) continue;
      if (dirPath === '' || file.path.startsWith(prefix)) {
        result.push(file);
      }
    }

    return result;
  }

  // ─── Tree Building ────────────────────────────────

  buildTree(projectId: ProjectId): TreeNode {
    const root: TreeNode = {
      id: 'root',
      name: projectId,
      type: 'directory',
      children: [],
    };

    const projectFiles = Array.from(this.files.values())
      .filter((f) => f.projectId === projectId);

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

  // ─── Bulk Operations ──────────────────────────────

  /** Move all files from one directory to another */
  moveDirectory(projectId: ProjectId, oldPath: string, newPath: string): void {
    const prefix = oldPath + '/';
    for (const file of this.files.values()) {
      if (file.projectId !== projectId) continue;
      if (file.path.startsWith(prefix)) {
        const newFilePath = newPath + file.path.substring(oldPath.length);
        this.pathIndex.delete(this.makePathKey(projectId, file.path));
        file.path = newFilePath;
        file.name = newFilePath.split('/').pop()!;
        file.updatedAt = new Date().toISOString();
        this.pathIndex.set(this.makePathKey(projectId, file.path), file.id);
      }
    }
  }

  /** Delete all files under a directory */
  deleteDirectory(projectId: ProjectId, dirPath: string): FileId[] {
    const deletedIds: FileId[] = [];
    const prefix = dirPath + '/';

    for (const [fileId, file] of this.files.entries()) {
      if (file.projectId !== projectId) continue;
      if (file.path.startsWith(prefix) || file.path === dirPath) {
        this.pathIndex.delete(this.makePathKey(projectId, file.path));
        this.files.delete(fileId);
        deletedIds.push(fileId);
      }
    }

    return deletedIds;
  }

  /** Check if a path already exists */
  pathExists(projectId: ProjectId, path: string): boolean {
    return this.pathIndex.has(this.makePathKey(projectId, path));
  }

  /** Generate a unique path for a new file (avoids collisions) */
  generateUniquePath(projectId: ProjectId, basePath: string, extension: string): string {
    let path = `${basePath}.${extension}`;
    let counter = 1;

    while (this.pathExists(projectId, path)) {
      path = `${basePath}-${counter}.${extension}`;
      counter++;
    }

    return path;
  }

  /** Get statistics */
  getStats(projectId: ProjectId): { fileCount: number; totalSize: number; dirtyCount: number } {
    let fileCount = 0;
    let totalSize = 0;
    let dirtyCount = 0;

    for (const file of this.files.values()) {
      if (file.projectId !== projectId) continue;
      fileCount++;
      totalSize += file.content?.length ?? 0;
      if (file.isDirty) dirtyCount++;
    }

    return { fileCount, totalSize, dirtyCount };
  }
}

// ─── Tree Node (for UI consumption) ───────────────────────

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  fileType?: FileType;
  isDirty?: boolean;
  children: TreeNode[];
}
```

### Performance Considerations

The flat-map approach with a path index provides excellent performance characteristics:

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Get file by ID | O(1) | Map lookup |
| Get file by path | O(1) | Path index lookup |
| Add file | O(1) | Map + index insertion |
| Delete file | O(1) | Map + index deletion |
| List directory | O(n) | Filter by project + prefix |
| Build tree | O(n log n) | Sort dominates |
| Move directory | O(k) | k = files in directory |

For a typical project with 50-200 files, all operations complete in under 1ms. Even at 1000 files, the performance remains well within acceptable bounds for an interactive editor. The `buildTree` method is the most expensive but is only called when the file tree UI needs to re-render, which is gated by Zustand's selector-based subscription model.

**Memory optimization**: For very large projects (>500 files), consider implementing a lazy-loading strategy where file contents are only loaded when the file is opened in the editor. The `FileEntry.content` field would be `null` until needed, and content would be fetched from IndexedDB on demand. This is an optional optimization that can be added later without changing the API.

---

## 4. IndexedDB Persistence

### Why IndexedDB over localStorage

- **Storage limit**: localStorage is limited to ~5-10MB per origin. IndexedDB has no hard limit in most browsers (typically hundreds of MB before prompting).
- **Binary data**: IndexedDB can store `Blob` and `ArrayBuffer` natively, useful for imported images and ZIP files.
- **Transactional safety**: IndexedDB provides transactional writes, preventing partial state corruption.
- **Async API**: IndexedDB is inherently async, preventing UI-blocking writes.

### Library Choice: `idb`

The `idb` library (by Jake Archibald) provides a thin, promise-based wrapper over the raw IndexedDB API. It offers:

- **Type-safe** database schema definitions
- **Promise-based** API (vs. callback-based raw API)
- **Transaction helpers** that auto-commit
- **Tiny bundle size** (~1.2KB gzipped)

```typescript
import { openDB, IDBPDatabase } from 'idb';
```

### Database Schema

```typescript
const DB_NAME = 'liveframe-db';
const DB_VERSION = 1;

interface LiveFrameDB {
  projects: ProjectRecord;
  files: FileRecord;
  settings: SettingsRecord;
  templates: TemplateRecord;
}

interface ProjectRecord {
  key: ProjectId;
  value: {
    id: ProjectId;
    name: string;
    mode: EditorMode;
    fileIds: FileId[];
    externalResources: ExternalResource[];
    createdAt: string;
    updatedAt: string;
    activeFileId: FileId | null;
    templateId: string | null;
    previewSettings: PreviewSettings;
  };
  indexes: {
    'by-updatedAt': string;
    'by-name': string;
  };
}

interface FileRecord {
  key: FileId;
  value: {
    id: FileId;
    projectId: ProjectId;
    path: string;
    name: string;
    type: FileType;
    content: string | null;
    createdAt: string;
    updatedAt: string;
    isDirty: boolean;
    isVirtual: boolean;
  };
  indexes: {
    'by-projectId': ProjectId;
    'by-projectId-path': [ProjectId, string];
  };
}

interface SettingsRecord {
  key: string; // e.g., 'workspace', 'editor', 'theme'
  value: Record<string, unknown>;
}

interface TemplateRecord {
  key: string;
  value: {
    id: string;
    name: string;
    description: string;
    category: string;
    files: { path: string; content: string }[];
    externalResources: ExternalResource[];
    previewSettings: PreviewSettings;
  };
}
```

### Database Initialization

```typescript
let dbInstance: IDBPDatabase<LiveFrameDB> | null = null;

async function getDB(): Promise<IDBPDatabase<LiveFrameDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LiveFrameDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // ─── Projects Store ─────────────────────────
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updatedAt', 'updatedAt');
        projectStore.createIndex('by-name', 'name');
      }

      // ─── Files Store ────────────────────────────
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-projectId', 'projectId');
        fileStore.createIndex('by-projectId-path', ['projectId', 'path'], {
          unique: true,
        });
      }

      // ─── Settings Store ─────────────────────────
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // ─── Templates Store ────────────────────────
      if (!db.objectStoreNames.contains('templates')) {
        const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
        templateStore.createIndex('by-category', 'category');
      }
    },
    blocked() {
      console.warn('LiveFrame DB upgrade blocked — close other tabs');
    },
    blocking() {
      console.warn('LiveFrame DB blocking — this tab is blocking an upgrade');
    },
    terminated() {
      console.error('LiveFrame DB connection terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}
```

### CRUD Operations

```typescript
// ─── Project Operations ───────────────────────────────────

async function saveProjectToIndexedDB(project: Project): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('projects', 'readwrite');
  await tx.store.put({
    id: project.id,
    name: project.name,
    mode: project.mode,
    fileIds: project.fileIds,
    externalResources: project.externalResources,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    activeFileId: project.activeFileId,
    templateId: project.templateId,
    previewSettings: project.previewSettings,
  });
  await tx.done;
}

async function loadProjectFromIndexedDB(projectId: ProjectId): Promise<Project | null> {
  const db = await getDB();
  const record = await db.get('projects', projectId);
  return record ?? null;
}

async function listProjectsFromIndexedDB(): Promise<Project[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('projects', 'by-updatedAt');
  return records.reverse(); // Most recent first
}

async function deleteProjectFromIndexedDB(projectId: ProjectId): Promise<void> {
  const db = await getDB();
  
  // Delete all associated files first
  const tx = db.transaction(['projects', 'files'], 'readwrite');
  const fileIndex = tx.objectStore('files').index('by-projectId');
  let cursor = await fileIndex.openCursor(projectId);
  
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  
  // Delete the project record
  await tx.objectStore('projects').delete(projectId);
  await tx.done;
}

// ─── File Operations ──────────────────────────────────────

async function saveFileToIndexedDB(file: FileEntry): Promise<void> {
  const db = await getDB();
  await db.put('files', {
    id: file.id,
    projectId: file.projectId,
    path: file.path,
    name: file.name,
    type: file.type,
    content: file.content,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    isDirty: file.isDirty,
    isVirtual: file.isVirtual,
  });
}

async function loadFilesByProject(projectId: ProjectId): Promise<FileEntry[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('files', 'by-projectId', projectId);
  return records;
}

async function saveAllProjectFiles(projectId: ProjectId, files: FileEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('files', 'readwrite');
  
  for (const file of files) {
    await tx.store.put(file);
  }
  
  await tx.done;
}

// ─── Settings Operations ──────────────────────────────────

async function saveSettings(key: string, value: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, ...value });
}

async function loadSettings(key: string): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record ?? null;
}
```

### Auto-Save Strategy

The auto-save strategy uses a **two-tier debounced approach**:

1. **Content changes**: When the user types, content is written to the in-memory store immediately. A debounced write to IndexedDB fires after the configured interval (default 3 seconds of inactivity).

2. **Structural changes**: File creation, deletion, and renaming are written to IndexedDB immediately (no debounce), since these are infrequent operations and losing them would be catastrophic.

3. **Dirty tracking**: The `isDirty` flag on each `FileEntry` tracks whether the in-memory version differs from the persisted version. When a debounced save completes, the flag is cleared.

```typescript
// Auto-save coordinator
class AutoSaveCoordinator {
  private pendingWrites: Map<FileId, ReturnType<typeof setTimeout>> = new Map();
  private intervalMs: number;

  constructor(intervalMs: number = 3000) {
    this.intervalMs = intervalMs;
  }

  scheduleSave(fileId: FileId): void {
    if (this.pendingWrites.has(fileId)) {
      clearTimeout(this.pendingWrites.get(fileId)!);
    }

    const timer = setTimeout(async () => {
      const file = useProjectStore.getState().files[fileId];
      if (file && file.isDirty) {
        try {
          await saveFileToIndexedDB(file);
          useEditorStore.getState().markClean(fileId);
        } catch (error) {
          console.error(`Auto-save failed for ${file.path}:`, error);
        }
      }
      this.pendingWrites.delete(fileId);
    }, this.intervalMs);

    this.pendingWrites.set(fileId, timer);
  }

  async flushAll(): Promise<void> {
    // Clear all timers and save immediately
    for (const [fileId, timer] of this.pendingWrites.entries()) {
      clearTimeout(timer);
      const file = useProjectStore.getState().files[fileId];
      if (file && file.isDirty) {
        await saveFileToIndexedDB(file);
        useEditorStore.getState().markClean(fileId);
      }
    }
    this.pendingWrites.clear();
  }

  updateInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
  }
}

const autoSave = new AutoSaveCoordinator();
```

### Loading a Project on Startup

```typescript
async function initializeWorkspace(): Promise<void> {
  const db = await getDB();
  
  useProjectStore.setState({ isLoading: true });

  try {
    // Load workspace settings
    const settings = await loadSettings('workspace');
    if (settings) {
      useProjectStore.setState((state) => {
        Object.assign(state.workspace.settings, settings);
      });
    }

    // Load last active project
    const workspaceSettings = await loadSettings('workspace-meta');
    const lastProjectId = workspaceSettings?.activeProjectId as ProjectId | undefined;

    if (lastProjectId) {
      await useProjectStore.getState().loadProject(lastProjectId);
    } else {
      // Create a default single-file project
      useProjectStore.getState().createProject('Untitled', 'single-file');
    }
  } catch (error) {
    useProjectStore.setState({ error: String(error) });
  } finally {
    useProjectStore.setState({ isLoading: false });
  }
}

// The loadProject action:
async function loadProjectAction(projectId: ProjectId): Promise<void> {
  const project = await loadProjectFromIndexedDB(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const files = await loadFilesByProject(projectId);

  set((state) => {
    state.activeProject = project;
    state.workspace.activeProjectId = projectId;
    
    // Update recent list
    state.workspace.recentProjectIds = [
      projectId,
      ...state.workspace.recentProjectIds.filter((id) => id !== projectId),
    ].slice(0, 10);

    // Load files into state
    for (const file of files) {
      state.files[file.id] = file;
    }
  });

  // Load file contents into editor store
  useEditorStore.getState().loadContents(
    files.map((f) => ({ fileId: f.id, content: f.content ?? '' }))
  );
}
```

---

## 5. File Tree UI

### Component Architecture

The file tree is one of the most complex UI components in LiveFrame. It must support expanding/collapsing directories, context menus, drag-and-drop, inline renaming, and file-type icons — all while remaining performant with hundreds of nodes.

**Library choice: Custom tree component built on Radix UI primitives.** While `react-arborist` provides a solid foundation, building a custom tree gives us full control over styling (Tailwind), keyboard navigation, and integration with shadcn/ui components. The custom tree is built on a virtualized list for performance.

```
FileTree
├── FileTreeProvider (context for tree state)
├── FileTreeList (virtualized scroll container)
│   └── FileTreeNode (recursive)
│       ├── DirectoryNode
│       │   ├── ExpandToggle
│       │   ├── DirectoryIcon
│       │   ├── DirectoryName
│       │   └── Children (lazy-rendered)
│       └── FileNode
│           ├── FileIcon (by extension)
│           ├── FileName
│           └── DirtyIndicator
├── FileTreeContextMenu
│   ├── New File
│   ├── New Folder
│   ├── Rename
│   ├── Duplicate
│   ├── Delete
│   └── Download
└── InlineRenameInput
```

### File Tree Component Implementation

```tsx
import { useState, useCallback, useMemo, createContext, useContext } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── File Icon Map ─────────────────────────────────────────

const FILE_ICONS: Record<FileType, React.ComponentType<{ className?: string }>> = {
  html: HtmlIcon,
  css: CssIcon,
  javascript: JsIcon,
  json: JsonIcon,
  markdown: MarkdownIcon,
  text: TextIcon,
  image: ImageIcon,
  other: FileIcon,
};

function getFileIcon(filename: string, type: FileType): React.ReactNode {
  // Special cases for well-known filenames
  if (filename === 'index.html') return <HomePageIcon className="w-4 h-4 text-orange-500" />;
  if (filename === 'package.json') return <NodeIcon className="w-4 h-4 text-green-500" />;
  if (filename === 'README.md') return <BookIcon className="w-4 h-4 text-blue-400" />;
  
  const Icon = FILE_ICONS[type];
  return <Icon className="w-4 h-4" />;
}

// ─── Tree Node Component ───────────────────────────────────

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  isActive: boolean;
  isRenaming: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (fileId: FileId) => void;
  onRename: (fileId: FileId, newName: string) => void;
  onDelete: (fileId: FileId) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  depth,
  isActive,
  isRenaming,
  onToggle,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [renameValue, setRenameValue] = useState(node.name);
  const { setContextMenuTarget } = useFileTreeContext();

  const handleToggle = useCallback(() => {
    if (node.type === 'directory') {
      setIsExpanded((prev) => !prev);
      onToggle(node.id);
    }
  }, [node, onToggle]);

  const handleClick = useCallback(() => {
    if (node.type === 'file') {
      onSelect(node.id as FileId);
    } else {
      handleToggle();
    }
  }, [node, onSelect, handleToggle]);

  const handleRenameSubmit = useCallback(() => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRename(node.id as FileId, renameValue.trim());
    }
  }, [renameValue, node, onRename]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuTarget({ node, x: e.clientX, y: e.clientY });
  }, [node, setContextMenuTarget]);

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm text-sm',
          'hover:bg-accent/50 transition-colors',
          isActive && 'bg-accent text-accent-foreground',
          node.type === 'directory' && 'font-medium',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-expanded={node.type === 'directory' ? isExpanded : undefined}
        aria-selected={isActive}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleClick();
          if (e.key === 'ArrowRight' && node.type === 'directory') setIsExpanded(true);
          if (e.key === 'ArrowLeft' && node.type === 'directory') setIsExpanded(false);
        }}
      >
        {/* Expand/Collapse Arrow */}
        {node.type === 'directory' && (
          <ChevronIcon
            className={cn(
              'w-3.5 h-3.5 shrink-0 transition-transform',
              isExpanded && 'rotate-90',
            )}
          />
        )}
        {node.type === 'file' && <span className="w-3.5 shrink-0" />}

        {/* Icon */}
        {node.type === 'directory' ? (
          isExpanded ? (
            <FolderOpenIcon className="w-4 h-4 text-yellow-500 shrink-0" />
          ) : (
            <FolderIcon className="w-4 h-4 text-yellow-500 shrink-0" />
          )
        ) : (
          getFileIcon(node.name, node.fileType!)
        )}

        {/* Name or Rename Input */}
        {isRenaming ? (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setRenameValue(node.name);
            }}
            className="h-5 px-1 py-0 text-sm flex-1 min-w-0"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 min-w-0">{node.name}</span>
        )}

        {/* Dirty indicator */}
        {node.isDirty && (
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Unsaved changes" />
        )}
      </div>

      {/* Children (directories only) */}
      {node.type === 'directory' && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isActive={isActive && child.id === activeFileId}
              isRenaming={renamingNodeId === child.id}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
};
```

### Context Menu

```tsx
const FileTreeContextMenu: React.FC = () => {
  const { contextMenuTarget, setContextMenuTarget } = useFileTreeContext();
  const addFile = useProjectStore((s) => s.addFile);
  const deleteFile = useProjectStore((s) => s.deleteFile);

  if (!contextMenuTarget) return null;

  const { node } = contextMenuTarget;
  const isDirectory = node.type === 'directory';
  const project = useProjectStore.getState().activeProject;
  if (!project) return null;

  const basePath = node.type === 'directory' 
    ? node.id.replace('dir:', '') 
    : '';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="absolute" style={{ left: 0, top: 0 }} />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem
          onClick={() => {
            const fileName = prompt('File name:');
            if (fileName) {
              const path = basePath ? `${basePath}/${fileName}` : fileName;
              addFile(project.id, path);
            }
          }}
        >
          <FilePlus className="mr-2 h-4 w-4" /> New File
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            const dirName = prompt('Folder name:');
            if (dirName) {
              // Create a placeholder file in the new directory to ensure it exists
              const path = basePath ? `${basePath}/${dirName}/.gitkeep` : `${dirName}/.gitkeep`;
              addFile(project.id, path, '');
            }
          }}
        >
          <FolderPlus className="mr-2 h-4 w-4" /> New Folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => startRenaming(node.id)}>
          <Pencil className="mr-2 h-4 w-4" /> Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNode(node)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            if (node.type === 'file') {
              deleteFile(node.id as FileId);
            } else {
              deleteDirectory(node.id.replace('dir:', ''));
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
```

### Drag-and-Drop

For drag-and-drop file/folder reorganization, we use `@dnd-kit/core` with `@dnd-kit/sortable` since it provides excellent React integration and accessibility support:

```tsx
import { DndContext, DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// In the FileTree component:
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const draggedFile = useProjectStore.getState().files[active.id as FileId];
  const targetPath = getTargetDirectoryPath(over.id as string);
  
  if (draggedFile) {
    const newPath = `${targetPath}/${draggedFile.name}`;
    useProjectStore.getState().renameFile(draggedFile.id, newPath);
  }
}, []);
```

### Virtualization for Large Trees

Using `@tanstack/react-virtual` for virtualized rendering when the tree has many nodes:

```tsx
const FileTreeVirtualized: React.FC<{ tree: TreeNode }> = ({ tree }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Flatten tree into a visible list (respecting expanded/collapsed state)
  const visibleNodes = useMemo(() => {
    const nodes: Array<{ node: TreeNode; depth: number }> = [];
    const traverse = (node: TreeNode, depth: number) => {
      nodes.push({ node, depth });
      if (node.type === 'directory' && expandedIds.has(node.id)) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };
    tree.children.forEach((child) => traverse(child, 0));
    return nodes;
  }, [tree, expandedIds]);

  const virtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Approximate row height
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const { node, depth } = visibleNodes[virtualItem.index];
          return (
            <FileTreeNode
              key={virtualItem.key}
              node={node}
              depth={depth}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
```

---

## 6. Single-File vs Project Mode Switching

### Design Philosophy

The transition between single-file and project modes must be **seamless and lossless**. The user's work should never be discarded. Since single-file mode is internally a virtual project with three files, switching to project mode is conceptually a "promotion" — the three virtual files become real files in a full project tree.

### State Changes During Mode Switch

```typescript
// In useProjectStore:

switchToProjectMode: (projectId) => {
  set((state) => {
    const project = state.projects[projectId];
    if (!project || project.mode !== 'single-file') return;

    // 1. Promote virtual files to real files
    for (const fileId of project.fileIds) {
      const file = state.files[fileId];
      if (file) {
        file.isVirtual = false;
      }
    }

    // 2. Change project mode
    project.mode = 'project';
    project.updatedAt = new Date().toISOString();
  });

  // 3. Persist the change
  const project = get().projects[projectId];
  if (project) {
    saveProjectToIndexedDB(project);
    for (const fileId of project.fileIds) {
      const file = get().files[fileId];
      if (file) saveFileToIndexedDB(file);
    }
  }
},

switchToSingleFileMode: (projectId) => {
  set((state) => {
    const project = state.projects[projectId];
    if (!project || project.mode !== 'project') return;

    // 1. Find the three canonical files
    const files = project.fileIds.map((id) => state.files[id]).filter(Boolean);
    const htmlFile = files.find((f) => f.type === 'html');
    const cssFile = files.find((f) => f.type === 'css');
    const jsFile = files.find((f) => f.type === 'javascript');

    // 2. If any canonical file is missing, create it
    if (!htmlFile) {
      const fileId = nanoid() as FileId;
      state.files[fileId] = createDefaultHtmlFile(projectId, project.name);
      project.fileIds.push(fileId);
    }
    if (!cssFile) {
      const fileId = nanoid() as FileId;
      state.files[fileId] = createDefaultCssFile(projectId);
      project.fileIds.push(fileId);
    }
    if (!jsFile) {
      const fileId = nanoid() as FileId;
      state.files[fileId] = createDefaultJsFile(projectId);
      project.fileIds.push(fileId);
    }

    // 3. Remove extra files? NO — preserve them. They just won't be shown
    //    in single-file mode. The user can switch back to project mode to
    //    access them. We DO need to mark the canonical files as virtual.
    const canonicalIds = [
      htmlFile?.id ?? state.files[project.fileIds[project.fileIds.length - 3]]?.id,
      cssFile?.id ?? state.files[project.fileIds[project.fileIds.length - 2]]?.id,
      jsFile?.id ?? state.files[project.fileIds[project.fileIds.length - 1]]?.id,
    ].filter(Boolean);

    for (const fileId of canonicalIds) {
      state.files[fileId].isVirtual = true;
    }

    // 4. Set the HTML file as the active tab
    project.activeFileId = htmlFile?.id ?? canonicalIds[0] ?? null;
    project.mode = 'single-file';
    project.updatedAt = new Date().toISOString();
  });
},
```

### UI Transition

The UI changes between two distinct layouts:

**Single-File Mode Layout:**
```
┌──────────────────────────────────────────────┐
│  [HTML] [CSS] [JS]  ← Tab bar               │
├─────────────────────┬────────────────────────┤
│                     │                        │
│   Code Editor       │   Live Preview         │
│   (CodeMirror 6)    │   (iframe srcdoc)      │
│                     │                        │
└─────────────────────┴────────────────────────┘
```

**Project Mode Layout:**
```
┌─────────┬─────────────────────┬──────────────┐
│ File    │                     │              │
│ Tree    │   Code Editor       │  Live        │
│         │   (CodeMirror 6)    │  Preview     │
│ ▼ src/  │                     │              │
│   App   │                     │              │
│ ▼ css/  │                     │              │
│   main  │                     │              │
│ index   │                     │              │
└─────────┴─────────────────────┴──────────────┘
```

The transition is animated with a CSS transition on the sidebar width:

```tsx
const EditorLayout: React.FC = () => {
  const mode = useProjectStore((s) => s.activeProject?.mode ?? 'single-file');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeSwitch = useCallback(() => {
    setIsTransitioning(true);
    // The actual state change happens in the store
    setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar - only visible in project mode */}
      <div
        className={cn(
          'border-r bg-muted/30 transition-all duration-300 overflow-hidden',
          mode === 'project' ? 'w-56' : 'w-0',
        )}
      >
        {mode === 'project' && <FileTree />}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar - different in each mode */}
        {mode === 'single-file' ? (
          <SingleFileTabs />
        ) : (
          <ProjectModeTabs /> // Shows open file tabs
        )}

        {/* CodeMirror Editor */}
        <div className="flex-1 min-h-0">
          <CodeMirrorEditor />
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-1/2 border-l">
        <PreviewPanel />
      </div>
    </div>
  );
};
```

### Preserving Work

When switching modes, the following must be preserved:

1. **File contents**: All file contents remain in the editor store. No data is lost.
2. **Cursor positions**: Stored per-file in `cursorPositions` map.
3. **Dirty state**: Files with unsaved changes remain marked as dirty.
4. **Preview state**: The preview continues to work — in single-file mode, the three canonical files are assembled into `srcdoc`. In project mode, all files are assembled.
5. **External resources**: Carried over unchanged.

The key invariant: **Mode switching is purely a UI-level concern.** The underlying data model doesn't change — only the `mode` field on the Project and the `isVirtual` flag on files.

---

## 7. ZIP Export

### Library Choice: `fflate`

`fflate` is chosen over `jszip` for several reasons:

| Feature | `fflate` | `jszip` |
|---------|----------|---------|
| Bundle size | ~8KB gzipped | ~24KB gzipped |
| Performance | Uses native CompressionStream where available | Pure JS |
| API | Sync + async | Primarily async |
| Streaming | Supports streaming compression | Limited |
| ESM support | Native ESM | CommonJS + ESM wrapper |

### ZIP Export Implementation

```typescript
import { zip, ZipInput, strToU8 } from 'fflate';

interface ExportOptions {
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
  /** Custom file filter */
  filter?: (path: string) => boolean;
  /** Include external resources as a manifest */
  includeManifest?: boolean;
}

async function exportProjectAsZip(
  project: Project,
  files: FileEntry[],
  options: ExportOptions = {}
): Promise<Blob> {
  const { includeHidden = false, filter, includeManifest = true } = options;

  const zipData: ZipInput = {};

  for (const file of files) {
    // Skip hidden files unless requested
    if (!includeHidden && file.name.startsWith('.')) continue;
    // Apply custom filter
    if (filter && !filter(file.path)) continue;
    // Skip files without content (binary placeholders)
    if (file.content === null) continue;

    zipData[file.path] = strToU8(file.content);
  }

  // Include a manifest file with project metadata
  if (includeManifest) {
    const manifest = {
      name: project.name,
      mode: project.mode,
      templateId: project.templateId,
      externalResources: project.externalResources,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    zipData['liveframe-manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  }

  // Generate ZIP
  return new Promise((resolve, reject) => {
    zip(zipData, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(new Blob([data], { type: 'application/zip' }));
    });
  });
}

// ─── Download Helper ───────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Usage in a React component:
const handleExportZip = useCallback(async () => {
  const project = useProjectStore.getState().activeProject;
  if (!project) return;

  const files = useProjectStore.getState().getFilesByProject(project.id);
  const blob = await exportProjectAsZip(project, files);
  downloadBlob(blob, `${project.name}.zip`);
}, []);
```

### ZIP Import Implementation

```typescript
import { unzip, Unzipped } from 'fflate';

interface ImportResult {
  project: Project;
  files: FileEntry[];
  warnings: string[];
}

async function importProjectFromZip(zipBlob: Blob, projectName?: string): Promise<ImportResult> {
  const buffer = await zipBlob.arrayBuffer();
  const warnings: string[] = [];

  // Unzip
  const unzipped: Unzipped = await new Promise((resolve, reject) => {
    unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  // Check for manifest
  let manifest: any = null;
  const manifestKey = Object.keys(unzipped).find(
    (k) => k === 'liveframe-manifest.json' || k.endsWith('/liveframe-manifest.json')
  );
  if (manifestKey) {
    try {
      const manifestBytes = unzipped[manifestKey];
      manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    } catch {
      warnings.push('Failed to parse manifest file');
    }
  }

  // Create project
  const projectId = nanoid() as ProjectId;
  const now = new Date().toISOString();
  const name = projectName ?? manifest?.name ?? 'Imported Project';

  const project: Project = {
    id: projectId,
    name,
    mode: 'project',
    fileIds: [],
    externalResources: manifest?.externalResources ?? [],
    createdAt: now,
    updatedAt: now,
    activeFileId: null,
    templateId: manifest?.templateId ?? null,
    previewSettings: manifest?.previewSettings ?? {
      autoRefresh: true,
      refreshDebounceMs: 300,
      viewport: 'desktop',
    },
  };

  // Create file entries
  const files: FileEntry[] = [];
  let firstFileId: FileId | null = null;

  for (const [path, data] of Object.entries(unzipped)) {
    // Skip directories (paths ending with /) and the manifest
    if (path.endsWith('/') || path.includes('liveframe-manifest.json')) continue;
    // Skip __MACOSX and other metadata directories
    if (path.startsWith('__MACOSX') || path.startsWith('.')) continue;

    // Strip leading directory if the ZIP has a single root folder
    const normalizedPath = stripRootFolder(path);

    const content = new TextDecoder().decode(data);
    const fileId = nanoid() as FileId;
    const name = normalizedPath.split('/').pop()!;

    files.push({
      id: fileId,
      projectId,
      path: normalizedPath,
      name,
      type: getFileType(name),
      content,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      isVirtual: false,
    });

    project.fileIds.push(fileId);
    if (!firstFileId) firstFileId = fileId;
  }

  project.activeFileId = firstFileId;

  return { project, files, warnings };
}

/** If all files share a common root directory, strip it */
function stripRootFolder(path: string): string {
  const parts = path.split('/');
  // If the first part is a directory (implied by other files), try stripping it
  // This handles the common case of ZIP files created from a directory
  if (parts.length > 1) {
    // Simple heuristic: if the first segment looks like a project folder name
    // The caller can customize this
    return parts.slice(1).join('/');
  }
  return path;
}
```

### Exported ZIP Structure

For a project with this file tree:
```
src/
  components/
    Header.jsx
  App.jsx
  main.jsx
index.html
style.css
```

The exported ZIP contains:
```
index.html
style.css
src/App.jsx
src/main.jsx
src/components/Header.jsx
liveframe-manifest.json
```

The manifest allows reimporting with full project metadata preservation.

---

## 8. External Resources

### Data Model

External resources are stored as part of the Project entity (not as separate files in the VFS). This is intentional — they are metadata about the project's runtime dependencies, not content the user edits.

```typescript
interface ExternalResource {
  /** Unique ID for this resource entry */
  id: string;
  /** Resource type determines injection method */
  type: 'css' | 'javascript';
  /** Full URL to the external resource */
  url: string;
  /** Human-readable label (auto-generated or user-provided) */
  label: string;
  /** Where to inject the resource in the HTML */
  placement: 'head' | 'body';
  /** Integrity hash for SRI (optional) */
  integrity?: string;
  /** Whether to use crossorigin attribute */
  crossOrigin?: 'anonymous' | 'use-credentials';
}
```

### Injection into Preview srcdoc

When generating the preview iframe content, external resources are injected based on their type and placement:

```typescript
function injectExternalResources(
  html: string,
  css: string,
  js: string,
  resources: ExternalResource[]
): string {
  // Separate resources by type and placement
  const headCss = resources.filter((r) => r.type === 'css' && r.placement === 'head');
  const headJs = resources.filter((r) => r.type === 'javascript' && r.placement === 'head');
  const bodyJs = resources.filter((r) => r.type === 'javascript' && r.placement === 'body');

  // Generate link/script tags
  const headCssTags = headCss.map((r) =>
    `<link rel="stylesheet" href="${escapeHtml(r.url)}"${r.integrity ? ` integrity="${r.integrity}"` : ''}${r.crossOrigin ? ` crossorigin="${r.crossOrigin}"` : ''}>`
  ).join('\n');

  const headJsTags = headJs.map((r) =>
    `<script src="${escapeHtml(r.url)}"${r.integrity ? ` integrity="${r.integrity}"` : ''}${r.crossOrigin ? ` crossorigin="${r.crossOrigin}"` : ''}><\/script>`
  ).join('\n');

  const bodyJsTags = bodyJs.map((r) =>
    `<script src="${escapeHtml(r.url)}"${r.integrity ? ` integrity="${r.integrity}"` : ''}${r.crossOrigin ? ` crossorigin="${r.crossOrigin}"` : ''}><\/script>`
  ).join('\n');

  // Build the final HTML
  // For single-file mode, assemble from the three canonical files
  // For project mode, use the index.html and inject
  return `<!DOCTYPE html>
<html>
<head>
  ${headCssTags}
  <style>${css}</style>
  ${headJsTags}
</head>
<body>
  ${html}
  <script>${js}<\/script>
  ${bodyJsTags}
</body>
</html>`;
}
```

For project mode with a custom `index.html`, the injection strategy is different — we parse the user's HTML and inject resources at the appropriate points:

```typescript
function injectResourcesIntoHtml(html: string, resources: ExternalResource[]): string {
  const headCss = resources.filter((r) => r.type === 'css' && r.placement === 'head');
  const headJs = resources.filter((r) => r.type === 'javascript' && r.placement === 'head');
  const bodyJs = resources.filter((r) => r.type === 'javascript' && r.placement === 'body');

  const headInjection = [
    ...headCss.map((r) => `<link rel="stylesheet" href="${escapeHtml(r.url)}">`),
    ...headJs.map((r) => `<script src="${escapeHtml(r.url)}"><\/script>`),
  ].join('\n');

  const bodyInjection = bodyJs.map((r) =>
    `<script src="${escapeHtml(r.url)}"><\/script>`
  ).join('\n');

  // Inject before </head> and </body>
  let result = html;
  if (headInjection && result.includes('</head>')) {
    result = result.replace('</head>', `${headInjection}\n</head>`);
  }
  if (bodyInjection && result.includes('</body>')) {
    result = result.replace('</body>', `${bodyInjection}\n</body>`);
  }

  return result;
}
```

### UI for Managing External Resources

The external resources UI is a panel accessible from the editor toolbar:

```tsx
const ExternalResourcesPanel: React.FC = () => {
  const project = useProjectStore((s) => s.activeProject);
  const addResource = useProjectStore((s) => s.addExternalResource);
  const removeResource = useProjectStore((s) => s.removeExternalResource);
  const reorderResources = useProjectStore((s) => s.reorderExternalResources);
  const [isOpen, setIsOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'css' | 'javascript'>('css');

  if (!project) return null;

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    
    // Auto-detect type from URL
    let type = newType;
    if (newUrl.endsWith('.css')) type = 'css';
    else if (newUrl.endsWith('.js') || newUrl.endsWith('.mjs')) type = 'javascript';

    // Extract label from URL
    const label = newUrl.split('/').pop()?.split('.')[0] ?? newUrl;

    addResource(project.id, {
      type,
      url: newUrl.trim(),
      label,
      placement: type === 'css' ? 'head' : 'body',
    });
    setNewUrl('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="w-4 h-4 mr-1" />
          Resources
          {project.externalResources.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {project.externalResources.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>External Resources</SheetTitle>
          <SheetDescription>
            Add CSS and JavaScript libraries from CDN URLs
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Add new resource form */}
          <div className="flex gap-2">
            <Select value={newType} onValueChange={(v) => setNewType(v as 'css' | 'javascript')}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="javascript">JS</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="https://cdn.example.com/lib.js"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} size="icon">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick-add presets */}
          <div className="flex flex-wrap gap-1">
            {COMMON_LIBRARIES.map((lib) => (
              <Button
                key={lib.name}
                variant="outline"
                size="sm"
                onClick={() => {
                  addResource(project.id, {
                    type: lib.type,
                    url: lib.url,
                    label: lib.name,
                    placement: lib.placement,
                  });
                }}
              >
                + {lib.name}
              </Button>
            ))}
          </div>

          {/* Resource list (sortable) */}
          <DndContext onDragEnd={handleDragEnd}>
            <SortableContext
              items={project.externalResources.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {project.externalResources.map((resource) => (
                <SortableResourceItem
                  key={resource.id}
                  resource={resource}
                  onRemove={() => removeResource(project.id, resource.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ─── Common Library Presets ────────────────────────────────

const COMMON_LIBRARIES: Array<{
  name: string;
  type: 'css' | 'javascript';
  url: string;
  placement: 'head' | 'body';
}> = [
  {
    name: 'Tailwind CSS',
    type: 'css',
    url: 'https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css',
    placement: 'head',
  },
  {
    name: 'Bootstrap',
    type: 'css',
    url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css',
    placement: 'head',
  },
  {
    name: 'Bootstrap JS',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js',
    placement: 'body',
  },
  {
    name: 'Alpine.js',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js',
    placement: 'head',
  },
  {
    name: 'Vue 3',
    type: 'javascript',
    url: 'https://unpkg.com/vue@3/dist/vue.global.js',
    placement: 'body',
  },
  {
    name: 'React',
    type: 'javascript',
    url: 'https://unpkg.com/react@18/umd/react.development.js',
    placement: 'body',
  },
  {
    name: 'ReactDOM',
    type: 'javascript',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    placement: 'body',
  },
  {
    name: 'Lodash',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js',
    placement: 'body',
  },
  {
    name: 'FontAwesome',
    type: 'css',
    url: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/css/all.min.css',
    placement: 'head',
  },
  {
    name: 'Three.js',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/three@0/build/three.min.js',
    placement: 'body',
  },
];
```

---

## 9. Starter Templates

### Template Design

Templates are immutable blueprints that initialize the VFS with predefined files and external resources. They are stored in IndexedDB (for user-created templates) and bundled with the app (for built-in templates).

```typescript
interface StarterTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: 'basic' | 'framework' | 'library' | 'game' | 'custom';
  /** Preview thumbnail (data URL or emoji) */
  thumbnail: string;
  /** Editor mode this template creates */
  mode: EditorMode;
  /** Files to create (path + content) */
  files: TemplateFile[];
  /** External resources to include */
  externalResources: ExternalResource[];
  /** Preview settings */
  previewSettings: PreviewSettings;
}

interface TemplateFile {
  /** File path relative to project root */
  path: string;
  /** File content (supports {{variable}} placeholders) */
  content: string;
}
```

### Built-in Templates

```typescript
const BUILTIN_TEMPLATES: StarterTemplate[] = [
  // ─── Blank ───────────────────────────────────────
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty project with minimal HTML structure',
    category: 'basic',
    thumbnail: '📄',
    mode: 'single-file',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  \n  <script src="script.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'style.css',
        content: `/* Styles for {{projectName}} */\n`,
      },
      {
        path: 'script.js',
        content: `// JavaScript for {{projectName}}\n`,
      },
    ],
    externalResources: [],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 300, viewport: 'desktop' },
  },

  // ─── HTML Boilerplate ────────────────────────────
  {
    id: 'html-boilerplate',
    name: 'HTML Boilerplate',
    description: 'Complete HTML5 boilerplate with meta tags, favicon, and Open Graph',
    category: 'basic',
    thumbnail: '🏗️',
    mode: 'single-file',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <meta name="description" content="Description of {{projectName}}">\n  <meta property="og:title" content="{{projectName}}">\n  <meta property="og:description" content="Description of {{projectName}}">\n  <title>{{projectName}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <header>\n    <nav>\n      <a href="/">Home</a>\n    </nav>\n  </header>\n  <main>\n    <h1>{{projectName}}</h1>\n    <p>Welcome to your project!</p>\n  </main>\n  <footer>\n    <p>&copy; 2026</p>\n  </footer>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'style.css',
        content: `/* Reset */\n*, *::before, *::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  line-height: 1.6;\n  color: #333;\n}\n\nheader {\n  background: #1a1a2e;\n  color: white;\n  padding: 1rem;\n}\n\nmain {\n  max-width: 800px;\n  margin: 2rem auto;\n  padding: 0 1rem;\n}\n\nfooter {\n  text-align: center;\n  padding: 2rem;\n  color: #666;\n}\n`,
      },
      {
        path: 'script.js',
        content: `// {{projectName}} JavaScript\n'use strict';\n\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('{{projectName}} loaded!');\n});\n`,
      },
    ],
    externalResources: [],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 300, viewport: 'desktop' },
  },

  // ─── Tailwind Starter ────────────────────────────
  {
    id: 'tailwind-starter',
    name: 'Tailwind CSS',
    description: 'Tailwind CSS via CDN with a sample component layout',
    category: 'library',
    thumbnail: '🎨',
    mode: 'single-file',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body class="bg-gray-100 min-h-screen">\n  <div class="container mx-auto px-4 py-8">\n    <header class="text-center mb-8">\n      <h1 class="text-4xl font-bold text-gray-800">{{projectName}}</h1>\n      <p class="text-gray-600 mt-2">Built with Tailwind CSS</p>\n    </header>\n    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\n      <div class="bg-white rounded-lg shadow-md p-6">\n        <h2 class="text-xl font-semibold mb-2">Card One</h2>\n        <p class="text-gray-600">Description for the first card.</p>\n      </div>\n      <div class="bg-white rounded-lg shadow-md p-6">\n        <h2 class="text-xl font-semibold mb-2">Card Two</h2>\n        <p class="text-gray-600">Description for the second card.</p>\n      </div>\n      <div class="bg-white rounded-lg shadow-md p-6">\n        <h2 class="text-xl font-semibold mb-2">Card Three</h2>\n        <p class="text-gray-600">Description for the third card.</p>\n      </div>\n    </div>\n  </div>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'style.css',
        content: `/* Custom styles (Tailwind handles most styling) */\n`,
      },
      {
        path: 'script.js',
        content: `// {{projectName}} with Tailwind CSS\n`,
      },
    ],
    externalResources: [
      {
        id: 'tw-css',
        type: 'css',
        url: 'https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css',
        label: 'Tailwind CSS',
        placement: 'head',
      },
    ],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 300, viewport: 'desktop' },
  },

  // ─── Bootstrap Starter ───────────────────────────
  {
    id: 'bootstrap-starter',
    name: 'Bootstrap 5',
    description: 'Bootstrap 5 with responsive navbar and grid layout',
    category: 'library',
    thumbnail: '🅱️',
    mode: 'single-file',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">\n    <div class="container">\n      <a class="navbar-brand" href="#">{{projectName}}</a>\n    </div>\n  </nav>\n  <div class="container mt-4">\n    <div class="row">\n      <div class="col-md-8">\n        <h1>Welcome!</h1>\n        <p class="lead">This is a Bootstrap 5 starter template.</p>\n      </div>\n      <div class="col-md-4">\n        <div class="card">\n          <div class="card-body">\n            <h5 class="card-title">Sidebar</h5>\n            <p class="card-text">Additional content here.</p>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'style.css',
        content: `/* Custom styles for {{projectName}} */\nbody {\n  min-height: 100vh;\n}\n`,
      },
      {
        path: 'script.js',
        content: `// {{projectName}} with Bootstrap 5\n`,
      },
    ],
    externalResources: [
      {
        id: 'bs-css',
        type: 'css',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css',
        label: 'Bootstrap CSS',
        placement: 'head',
      },
      {
        id: 'bs-js',
        type: 'javascript',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js',
        label: 'Bootstrap JS',
        placement: 'body',
      },
    ],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 300, viewport: 'desktop' },
  },

  // ─── Three.js Starter ────────────────────────────
  {
    id: 'threejs-starter',
    name: 'Three.js',
    description: '3D scene with rotating cube using Three.js',
    category: 'library',
    thumbnail: '🧊',
    mode: 'project',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n  <style>\n    body { margin: 0; overflow: hidden; }\n    canvas { display: block; }\n  </style>\n</head>\n<body>\n  <script src="js/main.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'js/main.js',
        content: `// {{projectName}} - Three.js Scene\n\nconst scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);\nconst renderer = new THREE.WebGLRenderer({ antialias: true });\nrenderer.setSize(window.innerWidth, window.innerHeight);\ndocument.body.appendChild(renderer.domElement);\n\nconst geometry = new THREE.BoxGeometry();\nconst material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });\nconst cube = new THREE.Mesh(geometry, material);\nscene.add(cube);\n\nconst light = new THREE.DirectionalLight(0xffffff, 1);\nlight.position.set(1, 1, 1);\nscene.add(light);\nscene.add(new THREE.AmbientLight(0x404040));\n\ncamera.position.z = 3;\n\nfunction animate() {\n  requestAnimationFrame(animate);\n  cube.rotation.x += 0.01;\n  cube.rotation.y += 0.01;\n  renderer.render(scene, camera);\n}\nanimate();\n\nwindow.addEventListener('resize', () => {\n  camera.aspect = window.innerWidth / window.innerHeight;\n  camera.updateProjectionMatrix();\n  renderer.setSize(window.innerWidth, window.innerHeight);\n});\n`,
      },
    ],
    externalResources: [
      {
        id: 'threejs',
        type: 'javascript',
        url: 'https://cdn.jsdelivr.net/npm/three@0/build/three.min.js',
        label: 'Three.js',
        placement: 'head',
      },
    ],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 500, viewport: 'desktop' },
  },

  // ─── Multi-file App ──────────────────────────────
  {
    id: 'multi-file-app',
    name: 'Multi-file App',
    description: 'Project mode with organized file structure',
    category: 'basic',
    thumbnail: '📁',
    mode: 'project',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n  <link rel="stylesheet" href="css/main.css">\n</head>\n<body>\n  <div id="app"></div>\n  <script src="js/app.js"><\/script>\n</body>\n</html>`,
      },
      {
        path: 'css/main.css',
        content: `/* Main styles */\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; }\n`,
      },
      {
        path: 'css/components.css',
        content: `/* Component styles */\n`,
      },
      {
        path: 'js/app.js',
        content: `// Main application entry point\nimport { init } from './modules/init.js';\n\ninit();\n`,
      },
      {
        path: 'js/modules/init.js',
        content: `// Initialization module\nexport function init() {\n  const app = document.getElementById('app');\n  app.innerHTML = '<h1>{{projectName}}</h1><p>App initialized!</p>';\n  console.log('{{projectName}} initialized');\n}\n`,
      },
      {
        path: 'js/modules/utils.js',
        content: `// Utility functions\nexport function debounce(fn, ms) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}\n`,
      },
    ],
    externalResources: [],
    previewSettings: { autoRefresh: true, refreshDebounceMs: 300, viewport: 'desktop' },
  },
];
```

### Template Application

```typescript
function applyTemplate(
  project: Project,
  templateId: string,
  projectName: string = project.name
): void {
  const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  const store = useProjectStore.getState();

  // Update project mode
  project.mode = template.mode;
  project.templateId = templateId;
  project.externalResources = template.externalResources.map((r) => ({
    ...r,
    id: nanoid(), // Generate new IDs
  }));
  project.previewSettings = { ...template.previewSettings };

  // Clear existing files
  for (const fileId of project.fileIds) {
    delete store.files[fileId];
  }
  project.fileIds = [];

  // Create files from template
  for (const templateFile of template.files) {
    const fileId = nanoid() as FileId;
    const content = templateFile.content.replace(/\{\{projectName\}\}/g, projectName);
    const name = templateFile.path.split('/').pop()!;

    const file: FileEntry = {
      id: fileId,
      projectId: project.id,
      path: templateFile.path,
      name,
      type: getFileType(name),
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDirty: false,
      isVirtual: template.mode === 'single-file',
    };

    store.files[fileId] = file;
    project.fileIds.push(fileId);

    // Load content into editor store
    useEditorStore.getState().loadContents([{ fileId, content }]);
  }

  // Set first file as active
  project.activeFileId = project.fileIds[0] ?? null;
}
```

### Template Picker UI

```tsx
const TemplatePicker: React.FC<{ onSelect: (templateId: string) => void }> = ({ onSelect }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set(BUILTIN_TEMPLATES.map((t) => t.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredTemplates = useMemo(() => {
    return BUILTIN_TEMPLATES.filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Create New Project</h2>
      <p className="text-muted-foreground mb-6">Choose a template to get started</p>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
            onClick={() => onSelect(template.id)}
          >
            <CardHeader>
              <div className="text-3xl mb-2">{template.thumbnail}</div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{template.mode === 'single-file' ? 'Single' : 'Project'}</Badge>
                <span>{template.files.length} files</span>
                {template.externalResources.length > 0 && (
                  <span>{template.externalResources.length} deps</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

---

## 10. Undo/Redo & History

### Per-File Undo: CodeMirror's Built-in History

CodeMirror 6 has a powerful built-in undo/redo system that operates on `Transaction` objects. Each editor view maintains its own history stack, scoped to that specific document. This means per-file undo works out of the box — each CodeMirror `EditorView` instance tracks its own changes independently.

```typescript
import { history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

// CodeMirror extensions for undo/redo support
const editorExtensions = [
  history(), // Enable history tracking
  keymap.of([
    ...historyKeymap, // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y bindings
  ]),
];
```

The history extension provides:

- **`undo()`**: Undoes the last change group (Ctrl+Z / Cmd+Z)
- **`redo()`**: Redoes the last undone change (Ctrl+Shift+Z / Ctrl+Y)
- **Change grouping**: Multiple rapid changes (like a word being typed) are grouped into a single undo step
- **Selection restoration**: Cursor positions are restored along with the text changes
- **Configurable**: `history({ minDepth: 100, newGroupDelay: 500 })` — `minDepth` controls how many transactions are kept, `newGroupDelay` controls how long (in ms) changes are grouped together

```typescript
// Custom history configuration
const historyExtension = history({
  minDepth: 500,        // Keep at least 500 transactions
  newGroupDelay: 300,   // Group changes within 300ms
});
```

### Syncing CodeMirror History with the Store

When a user undoes or redoes in CodeMirror, the content changes must be reflected in the Zustand store. This is handled via the `EditorView.update` listener:

```typescript
import { EditorView, ViewUpdate } from '@codemirror/view';

function createEditorUpdateListener(fileId: FileId): Extension {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged) {
      const newContent = update.state.doc.toString();
      useEditorStore.getState().updateContent(fileId, newContent);
    }

    if (update.selectionSet) {
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos);
      useEditorStore.getState().saveCursorPosition(fileId, line.number, pos - line.from);
    }
  });
}
```

### Cross-File Undo: The Challenge and a Pragmatic Solution

Cross-file undo (where undoing in file B after editing file A would undo file A's changes) is technically possible but introduces significant complexity and UX confusion. Our recommendation is **not to implement cross-file undo** in the initial version, for the following reasons:

1. **User expectations**: Users expect undo to work within the current editor context. Cross-file undo would be surprising.
2. **Complexity**: Requires a global operation log that tracks which file each operation belongs to, with careful handling of inter-file dependencies.
3. **Edge cases**: What happens when a file referenced by an undo step has been deleted?
4. **VS Code precedent**: VS Code also uses per-file undo — there is no cross-file undo even in multi-file projects.

However, if cross-file undo is desired in the future, here is the architecture:

```typescript
// ─── Cross-File Undo Architecture (future) ────────────────

interface GlobalHistoryEntry {
  id: string;
  timestamp: number;
  fileId: FileId;
  type: 'content-change' | 'file-create' | 'file-delete' | 'file-rename';
  // For content changes, store the CodeMirror transaction
  transaction?: Transaction;
  // For structural operations, store before/after state
  before?: Partial<FileEntry>;
  after?: Partial<FileEntry>;
}

interface GlobalHistoryState {
  entries: GlobalHistoryEntry[];
  currentIndex: number; // Points to the next entry to undo
}

// The global undo stack would wrap CodeMirror's per-file history
// and add structural operations (create, delete, rename) to the same stack.
// When the user hits Ctrl+Z:
// 1. Check if the global history's current entry is for the active file
// 2. If yes, delegate to CodeMirror's undo()
// 3. If no (it's for a different file), switch to that file and undo there
// 4. If it's a structural operation, reverse it (e.g., undo file creation = delete)
```

### Undo for Structural Operations

While content undo is handled by CodeMirror, structural operations (file creation, deletion, renaming) need their own undo mechanism. We implement this at the store level:

```typescript
interface StructuralHistoryEntry {
  id: string;
  timestamp: number;
  operation: 'create-file' | 'delete-file' | 'rename-file' | 'create-directory' | 'move-file';
  /** Snapshot of affected data before the operation */
  before: {
    file?: FileEntry;        // For delete/rename: the file before the change
    path?: string;           // For move/rename: the old path
  };
  /** Snapshot of affected data after the operation */
  after: {
    file?: FileEntry;        // For create/rename: the file after the change
    path?: string;           // For move/rename: the new path
  };
}

interface StructuralHistoryState {
  entries: StructuralHistoryEntry[];
  currentIndex: number;
  maxEntries: number;
}

// In the store:
const useStructuralHistoryStore = create<StructuralHistoryState>()(
  immer((set, get) => ({
    entries: [],
    currentIndex: -1,
    maxEntries: 50,

    push: (entry: Omit<StructuralHistoryEntry, 'id' | 'timestamp'>) => {
      set((state) => {
        // Truncate any redo entries
        state.entries = state.entries.slice(0, state.currentIndex + 1);
        
        state.entries.push({
          ...entry,
          id: nanoid(),
          timestamp: Date.now(),
        });

        // Trim to max size
        if (state.entries.length > state.maxEntries) {
          state.entries = state.entries.slice(-state.maxEntries);
        }

        state.currentIndex = state.entries.length - 1;
      });
    },

    undo: () => {
      const state = get();
      if (state.currentIndex < 0) return;

      const entry = state.entries[state.currentIndex];
      
      switch (entry.operation) {
        case 'create-file':
          // Undo: delete the file
          useProjectStore.getState().deleteFile(entry.after.file!.id);
          break;
        case 'delete-file':
          // Undo: recreate the file
          useProjectStore.getState().addFile(
            entry.before.file!.projectId,
            entry.before.file!.path,
            entry.before.file!.content ?? ''
          );
          break;
        case 'rename-file':
          // Undo: rename back
          useProjectStore.getState().renameFile(
            entry.after.file!.id,
            entry.before.path!
          );
          break;
        case 'move-file':
          // Undo: move back
          useProjectStore.getState().moveFile(
            entry.after.file!.id,
            entry.before.path!
          );
          break;
      }

      set((state) => {
        state.currentIndex--;
      });
    },

    redo: () => {
      const state = get();
      if (state.currentIndex >= state.entries.length - 1) return;

      const entry = state.entries[state.currentIndex + 1];
      
      switch (entry.operation) {
        case 'create-file':
          useProjectStore.getState().addFile(
            entry.after.file!.projectId,
            entry.after.file!.path,
            entry.after.file!.content ?? ''
          );
          break;
        case 'delete-file':
          useProjectStore.getState().deleteFile(entry.before.file!.id);
          break;
        case 'rename-file':
          useProjectStore.getState().renameFile(
            entry.after.file!.id,
            entry.after.path!
          );
          break;
        case 'move-file':
          useProjectStore.getState().moveFile(
            entry.after.file!.id,
            entry.after.path!
          );
          break;
      }

      set((state) => {
        state.currentIndex++;
      });
    },
  }))
);
```

### Keyboard Shortcut Integration

```typescript
// Global keyboard shortcuts for undo/redo
function useGlobalKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl+Z — Undo (delegate to active CodeMirror editor)
      if (isMod && !e.shiftKey && e.key === 'z') {
        // CodeMirror handles this natively when the editor is focused.
        // But we also need to handle structural undo when the editor is not focused
        // (e.g., when the file tree is focused).
        const activeView = getActiveEditorView();
        if (activeView) {
          // Let CodeMirror handle it
          return;
        }
        e.preventDefault();
        useStructuralHistoryStore.getState().undo();
      }

      // Ctrl+Shift+Z or Ctrl+Y — Redo
      if (isMod && (e.shiftKey && e.key === 'z') || (e.key === 'y')) {
        const activeView = getActiveEditorView();
        if (activeView) {
          return; // CodeMirror handles it
        }
        e.preventDefault();
        useStructuralHistoryStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

### Summary: Undo/Redo Strategy

| Operation Type | Undo Mechanism | Scope |
|---------------|---------------|-------|
| Text editing | CodeMirror built-in history | Per-file |
| File creation | Custom structural history | Global |
| File deletion | Custom structural history | Global |
| File renaming | Custom structural history | Global |
| File moving | Custom structural history | Global |
| Mode switching | Not undoable (irreversible UI change) | — |
| External resource changes | Custom structural history (future) | Global |

The dual-layer approach (CodeMirror for content, custom store for structure) provides a clean separation of concerns while giving the user a natural undo experience.

---

## Appendix: Dependency List

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^4.x | State management |
| `immer` | ^10.x | Immutable state updates |
| `nanoid` | ^5.x | Unique ID generation |
| `idb` | ^8.x | IndexedDB wrapper |
| `fflate` | ^0.8.x | ZIP compression/decompression |
| `@codemirror/commands` | ^6.x | Editor commands including history |
| `@tanstack/react-virtual` | ^3.x | Virtualized list for file tree |
| `@dnd-kit/core` | ^6.x | Drag-and-drop for file tree |
| `@dnd-kit/sortable` | ^8.x | Sortable lists for resource ordering |
| `@radix-ui/react-context-menu` | ^1.x | Context menu primitives |
| `lucide-react` | ^0.x | File type icons |

---

*End of Report*
