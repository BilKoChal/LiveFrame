/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import Toolbar from './components/Toolbar';
import SingleFileTabs from './components/SingleFileTabs';
import CodeMirrorEditor from './components/CodeMirrorEditor';
import PreviewFrame from './components/PreviewFrame';
import ConsolePanel from './components/ConsolePanel';
import ResizeHandle from './components/ResizeHandle';
import { useTheme } from './hooks/useTheme';
import { useUIStore } from './stores/uiStore';

export default function App() {
  useTheme(); // Triggers modern theme bindings on root html element
  const [manualTrigger, setManualTrigger] = useState(0);
  const isConsoleOpen = useUIStore((state) => state.isConsoleOpen);

  const handleManualRefresh = () => {
    setManualTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100 selection:bg-indigo-500/20">
      {/* Primary Toolbar Controls */}
      <Toolbar onManualRefresh={handleManualRefresh} />

      {/* Main Resizable Workspace Split Area */}
      <main className="flex-1 w-full min-h-0 bg-slate-50 dark:bg-slate-900/10">
        <Group orientation="vertical">
          {/* Top Half: Horizontal splits for code selection vs live preview */}
          <Panel defaultSize={75} minSize={30}>
            <Group orientation="horizontal">
              {/* Left Column: Code Files Editor Console */}
              <Panel defaultSize={50} minSize={25} className="flex flex-col h-full bg-slate-900 dark:bg-slate-950/20 overflow-hidden shadow-sm">
                <SingleFileTabs />
                <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
                  <CodeMirrorEditor />
                </div>
              </Panel>

              {/* Slider Split Drag Girth */}
              <Separator className="outline-none focus:ring-0">
                <ResizeHandle direction="horizontal" />
              </Separator>

              {/* Right Column: Embedded Canvas Simulator */}
              <Panel defaultSize={50} minSize={25} className="flex flex-col h-full bg-slate-100 dark:bg-slate-950/40 overflow-hidden">
                <PreviewFrame manualTrigger={manualTrigger} />
              </Panel>
            </Group>
          </Panel>

          {/* Bottom Half: Custom Dev Sandbox Console Panel */}
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
      </main>

      {/* Minimised dev console handle banner placeholder */}
      {!isConsoleOpen && (
        <div className="flex-shrink-0">
          <ConsolePanel />
        </div>
      )}
    </div>
  );
}
