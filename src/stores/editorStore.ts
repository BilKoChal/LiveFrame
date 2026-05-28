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

const DEFAULT_HTML = `<!-- LiveFrame Preview Canvas -->
<div class="card">
  <h1>LiveFrame</h1>
  <p>Build ideas instantly in real-time with HTML, CSS, and JS.</p>
  <button id="click-me">Interact with Me</button>
</div>`;

const DEFAULT_CSS = `/* Custom modern slate styling */
body {
  background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
  padding: 1.5rem;
  box-sizing: border-box;
}

.card {
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2.5rem;
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  text-align: center;
  max-width: 440px;
  width: 100%;
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-top: 0;
  margin-bottom: 0.75rem;
  letter-spacing: -0.025em;
}

p {
  color: #94a3b8;
  line-height: 1.6;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

button {
  background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
  color: #ffffff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease-in-out;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.6);
}

button:active {
  transform: translateY(0);
}`;

const DEFAULT_JS = `// Interactive LiveFrame Scripting
const button = document.getElementById('click-me');

button.addEventListener('click', () => {
  console.log('Button interactive click triggered!');

  // Custom interactive visual effect
  button.textContent = 'Awesome! 👍';
  button.style.background = 'linear-gradient(135deg, #34d399 0%, #059669 100%)';
  button.style.boxShadow = '0 6px 20px 0 rgba(52, 211, 153, 0.6)';

  setTimeout(() => {
    button.textContent = 'Interact with Me';
    button.style.background = 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)';
    button.style.boxShadow = '0 4px 14px 0 rgba(99, 102, 241, 0.4)';
  }, 1500);
});

console.log('Document script successfully loaded and active.');
`;

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
