/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, Terminal } from 'lucide-react';
import type { ConsoleEntry as ConsoleEntryType } from '../../types';

interface ConsoleEntryProps {
  entry: ConsoleEntryType;
}

function getIcon(type: string) {
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
}

function getLineStyle(type: string) {
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
}

const ConsoleEntry: React.FC<ConsoleEntryProps> = ({ entry }) => {
  return (
    <div
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
  );
};

export default ConsoleEntry;
