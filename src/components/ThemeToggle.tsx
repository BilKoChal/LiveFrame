/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { Theme } from '../types';

export default function ThemeToggle() {
  const currentTheme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const options: { value: Theme; label: string; icon: any }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-inner">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = currentTheme === opt.value;
        return (
          <button
            id={`theme-btn-${opt.value}`}
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-all duration-200 hover:text-slate-900 dark:hover:text-slate-100 ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50 border border-slate-200/20'
                : 'text-slate-500 hover:bg-slate-200/30 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
            title={`Switch to ${opt.label} theme`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline text-[11px] font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
