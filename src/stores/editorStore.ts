/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { ActiveTab } from '../types';
import type { FileId } from '../types/project';
import {
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from '../types/project';
import { DEFAULT_HTML, DEFAULT_CSS, DEFAULT_JS } from '../constants/defaultContent';

// Lazy import to avoid circular dependency — projectStore is only needed for sync
let _useProjectStore: typeof import('./projectStore').useProjectStore | null = null;
function getProjectStore() {
  if (!_useProjectStore) {
    _useProjectStore = require('./projectStore').useProjectStore;
  }
  return _useProjectStore!;
}

// ─── Legacy Single-File Interface (backward compatible) ───────

interface EditorState {
  // ─── Legacy single-file state (backward compatible) ──────
  html: string;
  css: string;
  javascript: string;
  activeTab: ActiveTab;
  setHtml: (html: string) => void;
  setCss: (css: string) => void;
  setJavascript: (js: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  resetAll: () => void;

  // ─── Project mode state ──────────────────────────────────
  /** Content of each file, keyed by FileId */
  fileContents: Record<FileId, string>;
  /** Dirty state per file */
  dirtyMap: Record<FileId, boolean>;
  /** Open tab IDs (ordered) */
  openTabIds: FileId[];
  /** Currently active file tab */
  activeFileId: FileId | null;

  // ─── Project mode actions ────────────────────────────────
  updateFileContent: (fileId: FileId, content: string) => void;
  markFileClean: (fileId: FileId) => void;
  markAllClean: () => void;
  setActiveFileId: (fileId: FileId | null) => void;
  openTab: (fileId: FileId) => void;
  closeTab: (fileId: FileId) => void;
  closeOtherTabs: (keepFileId: FileId) => void;
  closeTabsToRight: (fileId: FileId) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  loadFileContents: (entries: { fileId: FileId; content: string }[]) => void;
  clearProjectState: () => void;

  // ─── Sync helpers ────────────────────────────────────────
  /** Sync legacy html/css/javascript from project store virtual files */
  syncFromVirtualFiles: (
    htmlContent: string,
    cssContent: string,
    jsContent: string
  ) => void;
  /** Get the active file's content (works for both modes) */
  getActiveContent: () => string;
  /** Get the active file's file type */
  getActiveFileType: () => 'html' | 'css' | 'javascript';
}



export const useEditorStore = create<EditorState>()((set, get) => ({
  // ─── Legacy Single-File State ───────────────────────────
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  javascript: DEFAULT_JS,
  activeTab: 'html' as ActiveTab,

  setHtml: (html) => set({ html }),
  setCss: (css) => set({ css }),
  setJavascript: (javascript) => set({ javascript }),
  setActiveTab: (activeTab) => set({ activeTab }),

  resetAll: () =>
    set({
      html: DEFAULT_HTML,
      css: DEFAULT_CSS,
      javascript: DEFAULT_JS,
      activeTab: 'html' as ActiveTab,
    }),

  // ─── Project Mode State ─────────────────────────────────
  fileContents: {
    [VIRTUAL_HTML_FILE_ID]: DEFAULT_HTML,
    [VIRTUAL_CSS_FILE_ID]: DEFAULT_CSS,
    [VIRTUAL_JS_FILE_ID]: DEFAULT_JS,
  },
  dirtyMap: {},
  openTabIds: [VIRTUAL_HTML_FILE_ID, VIRTUAL_CSS_FILE_ID, VIRTUAL_JS_FILE_ID],
  activeFileId: VIRTUAL_HTML_FILE_ID,

  // ─── Project Mode Actions ───────────────────────────────

  updateFileContent: (fileId, content) => {
    set((state) => ({
      fileContents: { ...state.fileContents, [fileId]: content },
      dirtyMap: { ...state.dirtyMap, [fileId]: true },
    }));
    // Auto-sync to projectStore (single write target → single source of truth)
    try {
      getProjectStore().getState().updateFileContent(fileId, content);
    } catch {
      // projectStore may not be initialized yet — safe to ignore
    }
  },

  markFileClean: (fileId) => {
    set((state) => ({
      dirtyMap: { ...state.dirtyMap, [fileId]: false },
    }));
  },

  markAllClean: () => {
    set((state) => {
      const newDirty = { ...state.dirtyMap };
      for (const key of Object.keys(newDirty)) {
        newDirty[key as FileId] = false;
      }
      return { dirtyMap: newDirty };
    });
  },

  setActiveFileId: (fileId) => {
    set({ activeFileId: fileId });
  },

  openTab: (fileId) => {
    set((state) => {
      if (state.openTabIds.includes(fileId)) {
        // Just activate the existing tab
        return { activeFileId: fileId };
      }
      // Insert after the active tab
      const activeIndex = state.openTabIds.indexOf(
        state.activeFileId ?? ('' as FileId)
      );
      const insertIndex = activeIndex >= 0 ? activeIndex + 1 : state.openTabIds.length;
      const newTabs = [...state.openTabIds];
      newTabs.splice(insertIndex, 0, fileId);
      return { openTabIds: newTabs, activeFileId: fileId };
    });
  },

  closeTab: (fileId) => {
    set((state) => {
      const newTabs = state.openTabIds.filter((id) => id !== fileId);
      let newActiveId = state.activeFileId;

      // If closing the active tab, activate adjacent tab
      if (state.activeFileId === fileId) {
        const closedIndex = state.openTabIds.indexOf(fileId);
        newActiveId =
          newTabs[Math.min(closedIndex, newTabs.length - 1)] ?? null;
      }

      return { openTabIds: newTabs, activeFileId: newActiveId };
    });
  },

  closeOtherTabs: (keepFileId) => {
    set((state) => ({
      openTabIds: [keepFileId],
      activeFileId: keepFileId,
    }));
  },

  closeTabsToRight: (fileId) => {
    set((state) => {
      const index = state.openTabIds.indexOf(fileId);
      if (index === -1) return state;
      return {
        openTabIds: state.openTabIds.slice(0, index + 1),
        activeFileId: state.activeFileId,
      };
    });
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.openTabIds];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { openTabIds: newTabs };
    });
  },

  loadFileContents: (entries) => {
    set((state) => {
      const newContents = { ...state.fileContents };
      const newDirty = { ...state.dirtyMap };
      for (const { fileId, content } of entries) {
        newContents[fileId] = content;
        newDirty[fileId] = false;
      }
      return { fileContents: newContents, dirtyMap: newDirty };
    });
  },

  clearProjectState: () => {
    set({
      fileContents: {},
      dirtyMap: {},
      openTabIds: [],
      activeFileId: null,
    });
  },

  // ─── Sync Helpers ───────────────────────────────────────

  syncFromVirtualFiles: (htmlContent, cssContent, jsContent) => {
    set({
      html: htmlContent,
      css: cssContent,
      javascript: jsContent,
      fileContents: {
        [VIRTUAL_HTML_FILE_ID]: htmlContent,
        [VIRTUAL_CSS_FILE_ID]: cssContent,
        [VIRTUAL_JS_FILE_ID]: jsContent,
      },
    });
  },

  getActiveContent: () => {
    const state = get();
    if (state.activeFileId) {
      return state.fileContents[state.activeFileId] ?? '';
    }
    // Legacy fallback
    switch (state.activeTab) {
      case 'html':
        return state.html;
      case 'css':
        return state.css;
      case 'javascript':
        return state.javascript;
      default:
        return '';
    }
  },

  getActiveFileType: () => {
    const state = get();
    if (state.activeFileId) {
      // Derive from virtual file IDs or file path
      if (state.activeFileId === VIRTUAL_HTML_FILE_ID) return 'html';
      if (state.activeFileId === VIRTUAL_CSS_FILE_ID) return 'css';
      if (state.activeFileId === VIRTUAL_JS_FILE_ID) return 'javascript';
      // For project mode, derive from file extension in project store
      return 'html'; // default
    }
    return state.activeTab;
  },
}));
