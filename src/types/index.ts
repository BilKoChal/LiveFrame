/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'light' | 'dark' | 'system';

export type ActiveTab = 'html' | 'css' | 'javascript';

export interface ConsoleEntry {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
}

// Re-export project types for convenience
export type {
  ProjectId,
  FileId,
  FileEntry,
  FileType,
  Project,
  EditorMode,
  ExternalResource,
  PreviewSettings,
  Workspace,
  WorkspaceSettings,
  TreeNode,
  FlatTreeNode,
} from './project';

export {
  createProjectId,
  createFileId,
  isProjectId,
  isFileId,
  getFileType,
  VIRTUAL_PROJECT_ID,
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from './project';
