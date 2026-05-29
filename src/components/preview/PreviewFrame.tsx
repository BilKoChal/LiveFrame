/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { AlertCircle, Smartphone, Tablet, Monitor, Eye, X } from 'lucide-react';

export default function PreviewFrame({ manualTrigger }: { manualTrigger: number }) {
  const srcDoc = useAutoRefresh(manualTrigger);
  const addConsoleEntry = useUIStore((state) => state.addConsoleEntry);
  const errorOverlay = useUIStore((state) => state.errorOverlay);
  const setErrorOverlay = useUIStore((state) => state.setErrorOverlay);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Mode state for device aspect ratio simulator
  const [deviceMode, setDeviceMode] = useState<'fluid' | 'phone' | 'tablet'>('fluid');

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'liveframe-preview') return;

      const { type, payload } = event.data;
      if (type === 'console') {
        addConsoleEntry(payload.type, payload.message);
      } else if (type === 'error') {
        setErrorOverlay(payload.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addConsoleEntry, setErrorOverlay]);

  const getDeviceStyle = () => {
    switch (deviceMode) {
      case 'phone':
        return 'w-[375px] h-[667px] shadow-2xl rounded-3xl border-[8px] border-slate-800 dark:border-slate-700';
      case 'tablet':
        return 'w-[768px] h-[1024px] shadow-2xl rounded-3xl border-[12px] border-slate-800 dark:border-slate-700';
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-150 dark:bg-slate-950 overflow-hidden">
      {/* Device Toolbar Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/60 select-none">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Eye className="h-4 w-4" /> Live Preview
          {errorOverlay && (
            <span className="ml-1 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none">
              !
            </span>
          )}
        </span>

        <div className="flex items-center gap-0.5 rounded-lg bg-slate-200/50 dark:bg-slate-900/50 p-0.5 border border-slate-200/85 dark:border-slate-800/40">
          <button
            id="device-btn-fluid"
            onClick={() => setDeviceMode('fluid')}
            className={`p-1.5 rounded-md transition-all duration-150 ${
              deviceMode === 'fluid'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="Fluid/Responsive Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            id="device-btn-tablet"
            onClick={() => setDeviceMode('tablet')}
            className={`p-1.5 rounded-md transition-all duration-150 ${
              deviceMode === 'tablet'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="Simulated Tablet Viewport"
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            id="device-btn-phone"
            onClick={() => setDeviceMode('phone')}
            className={`p-1.5 rounded-md transition-all duration-150 ${
              deviceMode === 'phone'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="Simulated Phone Viewport"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Preview Pane Arena */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-slate-200/50 dark:bg-slate-900/60">
        <div className={`transition-all duration-300 overflow-hidden relative ${getDeviceStyle()}`}>
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title="LiveFrame Live Preview"
            sandbox="allow-scripts allow-modals"
            className="w-full h-full border-none bg-white select-text"
          />

          {/* Absolute Error Trap Overlay */}
          {errorOverlay && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col justify-end p-6 text-white animate-fade-in select-text">
              <div className="flex items-start gap-3 bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 mb-4 select-text">
                <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-1">
                    Compilation Exception
                  </h3>
                  <p className="font-mono text-xs text-rose-200 break-words leading-relaxed whitespace-pre-wrap">
                    {errorOverlay}
                  </p>
                </div>
                <button
                  id="dismiss-error-btn"
                  onClick={() => setErrorOverlay(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss Error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
