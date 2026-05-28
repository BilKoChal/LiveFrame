/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { abbreviationTracker } from '@emmetio/codemirror6-plugin';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import { ActiveTab } from '../../types';

export default function CodeMirrorEditor() {
  const activeTab = useEditorStore((state) => state.activeTab);
  const htmlCode = useEditorStore((state) => state.html);
  const cssCode = useEditorStore((state) => state.css);
  const jsCode = useEditorStore((state) => state.javascript);
  const setHtml = useEditorStore((state) => state.setHtml);
  const setCss = useEditorStore((state) => state.setCss);
  const setJavascript = useEditorStore((state) => state.setJavascript);

  const theme = useUIStore((state) => state.theme);

  // Evaluate true dark state
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const getLanguageExtension = (tab: ActiveTab) => {
    switch (tab) {
      case 'html':
        // Emmet abbreviation tracker for HTML mode
        return [html(), abbreviationTracker()];
      case 'css':
        // Emmet abbreviation tracker for CSS mode
        return [css(), abbreviationTracker()];
      case 'javascript':
        return [javascript()];
      default:
        return [];
    }
  };

  const getCodeValue = () => {
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'javascript': return jsCode;
      default: return '';
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
