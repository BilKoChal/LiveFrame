/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileCode2, Palette, Braces } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { ActiveTab } from '../../types';

export default function SingleFileTabs() {
  const activeTab = useEditorStore((state) => state.activeTab);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);

  const tabs: { id: ActiveTab; label: string; icon: any; iconColor: string; activeColor: string }[] = [
    {
      id: 'html',
      label: 'index.html',
      icon: FileCode2,
      iconColor: 'text-amber-500',
      activeColor: 'border-amber-500 text-slate-800 dark:text-slate-200 bg-amber-500/5'
    },
    {
      id: 'css',
      label: 'style.css',
      icon: Palette,
      iconColor: 'text-sky-500',
      activeColor: 'border-sky-500 text-slate-800 dark:text-slate-200 bg-sky-500/5'
    },
    {
      id: 'javascript',
      label: 'main.js',
      icon: Braces,
      iconColor: 'text-yellow-500',
      activeColor: 'border-yellow-500 text-slate-800 dark:text-slate-200 bg-yellow-500/5'
    },
  ];

  return (
    <div className="flex items-center w-full border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 select-none">
      <div className="flex -mb-[1px]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              id={`tab-btn-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold tracking-wide border-b-2 transition-all duration-150 outline-none ${
                isActive
                  ? tab.activeColor
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab.iconColor}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
