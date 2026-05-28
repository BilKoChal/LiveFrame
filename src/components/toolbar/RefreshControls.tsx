/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, RotateCw } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

interface RefreshControlsProps {
  onManualRefresh: () => void;
}

export default function RefreshControls({ onManualRefresh }: RefreshControlsProps) {
  const autoRefresh = useUIStore((state) => state.autoRefresh);
  const setAutoRefresh = useUIStore((state) => state.setAutoRefresh);

  return (
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
  );
}
