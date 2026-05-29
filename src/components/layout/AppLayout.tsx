/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState, useCallback } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import Toolbar from '../toolbar/Toolbar';
import SingleFileTabs from '../editor/SingleFileTabs';
import ProjectLayout from '../project/ProjectLayout';
import ExternalResourcePanel from '../project/ExternalResourcePanel';
import PreviewFrame from '../preview/PreviewFrame';
import ConsolePanel from '../console/ConsolePanel';
import ResizeHandle from './ResizeHandle';
import EditorSkeleton from '../editor/EditorSkeleton';
import { useLayoutStore } from '../../stores/layoutStore';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';

// Lazy-load CodeMirror for faster initial page load
const CodeMirrorEditor = lazy(() => import('../editor/CodeMirrorEditor'));

export default function AppLayout() {
  const [manualTrigger, setManualTrigger] = useState(0);
  const isConsoleOpen = useLayoutStore((state) => state.isConsoleOpen);
  const isResourcesOpen = useLayoutStore((state) => state.isResourcesOpen);
  const mode = useLayoutStore((state) => state.mode);
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeFileId = useEditorStore((s) => s.activeFileId);

  const setConsoleSize = useLayoutStore((s) => s.setConsoleSize);
  const consoleSize = useLayoutStore((s) => s.consoleSize);
  const setTopPanelSize = useLayoutStore((s) => s.setTopPanelSize);
  const topPanelSize = useLayoutStore((s) => s.topPanelSize);

  const handleManualRefresh = () => {
    setManualTrigger((prev) => prev + 1);
  };

  const handleConsoleCollapse = useCallback(() => {
    useLayoutStore.getState().setIsConsoleOpen(false);
  }, []);

  const handleConsoleExpand = useCallback(() => {
    useLayoutStore.getState().setIsConsoleOpen(true);
  }, []);

  // Project mode: render the project layout (file tree + tabs + editor + preview)
  if (mode === 'project' && activeProject?.mode === 'project') {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100 selection:bg-indigo-500/20">
        <Toolbar onManualRefresh={handleManualRefresh} />
        <ProjectLayout />
      </div>
    );
  }

  // Single-file mode: the original layout
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100 selection:bg-indigo-500/20">
      {/* Primary Toolbar Controls */}
      <Toolbar onManualRefresh={handleManualRefresh} />

      {/* Main Resizable Workspace Split Area */}
      <main className="flex-1 w-full min-h-0 bg-slate-50 dark:bg-slate-900/10 relative">
        <Group orientation="vertical">
          {/* Top Half: Horizontal splits for code selection vs live preview */}
          <Panel
            defaultSize={topPanelSize}
            minSize={30}
            onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}
          >
            <Group orientation="horizontal">
              {/* Left Column: Code Files Editor */}
              <Panel defaultSize={50} minSize={20} className="flex flex-col h-full bg-slate-900 dark:bg-slate-950/20 overflow-hidden shadow-sm">
                <SingleFileTabs />
                <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
                  <Suspense fallback={<EditorSkeleton />}>
                    <CodeMirrorEditor />
                  </Suspense>
                </div>
              </Panel>

              {/* Slider Split Drag Handle */}
              <Separator className="outline-none focus:ring-0">
                <ResizeHandle direction="horizontal" />
              </Separator>

              {/* Right Column: Embedded Canvas Simulator */}
              <Panel defaultSize={50} minSize={20} className="flex flex-col h-full bg-slate-100 dark:bg-slate-950/40 overflow-hidden">
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
            onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}
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
    </div>
  );
}
