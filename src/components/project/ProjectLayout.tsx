/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import FileTree from './FileTree';
import ProjectFileTabs from './ProjectFileTabs';
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
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeFileId = useEditorStore((s) => s.activeFileId);

  const handleManualRefresh = () => {
    setManualTrigger((prev) => prev + 1);
  };

  return (
    <main className="flex-1 w-full min-h-0 bg-slate-50 dark:bg-slate-900/10">
      <Group orientation="vertical">
        {/* Top Half: Horizontal split */}
        <Panel defaultSize={75} minSize={30}>
          <Group orientation="horizontal">
            {/* File Tree Panel */}
            {isFileTreeOpen && activeProject?.mode === 'project' && (
              <>
                <Panel
                  defaultSize={18}
                  minSize={12}
                  maxSize={35}
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
            <Panel defaultSize={50} minSize={25} className="flex flex-col h-full bg-slate-900 dark:bg-slate-950/20 overflow-hidden shadow-sm">
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
            <Panel defaultSize={50} minSize={25} className="flex flex-col h-full bg-slate-100 dark:bg-slate-950/40 overflow-hidden">
              <PreviewFrame manualTrigger={manualTrigger} />
            </Panel>
          </Group>
        </Panel>

        {/* Console Panel */}
        {isConsoleOpen && (
          <>
            <Separator className="outline-none focus:ring-0">
              <ResizeHandle direction="vertical" />
            </Separator>
            <Panel defaultSize={25} minSize={10} maxSize={50} className="flex flex-col overflow-hidden shadow-inner font-sans antialiased">
              <ConsolePanel />
            </Panel>
          </>
        )}
      </Group>

      {!isConsoleOpen && (
        <div className="flex-shrink-0">
          <ConsolePanel />
        </div>
      )}
    </main>
  );
}
