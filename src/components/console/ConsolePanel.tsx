/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Terminal } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useUIStore } from '../../stores/uiStore';
import ConsoleToolbar from './ConsoleToolbar';
import ConsoleEntry from './ConsoleEntry';

export default function ConsolePanel() {
  const consoleEntries = useUIStore((state) => state.consoleEntries);
  const isConsoleOpen = useLayoutStore((state) => state.isConsoleOpen);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = consoleEntries.filter((entry) =>
    entry.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full min-h-[48px] bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800/80 overflow-hidden">
      {/* Console Bar / Header */}
      <ConsoleToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

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
                <ConsoleEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
