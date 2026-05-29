/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useUIStore } from '../../stores/uiStore';

interface ConsoleToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function ConsoleToolbar({ searchQuery, onSearchChange }: ConsoleToolbarProps) {
  const consoleEntries = useUIStore((state) => state.consoleEntries);
  const clearConsole = useUIStore((state) => state.clearConsole);
  const isConsoleOpen = useLayoutStore((state) => state.isConsoleOpen);
  const toggleConsole = useLayoutStore((state) => state.toggleConsole);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/60 select-none">
      <button
        onClick={toggleConsole}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 outline-none"
      >
        {isConsoleOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5">
          Console
          {consoleEntries.length > 0 && (
            <span className="scale-90 font-mono px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] text-slate-500 dark:text-slate-400 font-bold">
              {consoleEntries.length}
            </span>
          )}
        </span>
      </button>

      {isConsoleOpen && (
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <input
              id="console-search-inp"
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-32 sm:w-44 pl-7 pr-2.5 py-1 text-[11px] font-medium bg-slate-50 hover:bg-white focus:bg-white dark:bg-slate-900 dark:hover:bg-slate-850 dark:focus:bg-slate-850 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-md border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Clear Trigger */}
          <button
            id="clear-console-btn"
            onClick={clearConsole}
            disabled={consoleEntries.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-semibold text-slate-400 hover:text-rose-500 disabled:opacity-40 disabled:hover:text-slate-400 dark:text-slate-500 dark:hover:text-rose-400 transition-colors outline-none"
            title="Clear Output Console"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}
