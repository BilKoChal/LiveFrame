/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, X, GripVertical, Package } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import type { ProjectId, ExternalResource } from '../../types/project';

// ─── Common Library Presets ──────────────────────────────────────

const CDN_PRESETS: { label: string; type: 'css' | 'javascript'; url: string; placement: 'head' | 'body' }[] = [
  {
    label: 'Tailwind CSS',
    type: 'javascript',
    url: 'https://cdn.tailwindcss.com',
    placement: 'head',
  },
  {
    label: 'Bootstrap CSS',
    type: 'css',
    url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css',
    placement: 'head',
  },
  {
    label: 'Bootstrap JS',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/bootstrap@5/dist/js/bootstrap.bundle.min.js',
    placement: 'body',
  },
  {
    label: 'Three.js',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/three@0/build/three.min.js',
    placement: 'head',
  },
  {
    label: 'jQuery',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js',
    placement: 'head',
  },
  {
    label: 'Alpine.js',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js',
    placement: 'body',
  },
  {
    label: 'Lodash',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js',
    placement: 'head',
  },
  {
    label: 'D3.js',
    type: 'javascript',
    url: 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js',
    placement: 'head',
  },
];

interface ExternalResourcePanelProps {
  projectId: ProjectId;
}

export default function ExternalResourcePanel({ projectId }: ExternalResourcePanelProps) {
  const projects = useProjectStore((s) => s.projects);
  const addExternalResource = useProjectStore((s) => s.addExternalResource);
  const removeExternalResource = useProjectStore((s) => s.removeExternalResource);

  const project = projects[projectId];
  const resources = project?.externalResources ?? [];

  const [customUrl, setCustomUrl] = useState('');
  const [customType, setCustomType] = useState<'css' | 'javascript'>('javascript');
  const [showPresets, setShowPresets] = useState(false);

  const handleAddCustom = () => {
    if (!customUrl.trim()) return;

    // Determine type from URL if not explicitly set
    const inferredType = customUrl.endsWith('.css') ? 'css' : customType;
    const inferredPlacement = inferredType === 'css' ? 'head' as const : 'head' as const;

    addExternalResource(projectId, {
      type: inferredType,
      url: customUrl.trim(),
      label: extractLabel(customUrl),
      placement: inferredPlacement,
    });
    setCustomUrl('');
  };

  const handleAddPreset = (preset: typeof CDN_PRESETS[number]) => {
    // Don't add duplicates
    if (resources.some((r) => r.url === preset.url)) return;

    addExternalResource(projectId, {
      type: preset.type,
      url: preset.url,
      label: preset.label,
      placement: preset.placement,
    });
  };

  const handleRemove = (resourceId: string) => {
    removeExternalResource(projectId, resourceId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/60 select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Resources
        </span>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className={`p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
            showPresets ? 'text-indigo-500 dark:text-indigo-400' : ''
          }`}
          title="Toggle CDN Presets"
        >
          <Package className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Presets Dropdown */}
      {showPresets && (
        <div className="px-2 py-2 border-b border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-950/40">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-1">
            Quick Add CDN
          </div>
          <div className="flex flex-wrap gap-1">
            {CDN_PRESETS.map((preset) => {
              const isAdded = resources.some((r) => r.url === preset.url);
              return (
                <button
                  key={preset.url}
                  onClick={() => handleAddPreset(preset)}
                  disabled={isAdded}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-all ${
                    isAdded
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                  title={preset.url}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom URL Input */}
      <div className="px-2 py-2 border-b border-slate-200 dark:border-slate-800/60">
        <div className="flex gap-1">
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value as 'css' | 'javascript')}
            className="px-1.5 py-1 text-[10px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-600 dark:text-slate-300"
          >
            <option value="javascript">JS</option>
            <option value="css">CSS</option>
          </select>
          <input
            type="url"
            placeholder="https://cdn.example.com/lib.js"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customUrl.trim()}
            className="p-1 rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Add Resource"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Resource List */}
      <div className="flex-1 overflow-y-auto text-sm">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs gap-1.5">
            <Package className="h-5 w-5 stroke-[1.5]" />
            <span className="font-medium">No external resources</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Add CDN links above
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 group"
              >
                <GripVertical className="h-3 w-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                <span
                  className={`inline-flex items-center px-1 py-0.5 text-[9px] font-bold uppercase rounded ${
                    resource.type === 'css'
                      ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}
                >
                  {resource.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    {resource.label}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate font-mono">
                    {resource.url}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(resource.id)}
                  className="p-0.5 rounded text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove Resource"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Extract a short label from a CDN URL */
function extractLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() ?? pathname;
    // Remove .min and extension for a cleaner label
    return filename.replace('.min', '').replace(/\.(js|css|mjs)$/, '') || url;
  } catch {
    return url.slice(0, 30);
  }
}
