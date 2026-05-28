/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ─── Branded Identifiers ──────────────────────────────────────
// Prefix-based branded types for compile-time safety and runtime debuggability.
// Template literal patterns prevent accidental cross-assignment.

/** Unique identifier for a project (prefixed `proj_`) */
export type ProjectId = `proj_${string}`;

/** Unique identifier for a file (prefixed `file_`) */
export type FileId = `file_${string}`;

/** Factory functions — the only approved creation paths */
export function createProjectId(): ProjectId {
  return `proj_${crypto.randomUUID()}`;
}

export function createFileId(): FileId {
  return `file_${crypto.randomUUID()}`;
}

/** Type guards for runtime validation */
export function isProjectId(id: string): id is ProjectId {
  return id.startsWith('proj_');
}

export function isFileId(id: string): id is FileId {
  return id.startsWith('file_');
}

// ─── Constants for Virtual Project ────────────────────────────

/** Stable IDs for the default single-file virtual project */
export const VIRTUAL_PROJECT_ID = 'proj_virtual_default' as ProjectId;
export const VIRTUAL_HTML_FILE_ID = 'file_virtual_html' as FileId;
export const VIRTUAL_CSS_FILE_ID = 'file_virtual_css' as FileId;
export const VIRTUAL_JS_FILE_ID = 'file_virtual_js' as FileId;

// ─── File Types ───────────────────────────────────────────────

/** File type discriminator derived from extension */
export type FileType =
  | 'html'
  | 'css'
  | 'javascript'
  | 'json'
  | 'markdown'
  | 'text'
  | 'image'
  | 'other';

/** Editor mode — determines which UI shell to render */
export type EditorMode = 'single-file' | 'project';

// ─── Extension → FileType Mapping ────────────────────────────

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

/** Derive the FileType from a filename extension */
export function getFileType(filename: string): FileType {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return 'text';
  const ext = filename.substring(dotIndex).toLowerCase();
  return EXTENSION_TYPE_MAP[ext] ?? 'other';
}

// ─── Core Data Interfaces ─────────────────────────────────────

export interface FileEntry {
  /** Unique file identifier */
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

export interface ExternalResource {
  id: string;
  /** 'css' for <link> or 'javascript' for <script> */
  type: 'css' | 'javascript';
  /** Full URL to the resource */
  url: string;
  /** Display label */
  label: string;
  /** Loading strategy */
  placement: 'head' | 'body';
}

export interface PreviewSettings {
  /** Auto-refresh preview on code change */
  autoRefresh: boolean;
  /** Debounce delay in ms before refreshing */
  refreshDebounceMs: number;
  /** Preview viewport size preset */
  viewport: 'desktop' | 'tablet' | 'mobile' | 'custom';
  /** Custom viewport dimensions */
  customViewport?: { width: number; height: number };
}

export interface Project {
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

export interface WorkspaceSettings {
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

export interface Workspace {
  /** Currently active project */
  activeProjectId: ProjectId | null;
  /** All project IDs in the workspace */
  projectIds: ProjectId[];
  /** Global editor settings */
  settings: WorkspaceSettings;
  /** Recently opened project IDs (max 10) */
  recentProjectIds: ProjectId[];
}

// ─── Tree Node (for UI consumption) ──────────────────────────

export interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  fileType?: FileType;
  isDirty?: boolean;
  fileId?: FileId;
  children: TreeNode[];
}

// ─── Flat Tree Node (for virtualized rendering) ──────────────

export interface FlatTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  depth: number;
  fileId?: FileId;
  fileType?: FileType;
  isDirty?: boolean;
  isExpanded?: boolean;
  path: string;
}
