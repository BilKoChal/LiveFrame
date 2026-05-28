/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import { assembleDocument } from '../utils/previewBuilder';

export function useAutoRefresh(manualTrigger: number) {
  const html = useEditorStore((state) => state.html);
  const css = useEditorStore((state) => state.css);
  const javascript = useEditorStore((state) => state.javascript);
  const autoRefresh = useUIStore((state) => state.autoRefresh);
  const setErrorOverlay = useUIStore((state) => state.setErrorOverlay);

  const [srcDoc, setSrcDoc] = useState('');

  // Auto-refresh hook with 400ms debounce
  useEffect(() => {
    if (!autoRefresh) return;

    const timeout = setTimeout(() => {
      setErrorOverlay(null);
      const assembled = assembleDocument(html, css, javascript);
      setSrcDoc(assembled);
    }, 400);

    return () => clearTimeout(timeout);
  }, [html, css, javascript, autoRefresh, setErrorOverlay]);

  // Force rebuild on manual override trigger
  useEffect(() => {
    if (manualTrigger > 0) {
      setErrorOverlay(null);
      const assembled = assembleDocument(html, css, javascript);
      setSrcDoc(assembled);
    }
  }, [manualTrigger, html, css, javascript, setErrorOverlay]);

  // Initial document construction
  useEffect(() => {
    const assembled = assembleDocument(html, css, javascript);
    setSrcDoc(assembled);
  }, []);

  return srcDoc;
}
