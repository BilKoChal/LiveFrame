/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * EditorSkeleton — Loading placeholder shown while CodeMirror is being lazy-loaded.
 * Mimics the editor's visual structure with animated shimmer lines.
 */
export default function EditorSkeleton() {
  return (
    <div className="h-full w-full bg-slate-900 dark:bg-slate-950 flex flex-col p-4 animate-pulse">
      {/* Simulated line numbers column */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-2 w-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-slate-700/40 dark:bg-slate-800/40 rounded-sm"
              style={{ width: `${12 + Math.random() * 16}px` }}
            />
          ))}
        </div>
        {/* Simulated code lines */}
        <div className="flex flex-col gap-2 flex-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-slate-700/30 dark:bg-slate-800/30 rounded-sm"
              style={{ width: `${20 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
