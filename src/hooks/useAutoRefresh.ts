/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { useLayoutStore } from '../stores/layoutStore';
import { assembleDocument } from '../utils/previewBuilder';
import { assembleProjectDocument } from '../utils/projectPreviewBuilder';
import type { FileId } from '../types/project';
import {
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from '../types/project';

export function useAutoRefresh(manualTrigger: number) {
  const mode = useLayoutStore((s) => s.mode);

  // Legacy single-file state
  const html = useEditorStore((state) => state.html);
  const css = useEditorStore((state) => state.css);
  const javascript = useEditorStore((state) => state.javascript);

  // Project mode state
  const fileContents = useEditorStore((s) => s.fileContents);
  const activeProject = useProjectStore((s) => s.activeProject);
  const files = useProjectStore((s) => s.files);

  const autoRefresh = useUIStore((state) => state.autoRefresh);
  const setErrorOverlay = useUIStore((state) => state.setErrorOverlay);

  const [srcDoc, setSrcDoc] = useState('');

  // Determine the source content based on mode
  const getPreviewContent = () => {
    if (mode === 'project' && activeProject) {
      // For virtual project (single-file mode stored as project), use legacy assembly
      if (activeProject.id === 'proj_virtual_default') {
        const htmlContent =
          fileContents[VIRTUAL_HTML_FILE_ID] ?? html;
        const cssContent =
          fileContents[VIRTUAL_CSS_FILE_ID] ?? css;
        const jsContent =
          fileContents[VIRTUAL_JS_FILE_ID] ?? javascript;
        return assembleDocument(htmlContent, cssContent, jsContent);
      }
      // For real project mode, use project-aware assembly
      return assembleProjectDocument(activeProject, files, fileContents);
    }

    // Single-file mode
    return assembleDocument(html, css, javascript);
  };

  // Auto-refresh hook with 400ms debounce
  useEffect(() => {
    if (!autoRefresh) return;

    const timeout = setTimeout(() => {
      setErrorOverlay(null);
      setSrcDoc(getPreviewContent());
    }, 400);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    html,
    css,
    javascript,
    fileContents,
    activeProject,
    mode,
    autoRefresh,
    setErrorOverlay,
  ]);

  // Force rebuild on manual override trigger
  useEffect(() => {
    if (manualTrigger > 0) {
      setErrorOverlay(null);
      setSrcDoc(getPreviewContent());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualTrigger]);

  // Initial document construction
  useEffect(() => {
    setSrcDoc(getPreviewContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return srcDoc;
}
