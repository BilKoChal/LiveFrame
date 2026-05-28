/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
}

export default function ResizeHandle({ direction = 'horizontal' }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';
  return (
    <div
      className={`relative flex items-center justify-center transition-all bg-slate-200 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700/80 group active:bg-indigo-500/40 dark:active:bg-indigo-500/35 border-slate-300 dark:border-slate-800 ${
        isHorizontal
          ? 'w-[7px] h-full cursor-col-resize border-l border-r'
          : 'h-[7px] w-full cursor-row-resize border-t border-b'
      }`}
    >
      {/* Decorative center micro bar or grab dots */}
      <div
        className={`flex items-center justify-center rounded-full bg-slate-400/40 dark:bg-slate-600/50 group-hover:bg-indigo-400/80 group-active:bg-indigo-300 transition-all ${
          isHorizontal
            ? 'h-8 w-[3px] flex-col gap-1'
            : 'w-8 h-[3px] flex-row gap-1'
        }`}
      >
        <span className="block h-[2px] w-[2px] rounded-full bg-slate-400 dark:bg-slate-500" />
        <span className="block h-[2px] w-[2px] rounded-full bg-slate-400 dark:bg-slate-500" />
        <span className="block h-[2px] w-[2px] rounded-full bg-slate-400 dark:bg-slate-500" />
      </div>
    </div>
  );
}
