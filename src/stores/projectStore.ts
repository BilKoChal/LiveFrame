/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import type {
  ProjectId,
  FileId,
  FileEntry,
  Project,
  Workspace,
  EditorMode,
  ExternalResource,
  PreviewSettings,
} from '../types/project';
import {
  createProjectId,
  createFileId,
  getFileType,
  VIRTUAL_PROJECT_ID,
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from '../types/project';
import { DEFAULT_HTML, DEFAULT_CSS, DEFAULT_JS } from '../constants/defaultContent';

// ─── Default content for virtual project ──────────────────────
// (imported from src/constants/defaultContent.ts — single source of truth)

// ─── Create Default Virtual Project ───────────────────────────

function createVirtualProjectFiles(projectId: ProjectId): FileEntry[] {
  const now = new Date().toISOString();
  return [
    {
      id: VIRTUAL_HTML_FILE_ID,
      projectId,
      path: 'index.html',
      name: 'index.html',
      type: 'html',
      content: DEFAULT_HTML,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      isVirtual: true,
    },
    {
      id: VIRTUAL_CSS_FILE_ID,
      projectId,
      path: 'style.css',
      name: 'style.css',
      type: 'css',
      content: DEFAULT_CSS,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      isVirtual: true,
    },
    {
      id: VIRTUAL_JS_FILE_ID,
      projectId,
      path: 'script.js',
      name: 'script.js',
      type: 'javascript',
      content: DEFAULT_JS,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      isVirtual: true,
    },
  ];
}

function createVirtualProject(): {
  project: Project;
  files: FileEntry[];
} {
  const now = new Date().toISOString();
  const project: Project = {
    id: VIRTUAL_PROJECT_ID,
    name: 'Untitled',
    mode: 'single-file',
    fileIds: [VIRTUAL_HTML_FILE_ID, VIRTUAL_CSS_FILE_ID, VIRTUAL_JS_FILE_ID],
    externalResources: [],
    createdAt: now,
    updatedAt: now,
    activeFileId: VIRTUAL_HTML_FILE_ID,
    templateId: null,
    previewSettings: {
      autoRefresh: true,
      refreshDebounceMs: 400,
      viewport: 'desktop',
    },
  };

  const files = createVirtualProjectFiles(project.id);

  return { project, files };
}

// ─── Store Interface ──────────────────────────────────────────

interface ProjectState {
  // ─── State ────────────────────────────────────────────────
  /** Currently active project */
  activeProject: Project | null;
  /** Map of all files by ID */
  files: Record<FileId, FileEntry>;
  /** All projects (metadata) */
  projects: Record<ProjectId, Project>;
  /** Workspace-level settings */
  workspace: Workspace;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Whether the initial hydration from IndexedDB is complete */
  isHydrated: boolean;

  // ─── Project Actions ──────────────────────────────────────
  createProject: (name: string, mode: EditorMode) => ProjectId;
  deleteProject: (projectId: ProjectId) => void;
  duplicateProject: (projectId: ProjectId, newName: string) => ProjectId;
  renameProject: (projectId: ProjectId, newName: string) => void;
  setActiveProject: (projectId: ProjectId) => void;
  loadProject: (projectId: ProjectId) => void;

  // ─── File Actions ─────────────────────────────────────────
  addFile: (projectId: ProjectId, path: string, content?: string) => FileId;
  deleteFile: (fileId: FileId) => void;
  renameFile: (fileId: FileId, newPath: string) => void;
  moveFile: (fileId: FileId, newDirectoryPath: string) => void;
  duplicateFile: (fileId: FileId, newPath: string) => FileId;
  setActiveFile: (fileId: FileId | null) => void;
  updateFileContent: (fileId: FileId, content: string) => void;
  markFileClean: (fileId: FileId) => void;

  // ─── External Resources ───────────────────────────────────
  addExternalResource: (
    projectId: ProjectId,
    resource: Omit<ExternalResource, 'id'>
  ) => void;
  removeExternalResource: (projectId: ProjectId, resourceId: string) => void;

  // ─── Mode Switching ───────────────────────────────────────
  switchToProjectMode: (projectId: ProjectId) => void;
  switchToSingleFileMode: (projectId: ProjectId) => void;

  // ─── Virtual Project ──────────────────────────────────────
  initVirtualProject: () => void;
  resetVirtualProject: () => void;
  isVirtualProject: () => boolean;

  // ─── Hydration ────────────────────────────────────────────
  hydrateFromIndexedDB: (
    projects: Record<ProjectId, Project>,
    files: Record<FileId, FileEntry>
  ) => void;
  setHydrated: (value: boolean) => void;

  // ─── Utility ──────────────────────────────────────────────
  getFileByPath: (projectId: ProjectId, path: string) => FileEntry | undefined;
  getFilesByProject: (projectId: ProjectId) => FileEntry[];
  clearError: () => void;
}

// ─── Store Implementation ─────────────────────────────────────

export const useProjectStore = create<ProjectState>()((set, get) => {
  const virtual = createVirtualProject();

  return {
    // ─── Initial State ──────────────────────────────────────
    activeProject: virtual.project,
    files: Object.fromEntries(virtual.files.map((f) => [f.id, f])) as Record<
      FileId,
      FileEntry
    >,
    projects: { [virtual.project.id]: virtual.project },
    workspace: {
      activeProjectId: VIRTUAL_PROJECT_ID,
      projectIds: [VIRTUAL_PROJECT_ID],
      settings: {
        theme: 'dark',
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        tabSize: 2,
        wordWrap: true,
        autoSaveIntervalMs: 3000,
        defaultMode: 'single-file',
      },
      recentProjectIds: [VIRTUAL_PROJECT_ID],
    },
    isLoading: false,
    error: null,
    isHydrated: false,

    // ─── Create Project ─────────────────────────────────────
    createProject: (name, mode) => {
      const projectId = createProjectId();
      const now = new Date().toISOString();

      // For single-file mode, create 3 default files
      const htmlFileId = createFileId();
      const cssFileId = createFileId();
      const jsFileId = createFileId();

      const project: Project = {
        id: projectId,
        name,
        mode,
        fileIds: [htmlFileId, cssFileId, jsFileId],
        externalResources: [],
        createdAt: now,
        updatedAt: now,
        activeFileId: htmlFileId,
        templateId: null,
        previewSettings: {
          autoRefresh: true,
          refreshDebounceMs: 400,
          viewport: 'desktop',
        },
      };

      const files: FileEntry[] = [
        {
          id: htmlFileId,
          projectId,
          path: 'index.html',
          name: 'index.html',
          type: 'html',
          content: '<h1>Hello World</h1>',
          createdAt: now,
          updatedAt: now,
          isDirty: false,
          isVirtual: mode === 'single-file',
        },
        {
          id: cssFileId,
          projectId,
          path: 'style.css',
          name: 'style.css',
          type: 'css',
          content: 'body { font-family: system-ui; }',
          createdAt: now,
          updatedAt: now,
          isDirty: false,
          isVirtual: mode === 'single-file',
        },
        {
          id: jsFileId,
          projectId,
          path: 'script.js',
          name: 'script.js',
          type: 'javascript',
          content: "// Your code here\nconsole.log('Hello!');",
          createdAt: now,
          updatedAt: now,
          isDirty: false,
          isVirtual: mode === 'single-file',
        },
      ];

      set((state) => ({
        projects: { ...state.projects, [projectId]: project },
        files: {
          ...state.files,
          ...Object.fromEntries(files.map((f) => [f.id, f])),
        },
        workspace: {
          ...state.workspace,
          projectIds: [...state.workspace.projectIds, projectId],
          recentProjectIds: [
            projectId,
            ...state.workspace.recentProjectIds.filter((id) => id !== projectId),
          ].slice(0, 10),
        },
      }));

      return projectId;
    },

    // ─── Delete Project ─────────────────────────────────────
    deleteProject: (projectId) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        const newFiles = { ...state.files };
        for (const fileId of project.fileIds) {
          delete newFiles[fileId];
        }

        const newProjects = { ...state.projects };
        delete newProjects[projectId];

        const isActive = state.activeProject?.id === projectId;

        return {
          projects: newProjects,
          files: newFiles,
          activeProject: isActive ? null : state.activeProject,
          workspace: {
            ...state.workspace,
            projectIds: state.workspace.projectIds.filter(
              (id) => id !== projectId
            ),
            recentProjectIds: state.workspace.recentProjectIds.filter(
              (id) => id !== projectId
            ),
            activeProjectId:
              state.workspace.activeProjectId === projectId
                ? null
                : state.workspace.activeProjectId,
          },
        };
      });
    },

    // ─── Duplicate Project ──────────────────────────────────
    duplicateProject: (projectId, newName) => {
      const state = get();
      const original = state.projects[projectId];
      if (!original) return projectId;

      const newProjectId = createProjectId();
      const now = new Date().toISOString();

      // Clone files with new IDs
      const newFileIds: FileId[] = [];
      const newFiles: Record<FileId, FileEntry> = {};

      for (const oldFileId of original.fileIds) {
        const oldFile = state.files[oldFileId];
        if (!oldFile) continue;

        const newFileId = createFileId();
        newFileIds.push(newFileId);
        newFiles[newFileId] = {
          ...oldFile,
          id: newFileId,
          projectId: newProjectId,
          isDirty: false,
          isVirtual: false,
          createdAt: now,
          updatedAt: now,
        };
      }

      const newProject: Project = {
        ...original,
        id: newProjectId,
        name: newName,
        fileIds: newFileIds,
        activeFileId: newFileIds[0] ?? null,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => ({
        projects: { ...state.projects, [newProjectId]: newProject },
        files: { ...state.files, ...newFiles },
        workspace: {
          ...state.workspace,
          projectIds: [...state.workspace.projectIds, newProjectId],
          recentProjectIds: [newProjectId, ...state.workspace.recentProjectIds].slice(0, 10),
        },
      }));

      return newProjectId;
    },

    // ─── Rename Project ─────────────────────────────────────
    renameProject: (projectId, newName) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              name: newName,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },

    // ─── Set Active Project ─────────────────────────────────
    setActiveProject: (projectId) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        return {
          activeProject: project,
          workspace: {
            ...state.workspace,
            activeProjectId: projectId,
            recentProjectIds: [
              projectId,
              ...state.workspace.recentProjectIds.filter(
                (id) => id !== projectId
              ),
            ].slice(0, 10),
          },
        };
      });
    },

    // ─── Load Project ───────────────────────────────────────
    loadProject: (projectId) => {
      const state = get();
      const project = state.projects[projectId];
      if (!project) return;

      set({
        activeProject: project,
        workspace: {
          ...state.workspace,
          activeProjectId: projectId,
          recentProjectIds: [
            projectId,
            ...state.workspace.recentProjectIds.filter(
              (id) => id !== projectId
            ),
          ].slice(0, 10),
        },
      });
    },

    // ─── Add File ───────────────────────────────────────────
    addFile: (projectId, path, content = '') => {
      const fileId = createFileId();
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

      set((state) => ({
        files: { ...state.files, [fileId]: file },
        projects: state.projects[projectId]
          ? {
              ...state.projects,
              [projectId]: {
                ...state.projects[projectId],
                fileIds: [...state.projects[projectId].fileIds, fileId],
                updatedAt: now,
              },
            }
          : state.projects,
      }));

      return fileId;
    },

    // ─── Delete File ────────────────────────────────────────
    deleteFile: (fileId) => {
      set((state) => {
        const file = state.files[fileId];
        if (!file) return state;

        const project = state.projects[file.projectId];
        if (!project) return state;

        const newFiles = { ...state.files };
        delete newFiles[fileId];

        const updatedActiveFileId =
          project.activeFileId === fileId
            ? project.fileIds.filter((id) => id !== fileId)[0] ?? null
            : project.activeFileId;

        return {
          files: newFiles,
          projects: {
            ...state.projects,
            [project.id]: {
              ...project,
              fileIds: project.fileIds.filter((id) => id !== fileId),
              activeFileId: updatedActiveFileId,
              updatedAt: new Date().toISOString(),
            },
          },
          activeProject:
            state.activeProject?.id === project.id
              ? {
                  ...state.activeProject,
                  fileIds: state.activeProject.fileIds.filter(
                    (id) => id !== fileId
                  ),
                  activeFileId: updatedActiveFileId,
                }
              : state.activeProject,
        };
      });
    },

    // ─── Rename File ────────────────────────────────────────
    renameFile: (fileId, newPath) => {
      set((state) => {
        const file = state.files[fileId];
        if (!file) return state;

        const name = newPath.split('/').pop()!;

        return {
          files: {
            ...state.files,
            [fileId]: {
              ...file,
              path: newPath,
              name,
              type: getFileType(name),
              updatedAt: new Date().toISOString(),
              isDirty: true,
            },
          },
        };
      });
    },

    // ─── Move File ──────────────────────────────────────────
    moveFile: (fileId, newDirectoryPath) => {
      set((state) => {
        const file = state.files[fileId];
        if (!file) return state;

        const newPath = newDirectoryPath
          ? `${newDirectoryPath}/${file.name}`
          : file.name;

        return {
          files: {
            ...state.files,
            [fileId]: {
              ...file,
              path: newPath,
              updatedAt: new Date().toISOString(),
              isDirty: true,
            },
          },
        };
      });
    },

    // ─── Duplicate File ─────────────────────────────────────
    duplicateFile: (fileId, newPath) => {
      const state = get();
      const original = state.files[fileId];
      if (!original) return fileId;

      const newFileId = createFileId();
      const name = newPath.split('/').pop()!;
      const now = new Date().toISOString();

      const newFile: FileEntry = {
        id: newFileId,
        projectId: original.projectId,
        path: newPath,
        name,
        type: getFileType(name),
        content: original.content,
        createdAt: now,
        updatedAt: now,
        isDirty: false,
        isVirtual: false,
      };

      set((state) => ({
        files: { ...state.files, [newFileId]: newFile },
        projects: state.projects[original.projectId]
          ? {
              ...state.projects,
              [original.projectId]: {
                ...state.projects[original.projectId],
                fileIds: [
                  ...state.projects[original.projectId].fileIds,
                  newFileId,
                ],
                updatedAt: now,
              },
            }
          : state.projects,
      }));

      return newFileId;
    },

    // ─── Set Active File ────────────────────────────────────
    setActiveFile: (fileId) => {
      set((state) => {
        if (!state.activeProject) return state;

        return {
          activeProject: {
            ...state.activeProject,
            activeFileId: fileId,
          },
          projects: {
            ...state.projects,
            [state.activeProject.id]: {
              ...state.projects[state.activeProject.id],
              activeFileId: fileId,
            },
          },
        };
      });
    },

    // ─── Update File Content ────────────────────────────────
    updateFileContent: (fileId, content) => {
      set((state) => {
        const file = state.files[fileId];
        if (!file) return state;

        return {
          files: {
            ...state.files,
            [fileId]: {
              ...file,
              content,
              isDirty: true,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },

    // ─── Mark File Clean ────────────────────────────────────
    markFileClean: (fileId) => {
      set((state) => {
        const file = state.files[fileId];
        if (!file) return state;

        return {
          files: {
            ...state.files,
            [fileId]: { ...file, isDirty: false },
          },
        };
      });
    },

    // ─── External Resources ─────────────────────────────────
    addExternalResource: (projectId, resource) => {
      const resourceId = `res_${crypto.randomUUID()}`;
      const newResource: ExternalResource = { id: resourceId, ...resource };

      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              externalResources: [
                ...project.externalResources,
                newResource,
              ],
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },

    removeExternalResource: (projectId, resourceId) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              externalResources: project.externalResources.filter(
                (r) => r.id !== resourceId
              ),
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },

    // ─── Switch to Project Mode ─────────────────────────────
    switchToProjectMode: (projectId) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        // Promote virtual files to real files
        const updatedFiles = { ...state.files };
        for (const fileId of project.fileIds) {
          const file = updatedFiles[fileId];
          if (file?.isVirtual) {
            updatedFiles[fileId] = { ...file, isVirtual: false };
          }
        }

        const updatedProject: Project = {
          ...project,
          mode: 'project',
          updatedAt: new Date().toISOString(),
        };

        return {
          projects: { ...state.projects, [projectId]: updatedProject },
          files: updatedFiles,
          activeProject:
            state.activeProject?.id === projectId
              ? updatedProject
              : state.activeProject,
        };
      });
    },

    // ─── Switch to Single File Mode ─────────────────────────
    switchToSingleFileMode: (projectId) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        const updatedProject: Project = {
          ...project,
          mode: 'single-file',
          updatedAt: new Date().toISOString(),
        };

        return {
          projects: { ...state.projects, [projectId]: updatedProject },
          activeProject:
            state.activeProject?.id === projectId
              ? updatedProject
              : state.activeProject,
        };
      });
    },

    // ─── Virtual Project ────────────────────────────────────
    initVirtualProject: () => {
      const v = createVirtualProject();
      set((state) => ({
        activeProject: v.project,
        files: {
          ...state.files,
          ...Object.fromEntries(v.files.map((f) => [f.id, f])),
        },
        projects: { ...state.projects, [v.project.id]: v.project },
      }));
    },

    resetVirtualProject: () => {
      const v = createVirtualProject();
      set({
        activeProject: v.project,
        files: Object.fromEntries(v.files.map((f) => [f.id, f])) as Record<
          FileId,
          FileEntry
        >,
        projects: { [v.project.id]: v.project },
      });
    },

    isVirtualProject: () => {
      return get().activeProject?.id === VIRTUAL_PROJECT_ID;
    },

    // ─── Hydration ──────────────────────────────────────────
    hydrateFromIndexedDB: (projects, files) => {
      set((state) => ({
        projects: { ...state.projects, ...projects },
        files: { ...state.files, ...files },
        isHydrated: true,
      }));
    },

    setHydrated: (value) => {
      set({ isHydrated: value });
    },

    // ─── Utility ────────────────────────────────────────────
    getFileByPath: (projectId, path) => {
      return Object.values(get().files).find(
        (f) => f.projectId === projectId && f.path === path
      );
    },

    getFilesByProject: (projectId) => {
      const project = get().projects[projectId];
      if (!project) return [];
      return project.fileIds
        .map((id) => get().files[id])
        .filter(Boolean);
    },

    clearError: () => set({ error: null }),
  };
});
