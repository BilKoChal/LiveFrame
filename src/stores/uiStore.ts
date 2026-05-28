/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { Theme, ConsoleEntry } from '../types';

interface UIState {
  theme: Theme;
  autoRefresh: boolean;
  isConsoleOpen: boolean;
  consoleEntries: ConsoleEntry[];
  errorOverlay: string | null;
  setTheme: (theme: Theme) => void;
  setAutoRefresh: (auto: boolean) => void;
  setIsConsoleOpen: (isOpen: boolean) => void;
  addConsoleEntry: (type: ConsoleEntry['type'], message: string) => void;
  clearConsole: () => void;
  setErrorOverlay: (error: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark', // Slate dark is an amazing default theme!
  autoRefresh: true,
  isConsoleOpen: true,
  consoleEntries: [],
  errorOverlay: null,
  setTheme: (theme) => set({ theme }),
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  setIsConsoleOpen: (isConsoleOpen) => set({ isConsoleOpen }),
  addConsoleEntry: (type, message) => set((state) => {
    // Avoid excessively long logs
    const updated = [
      ...state.consoleEntries,
      {
        id: Math.random().toString(36).substring(7),
        type,
        message,
        timestamp: new Date(),
      },
    ];
    if (updated.length > 200) {
      updated.shift();
    }
    return { consoleEntries: updated };
  }),
  clearConsole: () => set({ consoleEntries: [] }),
  setErrorOverlay: (errorOverlay) => set({ errorOverlay }),
}));
