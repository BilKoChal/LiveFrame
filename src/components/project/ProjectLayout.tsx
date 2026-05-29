/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState, useCallback } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import FileTree from './FileTree';
import ProjectFileTabs from './ProjectFileTabs';
import ExternalResourcePanel from './ExternalResourcePanel';
import PreviewFrame from '../preview/PreviewFrame';
import ConsolePanel from '../console/ConsolePanel';
import ResizeHandle from '../layout/ResizeHandle';
import EditorSkeleton from '../editor/EditorSkeleton';
import { useLayoutStore } from '../../stores/layoutStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';

const CodeMirrorEditor = lazy(() => import('../editor/CodeMirrorEditor'));

export default function ProjectLayout() {
  const [manualTrigger, setManualTrigger] = useState(0);
  const isConsoleOpen = useLayoutStore((s) => s.isConsoleOpen);
  const isFileTreeOpen = useLayoutStore((s) => s.isFileTreeOpen);
  const isResourcesOpen = useLayoutStore((s) => s.isResourcesOpen);
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeFileId = useEditorStore((s) => s.activeFileId);

  // Persisted sizes
  const fileTreeSize = useLayoutStore((s) => s.fileTreeSize);
  const editorSize = useLayoutStore((s) => s.editorSize);
  const previewSize = useLayoutStore((s) => s.previewSize);
  const consoleSize = useLayoutStore((s) => s.consoleSize);
  const topPanelSize = useLayoutStore((s) => s.topPanelSize);
  const setFileTreeSize = useLayoutStore((s) => s.setFileTreeSize);
  const setEditorSize = useLayoutStore((s) => s.setEditorSize);
  const setPreviewSize = useLayoutStore((s) => s.setPreviewSize);
  const setConsoleSize = useLayoutStore((s) => s.setConsoleSize);
  const setTopPanelSize = useLayoutStore((s) => s.setTopPanelSize);

  // Collapse/expand file tree via callback
  const handleFileTreeCollapse = useCallback(() => {
    useLayoutStore.getState().setIsFileTreeOpen(false);
  }, []);

  const handleFileTreeExpand = useCallback(() => {
    useLayoutStore.getState().setIsFileTreeOpen(true);
  }, []);

  const handleConsoleCollapse = useCallback(() => {
    useLayoutStore.getState().setIsConsoleOpen(false);
  }, []);

  const handleConsoleExpand = useCallback(() => {
    useLayoutStore.getState().setIsConsoleOpen(true);
  }, []);

  const handleManualRefresh = () => {
    setManualTrigger((prev) => prev + 1);
  };

  return (
    <main className="flex-1 w-full min-h-0 bg-slate-50 dark:bg-slate-900/10 relative">
      <Group orientation="vertical">
        {/* Top Half: Horizontal split */}
        <Panel
          defaultSize={topPanelSize}
          minSize={30}
          onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}
        >
          <Group orientation="horizontal">
            {/* File Tree Panel — always in DOM, collapsible */}
            {activeProject?.mode === 'project' && (
              <>
                <Panel
                  defaultSize={fileTreeSize}
                  minSize={5}
                  maxSize={45}
                  collapsible
                  collapsedSize={0}
                  onCollapse={handleFileTreeCollapse}
                  onExpand={handleFileTreeExpand}
                  onResize={(panelSize) => setFileTreeSize(panelSize.asPercentage)}
                  className="flex flex-col h-full overflow-hidden"
                >
                  <FileTree />
                </Panel>
                <Separator className="outline-none focus:ring-0">
                  <ResizeHandle direction="horizontal" />
                </Separator>
              </>
            )}

            {/* Editor Panel */}
            <Panel
              defaultSize={editorSize}
              minSize={20}
              onResize={(panelSize) => setEditorSize(panelSize.asPercentage)}
              className="flex flex-col h-full bg-slate-900 dark:bg-slate-950/20 overflow-hidden shadow-sm"
            >
              {/* Show project tabs in project mode, single file tabs otherwise */}
              {activeProject?.mode === 'project' ? (
                <ProjectFileTabs />
              ) : null}

              <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
                {activeFileId ? (
                  <Suspense fallback={<EditorSkeleton />}>
                    <CodeMirrorEditor />
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Select a file to start editing
                  </div>
                )}
              </div>
            </Panel>

            <Separator className="outline-none focus:ring-0">
              <ResizeHandle direction="horizontal" />
            </Separator>

            {/* Preview Panel */}
            <Panel
              defaultSize={previewSize}
              minSize={20}
              onResize={(panelSize) => setPreviewSize(panelSize.asPercentage)}
              className="flex flex-col h-full bg-slate-100 dark:bg-slate-950/40 overflow-hidden"
            >
              <PreviewFrame manualTrigger={manualTrigger} />
            </Panel>
          </Group>
        </Panel>

        {/* Console Panel — always in DOM, collapsible */}
        <Separator className="outline-none focus:ring-0">
          <ResizeHandle direction="vertical" />
        </Separator>
        <Panel
          defaultSize={consoleSize}
          minSize={8}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={handleConsoleCollapse}
          onExpand={handleConsoleExpand}
          onResize={(panelSize) => setConsoleSize(panelSize.asPercentage)}
          className="flex flex-col overflow-hidden shadow-inner font-sans antialiased"
        >
          <ConsolePanel />
        </Panel>
      </Group>

      {/* External Resources Slide-Over Panel */}
      {isResourcesOpen && activeProject && (
        <div className="absolute inset-0 z-40 flex pointer-events-none">
          {/* Backdrop */}
          <div
            className="flex-1 bg-slate-950/20 dark:bg-slate-950/40 pointer-events-auto"
            onClick={() => useLayoutStore.getState().setIsResourcesOpen(false)}
          />
          {/* Panel */}
          <div className="w-72 h-full pointer-events-auto shadow-2xl border-l border-slate-200 dark:border-slate-800/60">
            <ExternalResourcePanel projectId={activeProject.id} />
          </div>
        </div>
      )}
    </main>
  );
}
