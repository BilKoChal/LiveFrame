/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, RefreshCcw, FolderTree, Code2, LayoutGrid } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useLayoutStore } from '../../stores/layoutStore';
import ThemeToggle from './ThemeToggle';
import RefreshControls from './RefreshControls';

interface ToolbarProps {
  onManualRefresh: () => void;
}

export default function Toolbar({ onManualRefresh }: ToolbarProps) {
  const resetAll = useEditorStore((state) => state.resetAll);
  const resetVirtualProject = useProjectStore((s) => s.resetVirtualProject);
  const mode = useLayoutStore((s) => s.mode);
  const setMode = useLayoutStore((s) => s.setMode);
  const toggleFileTree = useLayoutStore((s) => s.toggleFileTree);
  const isFileTreeOpen = useLayoutStore((s) => s.isFileTreeOpen);
  const activeProject = useProjectStore((s) => s.activeProject);
  const switchToProjectMode = useProjectStore((s) => s.switchToProjectMode);
  const switchToSingleFileMode = useProjectStore((s) => s.switchToSingleFileMode);

  const handleReset = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all editor contents back to the default boilerplate? This will overwrite your current changes.'
      )
    ) {
      resetAll();
      resetVirtualProject();
    }
  };

  const handleModeSwitch = () => {
    if (!activeProject) return;

    if (mode === 'single-file') {
      // Switch to project mode — promote virtual files
      switchToProjectMode(activeProject.id);
      setMode('project');
    } else {
      // Switch back to single-file mode
      switchToSingleFileMode(activeProject.id);
      setMode('single-file');
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
        {/* Mode Switcher */}
        <button
          id="mode-switch-btn"
          onClick={handleModeSwitch}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all ${
            mode === 'project'
              ? 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-800/60'
              : 'text-slate-500 bg-slate-100 border-slate-200/80 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-800/60 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
          }`}
          title={mode === 'project' ? 'Switch to Single-File Mode' : 'Switch to Project Mode'}
        >
          {mode === 'project' ? (
            <>
              <Code2 className="h-3 w-3" />
              <span>Single-File</span>
            </>
          ) : (
            <>
              <LayoutGrid className="h-3 w-3" />
              <span>Project</span>
            </>
          )}
        </button>

        {/* File Tree Toggle (project mode only) */}
        {mode === 'project' && (
          <button
            id="file-tree-toggle-btn"
            onClick={toggleFileTree}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              isFileTreeOpen
                ? 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950/30 dark:border-indigo-800/60'
                : 'text-slate-400 bg-slate-50 border-slate-200/80 dark:text-slate-500 dark:bg-slate-900/20 dark:border-slate-800/40 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="Toggle File Tree"
          >
            <FolderTree className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Refresh Controls */}
        <RefreshControls onManualRefresh={onManualRefresh} />

        {/* Reset Code Boilerplate button */}
        <button
          id="reset-boilerplates-btn"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:bg-slate-900/30 dark:hover:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-800/60 shadow-sm transition-all"
          title="Reset files to boilerplate state"
        >
          <RefreshCcw className="h-3 w-3 text-slate-400 dark:text-slate-500" />
          <span>Reset</span>
        </button>

        {/* Separator Divider */}
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Theme Selector */}
        <ThemeToggle />
      </div>
    </header>
  );
}
