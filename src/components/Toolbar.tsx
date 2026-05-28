/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, RotateCw, Sparkles, RefreshCcw, FileEdit } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';
import ThemeToggle from './ThemeToggle';

interface ToolbarProps {
  onManualRefresh: () => void;
}

export default function Toolbar({ onManualRefresh }: ToolbarProps) {
  const autoRefresh = useUIStore((state) => state.autoRefresh);
  const setAutoRefresh = useUIStore((state) => state.setAutoRefresh);
  const resetAll = useEditorStore((state) => state.resetAll);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all editor contents back to the default boilerplate? This will overwrite your current changes.')) {
      resetAll();
    }
  };

  return (
    <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 gap-3 select-none">
      {/* Brand Identity Branding Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-md">
          <Sparkles className="h-4.5 w-4.5 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-md sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-350 bg-clip-text text-transparent">
            LiveFrame
          </h1>
          <p className="hidden xs:block text-[9px] font-medium tracking-widest text-slate-400 dark:text-slate-500 uppercase">
            Instant Browser Editor
          </p>
        </div>
      </div>

      {/* Toolbar Options Actions Container */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Compilation Refresh Controls */}
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/40 p-0.5 border border-slate-200/80 dark:border-slate-800/60 shadow-sm">
          {/* Auto Refresh Active Switch */}
          <button
            id="auto-refresh-switch"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              autoRefresh
                ? 'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600'
                : 'text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/40'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled (400ms delay)' : 'Auto-refresh paused'}
          >
            <Play className={`h-3 w-3 ${autoRefresh ? 'fill-current animate-pulse' : ''}`} />
            <span>Auto Run</span>
          </button>

          {/* Manual Execute Re-runner Trigger */}
          <button
            id="manual-refresh-trigger"
            onClick={onManualRefresh}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/40 transition-all ${
              autoRefresh ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'
            }`}
            disabled={autoRefresh}
            title={autoRefresh ? 'Disabled while Auto Run is active' : 'Manually rebuild and run changes'}
          >
            <RotateCw className="h-3 w-3" />
            <span>Run</span>
          </button>
        </div>

        {/* Reset Code Boilerplate button wrapper */}
        <button
          id="reset-boilerplates-btn"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-900/30 dark:hover:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-800/60 shadow-sm transition-all"
          title="Reset files to boilerplate state"
        >
          <RefreshCcw className="h-3 w-3 text-slate-400 dark:text-slate-500" />
          <span>Reset Boilerplate</span>
        </button>

        {/* Separator Divider */}
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Current Segment Theme Selector dropdown hook */}
        <ThemeToggle />
      </div>
    </header>
  );
}
