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
  /** Setters */
  setIsConsoleOpen: (isOpen: boolean) => void;
  toggleConsole: () => void;
  setMode: (mode: LayoutState['mode']) => void;
  setIsFileTreeOpen: (isOpen: boolean) => void;
  toggleFileTree: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isConsoleOpen: true,
  mode: 'single-file',
  isFileTreeOpen: true,
  setIsConsoleOpen: (isConsoleOpen) => set({ isConsoleOpen }),
  toggleConsole: () => set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
  setMode: (mode) => set({ mode }),
  setIsFileTreeOpen: (isFileTreeOpen) => set({ isFileTreeOpen }),
  toggleFileTree: () => set((state) => ({ isFileTreeOpen: !state.isFileTreeOpen })),
}));
