/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useTheme() {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (currentTheme: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(currentTheme);
      // Also style background of root for iframe consistency
      root.style.colorScheme = currentTheme;
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleSystemChange);

      return () => {
        mediaQuery.removeEventListener('change', handleSystemChange);
      };
    } else {
      applyTheme(theme);
    }
  }, [theme]);
}
