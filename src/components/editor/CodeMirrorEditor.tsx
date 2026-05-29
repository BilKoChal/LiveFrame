/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { abbreviationTracker } from '@emmetio/codemirror6-plugin';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { ActiveTab } from '../../types';
import type { FileType, FileId } from '../../types/project';

export default function CodeMirrorEditor() {
  const mode = useLayoutStore((s) => s.mode);
  const activeProject = useProjectStore((s) => s.activeProject);

  // Legacy single-file state
  const activeTab = useEditorStore((state) => state.activeTab);
  const htmlCode = useEditorStore((state) => state.html);
  const cssCode = useEditorStore((state) => state.css);
  const jsCode = useEditorStore((state) => state.javascript);
  const setHtml = useEditorStore((state) => state.setHtml);
  const setCss = useEditorStore((state) => state.setCss);
  const setJavascript = useEditorStore((state) => state.setJavascript);

  // Project mode state
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const fileContents = useEditorStore((s) => s.fileContents);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const files = useProjectStore((s) => s.files);

  const theme = useUIStore((state) => state.theme);

  // Evaluate true dark state
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const getLanguageExtension = (fileType: FileType | ActiveTab) => {
    switch (fileType) {
      case 'html':
        return [html(), abbreviationTracker()];
      case 'css':
        return [css(), abbreviationTracker()];
      case 'javascript':
        return [javascript()];
      case 'json':
        return [json()];
      default:
        return [];
    }
  };

  // ─── Project Mode ───────────────────────────────────────
  if (mode === 'project' && activeFileId) {
    const file = files[activeFileId];
    const content = fileContents[activeFileId] ?? file?.content ?? '';
    const fileType = file?.type ?? 'html';

    const handleChange = (value: string) => {
      // Single write target — editorStore auto-syncs to projectStore
      updateFileContent(activeFileId, value);
    };

    return (
      <div className="h-full w-full flex-1 overflow-hidden bg-slate-900 dark:bg-slate-950 flex flex-col">
        <CodeMirror
          value={content}
          height="100%"
          theme={isDark ? 'dark' : 'light'}
          extensions={getLanguageExtension(fileType)}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
          }}
          className="flex-1 h-full text-[13px] font-mono select-text outline-none focus:outline-none"
        />
      </div>
    );
  }

  // ─── Single-File Mode ───────────────────────────────────
  const getCodeValue = () => {
    switch (activeTab) {
      case 'html':
        return htmlCode;
      case 'css':
        return cssCode;
      case 'javascript':
        return jsCode;
      default:
        return '';
    }
  };

  const handleCodeChange = (value: string) => {
    switch (activeTab) {
      case 'html':
        setHtml(value);
        break;
      case 'css':
        setCss(value);
        break;
      case 'javascript':
        setJavascript(value);
        break;
    }
  };

  return (
    <div className="h-full w-full flex-1 overflow-hidden bg-slate-900 dark:bg-slate-950 flex flex-col">
      <CodeMirror
        value={getCodeValue()}
        height="100%"
        theme={isDark ? 'dark' : 'light'}
        extensions={getLanguageExtension(activeTab)}
        onChange={handleCodeChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightActiveLine: true,
        }}
        className="flex-1 h-full text-[13px] font-mono select-text outline-none focus:outline-none"
      />
    </div>
  );
}
