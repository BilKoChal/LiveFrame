/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';

interface LayoutState {
  /** Whether the console panel is visible */
  isConsoleOpen: boolean;
  /** Current editor mode: single-file or project */
  mode: 'single-file' | 'project';
  /** Whether the file tree panel is visible (project mode only) */
  isFileTreeOpen: boolean;
  /** Whether the external resources panel is visible */
  isResourcesOpen: boolean;

  /** Persisted panel sizes (percentages) */
  fileTreeSize: number;
  editorSize: number;
  previewSize: number;
  consoleSize: number;
  topPanelSize: number;

  /** Setters */
  setIsConsoleOpen: (isOpen: boolean) => void;
  toggleConsole: () => void;
  setMode: (mode: LayoutState['mode']) => void;
  setIsFileTreeOpen: (isOpen: boolean) => void;
  toggleFileTree: () => void;
  setIsResourcesOpen: (isOpen: boolean) => void;
  toggleResources: () => void;
  setFileTreeSize: (size: number) => void;
  setEditorSize: (size: number) => void;
  setPreviewSize: (size: number) => void;
  setConsoleSize: (size: number) => void;
  setTopPanelSize: (size: number) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isConsoleOpen: true,
  mode: 'single-file',
  isFileTreeOpen: true,
  isResourcesOpen: false,
  fileTreeSize: 18,
  editorSize: 41,
  previewSize: 41,
  consoleSize: 25,
  topPanelSize: 75,
  setIsConsoleOpen: (isConsoleOpen) => set({ isConsoleOpen }),
  toggleConsole: () => set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
  setMode: (mode) => set({ mode }),
  setIsFileTreeOpen: (isFileTreeOpen) => set({ isFileTreeOpen }),
  toggleFileTree: () => set((state) => ({ isFileTreeOpen: !state.isFileTreeOpen })),
  setIsResourcesOpen: (isResourcesOpen) => set({ isResourcesOpen }),
  toggleResources: () => set((state) => ({ isResourcesOpen: !state.isResourcesOpen })),
  setFileTreeSize: (fileTreeSize) => set({ fileTreeSize }),
  setEditorSize: (editorSize) => set({ editorSize }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setConsoleSize: (consoleSize) => set({ consoleSize }),
  setTopPanelSize: (topPanelSize) => set({ topPanelSize }),
}));
