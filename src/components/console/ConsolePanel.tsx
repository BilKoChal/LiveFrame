/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Terminal, Trash2, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info, Search } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useUIStore } from '../../stores/uiStore';

export default function ConsolePanel() {
  const consoleEntries = useUIStore((state) => state.consoleEntries);
  const clearConsole = useUIStore((state) => state.clearConsole);
  const isConsoleOpen = useLayoutStore((state) => state.isConsoleOpen);
  const toggleConsole = useLayoutStore((state) => state.toggleConsole);

  const [searchQuery, setSearchQuery] = useState('');

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />;
      case 'info':
        return <Info className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />;
      default:
        return <Terminal className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />;
    }
  };

  const getLineStyle = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-l-[3px] border-rose-500/40 px-3 py-1.5';
      case 'warn':
        return 'bg-amber-500/5 text-amber-700 dark:text-amber-400 border-l-[3px] border-amber-500/40 px-3 py-1.5';
      case 'info':
        return 'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-l-[3px] border-indigo-500/40 px-3 py-1.5';
      default:
        return 'text-slate-600 dark:text-slate-300 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/40';
    }
  };

  const filteredEntries = consoleEntries.filter((entry) =>
    entry.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 overflow-hidden">
      {/* Console Bar / Header */}
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
                onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Output Console Streams */}
      {isConsoleOpen && (
        <div className="flex-1 overflow-y-auto font-mono text-xs p-1 bg-slate-50 dark:bg-slate-900/40 select-text">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 dark:text-slate-600 gap-1.5">
              <Terminal className="h-6 w-6 stroke-[1.5]" />
              <span className="font-semibold text-[11px] tracking-wide">
                {searchQuery ? 'No match found' : 'Console is silent.'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex gap-2.5 border-b border-dotted border-slate-200/50 dark:border-slate-800/30 ${getLineStyle(
                    entry.type
                  )}`}
                >
                  {getIcon(entry.type)}
                  <div className="flex-1 flex flex-col min-w-0">
                    <pre className="whitespace-pre-wrap break-all pr-4 font-mono leading-relaxed text-[11px]">
                      {entry.message}
                    </pre>
                  </div>
                  <span className="text-[9px] text-slate-350 dark:text-slate-600 font-mono tracking-tighter tabular-nums self-start mt-0.5">
                    {entry.timestamp.toLocaleTimeString(undefined, {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
