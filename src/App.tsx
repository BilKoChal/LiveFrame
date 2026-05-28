/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import AppLayout from './components/layout/AppLayout';
import { useTheme } from './hooks/useTheme';
import { useProjectStore } from './stores/projectStore';
import { useEditorStore } from './stores/editorStore';
import {
  hydrateFromIDB,
  setupAutoSaveHandlers,
  isIDBAvailable,
} from './utils/idb';
import {
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from './types/project';

export default function App() {
  useTheme(); // Triggers modern theme bindings on root html element

  // Hydrate from IndexedDB on startup
  useEffect(() => {
    async function init() {
      const available = await isIDBAvailable();
      if (!available) return;

      const { projects, files } = await hydrateFromIDB();
      const projectStore = useProjectStore.getState();

      if (Object.keys(projects).length > 0) {
        projectStore.hydrateFromIndexedDB(projects, files);

        // Also hydrate editor store file contents
        const editorStore = useEditorStore.getState();
        const fileContents: Record<string, string> = {};
        for (const file of Object.values(files)) {
          if (file.content !== null) {
            fileContents[file.id] = file.content;
          }
        }
        editorStore.loadFileContents(
          Object.entries(fileContents).map(([fileId, content]) => ({
            fileId: fileId as typeof VIRTUAL_HTML_FILE_ID,
            content,
          }))
        );
      }

      projectStore.setHydrated(true);
    }

    init();
  }, []);

  // Set up auto-save handlers (visibility change, beforeunload)
  useEffect(() => {
    const cleanup = setupAutoSaveHandlers(
      () => useProjectStore.getState().files,
      () => useProjectStore.getState().projects
    );
    return cleanup;
  }, []);

  return <AppLayout />;
}
