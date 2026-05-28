# LiveFrame — Editor & Preview Integration Report

> **Sub-agent**: Editor & Preview Integration Specialist  
> **Date**: 2025-03-04  
> **Stack**: React 18/19 + Vite + TypeScript + Tailwind CSS 4 + Zustand + shadcn/ui

---

## Table of Contents

1. [CodeMirror 6 Setup](#1-codemirror-6-setup)
2. [CodeMirror Extensions](#2-codemirror-extensions)
3. [Single-File Editor (3-Tab Switching)](#3-single-file-editor-3-tab-switching)
4. [Iframe Preview Implementation](#4-iframe-preview-implementation)
5. [Console Capture](#5-console-capture)
6. [Error Overlay](#6-error-overlay)
7. [Auto-Refresh & Debouncing](#7-auto-refresh--debouncing)
8. [Responsive Device Frames](#8-responsive-device-frames)
9. [Performance Considerations](#9-performance-considerations)

---

## 1. CodeMirror 6 Setup

### 1.1 Required Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@uiw/react-codemirror` | **4.25.10** | React wrapper for CM6; includes basic-setup extensions |
| `@codemirror/lang-html` | **6.4.11** | HTML syntax + autocomplete (includes CSS & JS nested modes) |
| `@codemirror/lang-css` | **6.3.1** | CSS/SCSS syntax highlighting + autocomplete |
| `@codemirror/lang-javascript` | **6.2.5** | JavaScript/TypeScript syntax + autocomplete |
| `@codemirror/theme-one-dark` | **6.1.3** | One Dark theme (dark mode) — already bundled by react-codemirror |
| `@emmetio/codemirror-plugin` | **1.2.4** | Emmet abbreviation expansion for HTML/CSS |
| `@codemirror/autocomplete` | **6.20.2** | Autocompletion infrastructure |
| `@codemirror/lint` | **6.9.6** | Linting infrastructure (for error markers) |
| `@codemirror/search` | **6.7.0** | Search & replace (Ctrl+F / Ctrl+H) |
| `@codemirror/state` | **6.x** | Core CM6 state management (peer dep) |
| `@codemirror/view` | **6.x** | Core CM6 view layer (peer dep) |
| `codemirror` | **6.x** | CM6 re-export package (peer dep) |

### 1.2 Installation Command

```bash
npm install @uiw/react-codemirror@^4.25.10 \
  @codemirror/lang-html@^6.4.11 \
  @codemirror/lang-css@^6.3.1 \
  @codemirror/lang-javascript@^6.2.5 \
  @codemirror/theme-one-dark@^6.1.3 \
  @emmetio/codemirror-plugin@^1.2.4 \
  @codemirror/autocomplete@^6.20.2 \
  @codemirror/lint@^6.9.6 \
  @codemirror/search@^6.7.0
```

> **Note**: `@uiw/react-codemirror` bundles `@uiw/codemirror-extensions-basic-setup` which already includes `@codemirror/commands`, bracket matching, close-brackets, highlight-active-line, highlight-special-chars, history (undo/redo), indent-on-input, keymap, line-numbers, rectangular-selection, and highlight-selection. You do **not** need to install these separately unless you want to override the default setup.

### 1.3 React Integration Pattern

The `@uiw/react-codemirror` package provides the `<CodeMirror />` component which handles the full lifecycle of the CM6 editor. The key integration pattern involves controlling the editor value from React state while also allowing CM6 to manage internal state for performance.

```tsx
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { emmet } from '@emmetio/codemirror-plugin';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'html' | 'css' | 'javascript';
  theme: 'dark' | 'light';
}

const langExtensions = {
  html: [html({ autoCloseTags: true })],
  css: [css()],
  javascript: [javascript({ jsx: true })],
};

export function LiveFrameEditor({ value, onChange, language, theme }: EditorProps) {
  const extensions = [
    ...langExtensions[language],
    emmet(),
  ];

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={theme === 'dark' ? oneDark : 'light'}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: true,
        indentOnInput: true,
        rectangularSelection: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
      }}
      className="h-full"
    />
  );
}
```

### 1.4 Theme Switching (Dark / Light)

`@uiw/react-codemirror` supports two approaches for theme switching:

**Approach A — Built-in theme strings**: Pass `"dark"` or `"light"` as a string. This uses CM6's default dark/light themes. Simple but limited.

**Approach B — Extension-based themes** (Recommended): Pass an actual theme extension object like `oneDark`. This provides a much richer visual experience. The component accepts either a string or an extension:

```tsx
// Recommended: use oneDark for dark mode, omit for light
const themeExtension = isDark ? oneDark : undefined;

<CodeMirror
  theme={themeExtension ?? 'light'}
  // ...
/>
```

**Important**: When switching themes, CM6 internally reconfigures the editor. The `theme` prop change triggers a `EditorView.dispatch` with the new theme extension. This is performant and does not cause a full remount. However, you must ensure the `theme` value actually changes (use `useMemo` or `useState`) to avoid unnecessary reconfigurations.

For custom themes that match the shadcn/ui design system, use `@codemirror/view`'s `EditorView.theme()`:

```tsx
import { EditorView } from '@codemirror/view';

const lightCustomTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#0f172a' },
  '.cm-content': { caretColor: '#0f172a' },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-gutters': { backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0' },
  '.cm-selectionBackground': { backgroundColor: '#bfdbfe !important' },
});

const darkCustomTheme = EditorView.theme({
  '&': { backgroundColor: '#0f172a', color: '#e2e8f0' },
  '.cm-content': { caretColor: '#e2e8f0' },
  '.cm-activeLine': { backgroundColor: '#1e293b' },
  '.cm-gutters': { backgroundColor: '#1e293b', borderRight: '1px solid #334155' },
  '.cm-selectionBackground': { backgroundColor: '#1e40af !important' },
});
```

### 1.5 Zustand Store for Editor State

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EditorState {
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  activeTab: 'html' | 'css' | 'javascript';
  isDarkTheme: boolean;
  autoRefresh: boolean;
  externalCSS: string[];   // URLs
  externalJS: string[];    // URLs

  setHtmlCode: (code: string) => void;
  setCssCode: (code: string) => void;
  setJsCode: (code: string) => void;
  setActiveTab: (tab: 'html' | 'css' | 'javascript') => void;
  toggleTheme: () => void;
  toggleAutoRefresh: () => void;
  addExternalCSS: (url: string) => void;
  removeExternalCSS: (url: string) => void;
  addExternalJS: (url: string) => void;
  removeExternalJS: (url: string) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      htmlCode: '<!DOCTYPE html>\n<html>\n<head>\n  <title>LiveFrame</title>\n</head>\n<body>\n  <h1>Hello, LiveFrame!</h1>\n</body>\n</html>',
      cssCode: 'body {\n  font-family: system-ui, sans-serif;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n}',
      jsCode: 'console.log("Hello from LiveFrame!");',
      activeTab: 'html',
      isDarkTheme: true,
      autoRefresh: true,
      externalCSS: [],
      externalJS: [],

      setHtmlCode: (code) => set({ htmlCode: code }),
      setCssCode: (code) => set({ cssCode: code }),
      setJsCode: (code) => set({ jsCode: code }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleTheme: () => set((s) => ({ isDarkTheme: !s.isDarkTheme })),
      toggleAutoRefresh: () => set((s) => ({ autoRefresh: !s.autoRefresh })),
      addExternalCSS: (url) => set((s) => ({ externalCSS: [...s.externalCSS, url] })),
      removeExternalCSS: (url) => set((s) => ({ externalCSS: s.externalCSS.filter((u) => u !== url) })),
      addExternalJS: (url) => set((s) => ({ externalJS: [...s.externalJS, url] })),
      removeExternalJS: (url) => set((s) => ({ externalJS: s.externalJS.filter((u) => u !== url) })),
    }),
    {
      name: 'liveframe-editor-storage',
      partialize: (state) => ({
        htmlCode: state.htmlCode,
        cssCode: state.cssCode,
        jsCode: state.jsCode,
        isDarkTheme: state.isDarkTheme,
        autoRefresh: state.autoRefresh,
        externalCSS: state.externalCSS,
        externalJS: state.externalJS,
      }),
    }
  )
);
```

> **Key design decision**: We persist code content and settings to `localStorage` via `zustand/middleware/persist`. The `activeTab` is intentionally excluded from `partialize` so it always resets to `html` on page load — a deliberate UX choice. The `partialize` function ensures only the necessary fields are serialized.

---

## 2. CodeMirror Extensions

### 2.1 Essential Extensions (Ship with MVP)

| Extension | Package | Why Essential |
|-----------|---------|---------------|
| **Basic Setup** | `@uiw/codemirror-extensions-basic-setup` (bundled) | Includes line numbers, active line highlight, bracket matching, close-brackets, history, indent-on-input, keymaps. Without this, the editor feels bare. |
| **Language Support** | `@codemirror/lang-html`, `lang-css`, `lang-javascript` | Syntax highlighting and language-aware editing is the core value proposition. `lang-html` includes nested CSS/JS highlighting. |
| **Emmet** | `@emmetio/codemirror-plugin@1.2.4` | Abbreviation expansion (`div.container>ul>li*5` → full HTML) is a must-have for HTML/CSS editors. Zero dependencies — it's standalone. |
| **Bracket Matching** | `@codemirror/language` (in basic-setup) | Highlights matching brackets when cursor is on one. Essential for code editing. |
| **Auto-Close Tags/Brackets** | `@codemirror/autocomplete` (in basic-setup) + `lang-html({ autoCloseTags: true })` | Automatically inserts closing tags and brackets. Drastically improves typing speed. |
| **Autocompletion** | `@codemirror/autocomplete@6.20.2` | Provides language-aware completions for HTML tags, CSS properties, JS globals. Essential for discoverability. |

### 2.2 Nice-to-Have Extensions (Post-MVP)

| Extension | Package | Why Nice-to-Have |
|-----------|---------|------------------|
| **Code Folding** | `@codemirror/language` (foldable) + fold gutter in basic-setup | Useful for long files, but not critical in a single-file editor where code is typically short. |
| **Search & Replace** | `@codemirror/search@6.7.0` | Ctrl+F / Ctrl+H is standard in editors, but users can also use browser Ctrl+F. Worth adding for completeness. |
| **Linting** | `@codemirror/lint@6.9.6` | Shows inline error/warning markers. Requires a linter source (e.g., ESLint for JS, Stylelint for CSS, HTMLHint for HTML). Needs backend setup. |
| **Rectangular Selection** | `@codemirror/rectangular-selection` (in basic-setup) | Alt+drag column selection. Nice for power users, not critical. |
| **Highlight Special Chars** | `@codemirror/view` (in basic-setup) | Shows zero-width characters, non-breaking spaces. Subtle quality-of-life improvement. |
| **Multiple Selections** | `@codemirror/state` (built-in) | Ctrl+D for multi-cursor. Already available via basic keymaps. |

### 2.3 Emmet Configuration

The Emmet plugin for CM6 is straightforward to configure:

```tsx
import { emmet } from '@emmetio/codemirror-plugin';

// In your extensions array:
const extensions = [
  html({ autoCloseTags: true }),
  emmet(),  // Works automatically for HTML and CSS
];
```

Emmet's `@emmetio/codemirror-plugin` v1.2.4 has zero runtime dependencies — it's a pure CM6 extension. It adds:

- **Tab key expansion**: Type `div.container` → press Tab → expands to `<div class="container"></div>`
- **Abbreviation tracking**: Shows preview of expansion as ghost text
- **CSS abbreviation support**: `m10` → `margin: 10px;`
- **Wrap with abbreviation**: Select text → Ctrl+Shift+A → wrap with Emmet abbreviation

### 2.4 Search Extension Setup

```tsx
import { search, searchKeymap } from '@codemirror/search';
import { keymap } from '@codemirror/view';

const searchExtensions = [
  search({
    top: true,  // Search bar appears at top
  }),
  keymap.of(searchKeymap),
];
```

### 2.5 Linting Setup (Post-MVP)

For MVP, linting can be deferred. When implemented:

```tsx
import { linter, Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';

// Example: Simple HTML linting
const htmlLinter = linter(async (view): Promise<Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];
  const code = view.state.doc.toString();
  
  // Check for unclosed tags (simplified)
  const openTags = code.match(/<(\w+)[^>]*[^/]>$/gm);
  // ... actual linting logic
  
  return diagnostics;
});
```

For production-quality linting, consider:
- **HTML**: `htmlhint` via a Web Worker
- **CSS**: `stylelint` via a Web Worker
- **JS**: `eslint` via a Web Worker (or use the browser-native approach with `esprima` for parsing)

All linters should run asynchronously in a Web Worker to avoid blocking the editor UI thread.

---

## 3. Single-File Editor (3-Tab Switching)

### 3.1 Architecture Overview

LiveFrame uses a single-file paradigm where the user edits HTML, CSS, and JavaScript in three separate tabs within a single editor pane. This differs from CodePen's approach (which shows all three simultaneously) and is optimized for smaller screens or split-pane layouts where vertical space is limited.

### 3.2 Tab Component

```tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorStore } from '@/stores/editorStore';

const TAB_CONFIG = [
  { key: 'html' as const, label: 'HTML', shortcut: 'Ctrl+1' },
  { key: 'css' as const, label: 'CSS', shortcut: 'Ctrl+2' },
  { key: 'javascript' as const, label: 'JS', shortcut: 'Ctrl+3' },
] as const;

export function EditorTabs() {
  const { activeTab, setActiveTab } = useEditorStore();

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <TabsList className="bg-muted/50">
        {TAB_CONFIG.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

### 3.3 Tab Switching with Editor Instance Preservation

The most critical performance concern is what happens when the user switches tabs. There are three strategies:

**Strategy A — Unmount/Remount (Simple but slow)**: Each tab switch destroys the CM6 instance and creates a new one. This causes a visible flicker and loses cursor position, scroll position, and undo history. **Not recommended.**

**Strategy B — CSS visibility toggle (Fast but memory-heavy)**: Render all three editors simultaneously, hide inactive ones with `display: none` or `visibility: hidden`. This preserves all state but uses 3x memory and creates 3 CM6 instances.

**Strategy C — State preservation with single instance (Recommended)**: Use a single CM6 instance, swap the document content and extensions when the tab changes. This is the most efficient approach.

```tsx
import { useMemo, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorState } from '@codemirror/state';
import { useEditorStore } from '@/stores/editorStore';

export function TabbedEditor() {
  const {
    activeTab,
    htmlCode, cssCode, jsCode,
    setHtmlCode, setCssCode, setJsCode,
    isDarkTheme,
  } = useEditorStore();

  // Store editor states for each tab so cursor/scroll/undo are preserved
  const savedStates = useRef<Record<string, EditorState | null>>({
    html: null,
    css: null,
    javascript: null,
  });

  const codeByTab = useMemo(() => ({
    html: htmlCode,
    css: cssCode,
    javascript: jsCode,
  }), [htmlCode, cssCode, jsCode]);

  const onChangeByTab = useMemo(() => ({
    html: setHtmlCode,
    css: setCssCode,
    javascript: setJsCode,
  }), [setHtmlCode, setCssCode, setJsCode]);

  const currentCode = codeByTab[activeTab];
  const currentOnChange = onChangeByTab[activeTab];

  // Save current state before switching, restore after
  const handleCreateEditor = useCallback((view: any, state: EditorState) => {
    savedStates.current[activeTab] = state;
  }, [activeTab]);

  return (
    <div className="h-full flex flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          key={activeTab}  // Forces remount on tab change
          value={currentCode}
          onChange={currentOnChange}
          theme={isDarkTheme ? oneDark : 'light'}
          extensions={getExtensionsForTab(activeTab)}
          onCreateEditor={handleCreateEditor}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            foldGutter: true,
          }}
          className="h-full"
        />
      </div>
    </div>
  );
}
```

### 3.4 Cursor Position Preservation

To preserve cursor position across tab switches, save the `Selection` from `EditorState` before the tab change and restore it after:

```tsx
// Save: before tab switch
const currentView = editorRef.current;
if (currentView) {
  savedSelections.current[prevTab] = currentView.state.selection;
}

// Restore: after tab switch (in onCreateEditor callback)
const savedSelection = savedSelections.current[activeTab];
if (savedSelection) {
  view.dispatch({
    selection: savedSelection,
  });
}
```

### 3.5 Tab Persistence

Tabs are **not** persisted to localStorage (intentionally). When the user reloads the page, they always start on the HTML tab. This is a UX convention — the HTML tab is the "entry point" of any web page, so it's the natural starting point. However, if persistence is desired, simply add `activeTab` to the `partialize` function in the Zustand store.

### 3.6 Keyboard Shortcuts for Tab Switching

```tsx
import { keymap } from '@codemirror/view';

const tabSwitchKeymap = keymap.of([
  { key: 'Ctrl-1', run: () => { setActiveTab('html'); return true; } },
  { key: 'Ctrl-2', run: () => { setActiveTab('css'); return true; } },
  { key: 'Ctrl-3', run: () => { setActiveTab('javascript'); return true; } },
]);
```

> **Note**: These keymaps must be added as extensions to the CodeMirror instance, not as React event listeners, because the editor captures keyboard input. React-level `onKeyDown` won't fire when the editor has focus.

---

## 4. Iframe Preview Implementation

### 4.1 srcdoc Assembly

The core of the preview is assembling the user's HTML, CSS, and JS code into a single HTML document and injecting it into an iframe via the `srcdoc` attribute. This is the **recommended approach** over blob URLs for security and simplicity.

```tsx
import { useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';

function assembleDocument(
  htmlCode: string,
  cssCode: string,
  jsCode: string,
  externalCSS: string[],
  externalJS: string[]
): string {
  // Inject console capture script
  const consoleCaptureScript = `
<script>
(function() {
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  function serialize(args) {
    return Array.from(args).map(arg => {
      if (arg === null) return { type: 'null', value: 'null' };
      if (arg === undefined) return { type: 'undefined', value: 'undefined' };
      if (typeof arg === 'object') {
        try { return { type: typeof arg, value: JSON.stringify(arg, null, 2) }; }
        catch (e) { return { type: typeof arg, value: String(arg) }; }
      }
      return { type: typeof arg, value: String(arg) };
    });
  }

  ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
    console[method] = function(...args) {
      originalConsole[method](...args);
      window.parent.postMessage({
        type: 'liveframe:console',
        method: method,
        args: serialize(args),
        timestamp: Date.now(),
      }, '*');
    };
  });

  // Catch runtime errors
  window.onerror = function(message, source, lineno, colno, error) {
    window.parent.postMessage({
      type: 'liveframe:error',
      message: String(message),
      source: source || '',
      lineno: lineno || 0,
      colno: colno || 0,
      stack: error?.stack || '',
    }, '*');
    return false; // Don't prevent default browser error handling
  };

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    window.parent.postMessage({
      type: 'liveframe:error',
      message: 'Unhandled Promise Rejection: ' + String(event.reason),
      source: '',
      lineno: 0,
      colno: 0,
      stack: event.reason?.stack || '',
    }, '*');
  });
})();
</script>`;

  // Build external CSS links
  const externalCSSLinks = externalCSS
    .map((url) => `<link rel="stylesheet" href="${escapeAttr(url)}">`)
    .join('\n');

  // Build external JS scripts
  const externalJSScripts = externalJS
    .map((url) => `<script src="${escapeAttr(url)}"><\/script>`)
    .join('\n');

  // Try to insert CSS and JS into the user's HTML intelligently
  const styleTag = cssCode.trim() ? `<style>\n${cssCode}\n</style>` : '';
  const scriptTag = jsCode.trim()
    ? `<script>\n// CodeMirror live capture wrapper\ntry {\n${jsCode}\n} catch(e) {\n  window.onerror(e.message, '', 0, 0, e);\n}\n<\/script>`
    : '';

  // If the user's HTML contains <head> and <body>, inject into them
  if (htmlCode.includes('<head>') && htmlCode.includes('</head>')) {
    let doc = htmlCode;
    // Inject external CSS + user CSS into <head>
    doc = doc.replace('</head>', `${externalCSSLinks}\n${styleTag}\n</head>`);
    // Inject console capture + external JS + user JS before </body>
    doc = doc.replace('</body>', `${consoleCaptureScript}\n${externalJSScripts}\n${scriptTag}\n</body>`);
    return doc;
  }

  // Fallback: wrap in a basic HTML document
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${externalCSSLinks}
  ${styleTag}
</head>
<body>
  ${htmlCode}
  ${consoleCaptureScript}
  ${externalJSScripts}
  ${scriptTag}
</body>
</html>`;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

### 4.2 Iframe Component

```tsx
import { useRef, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/stores/editorStore';

export function PreviewFrame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { htmlCode, cssCode, jsCode, externalCSS, externalJS } = useEditorStore();

  const srcdoc = useMemo(
    () => assembleDocument(htmlCode, cssCode, jsCode, externalCSS, externalJS),
    [htmlCode, cssCode, jsCode, externalCSS, externalJS]
  );

  return (
    <iframe
      ref={iframeRef}
      srcdoc={srcdoc}
      sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
      className="w-full h-full border-0 bg-white"
      title="LiveFrame Preview"
    />
  );
}
```

### 4.3 srcdoc vs Blob URL Comparison

| Aspect | srcdoc | Blob URL |
|--------|--------|----------|
| **Simplicity** | Single attribute, no cleanup needed | Requires `URL.createObjectURL()` + `URL.revokeObjectURL()` |
| **Security** | Respects `sandbox` attribute fully | Blob URLs with `allow-same-origin` can escape sandbox |
| **Performance** | Direct HTML injection, no network request | Creates a new origin — triggers full page load pipeline |
| **Memory** | Browser manages lifecycle | Must manually revoke to prevent memory leaks |
| **External Resources** | Works with absolute URLs | Same-origin policy may block relative URLs |
| **Content Security** | CSP applies via sandbox | Harder to enforce CSP |
| **Recommendation** | **Use srcdoc** ✅ | Only for advanced use cases |

### 4.4 Sandbox Attributes

The `sandbox` attribute is critical for security. Here's what each flag allows:

```
sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
```

| Flag | Why Needed |
|------|-----------|
| `allow-scripts` | User's JavaScript must execute for the preview to work |
| `allow-modals` | Allows `alert()`, `confirm()`, `prompt()` — common in beginner code |
| `allow-forms` | Allows form submission — needed for interactive demos |
| `allow-same-origin` | **Careful!** Needed for localStorage, cookies, and some APIs. Without it, many scripts break. With it, the iframe can access the parent's origin. Mitigated by srcdoc (different origin). |

**Security recommendation**: Use `allow-same-origin` only with `srcdoc`. The `srcdoc` attribute creates a unique origin (`about:srcdoc`) that is not same-origin with the parent, even with `allow-same-origin`. This means the iframe cannot access parent cookies, localStorage, or DOM, but CAN use its own localStorage. This is the safest configuration.

**Do NOT add** `allow-top-navigation` or `allow-popups` without careful consideration, as these allow the user's code to navigate away from the editor.

### 4.5 Handling External Resources

External CSS and JS resources are injected as `<link>` and `<script>` tags into the assembled document. There are two important considerations:

1. **CORS**: External stylesheets and scripts from CDNs (like Tailwind CSS, Bootstrap, Three.js) generally have proper CORS headers. If a resource fails to load, the iframe's `onerror` won't fire for `<link>` tags. Consider adding an `onerror` handler on `<link>` elements:

```tsx
const externalCSSLinks = externalCSS.map((url) => 
  `<link rel="stylesheet" href="${escapeAttr(url)}" onerror="window.parent.postMessage({type:'liveframe:resource-error',url:'${escapeAttr(url)}',kind:'css'},'*')">`
).join('\n');
```

2. **Load Order**: External JS should be loaded before user JS. Use the `defer` attribute or place external `<script>` tags before the user's `<script>` tag. For scripts that need to execute in order, place them without `defer`:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>
  // User code that depends on Tailwind
</script>
```

---

## 5. Console Capture

### 5.1 Architecture

Console capture works by overriding `console.log`, `console.warn`, `console.error`, `console.info`, and `console.debug` inside the iframe, then forwarding each call to the parent window via `postMessage`. The parent window listens for these messages and displays them in a console panel.

### 5.2 Injection Script (Runs Inside Iframe)

This script is injected at the top of `<body>` in the assembled document, before any user code:

```javascript
(function() {
  // Preserve originals for passthrough
  const _console = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    clear: console.clear.bind(console),
  };

  function serializeArg(arg) {
    if (arg === null) return { type: 'null', value: 'null' };
    if (arg === undefined) return { type: 'undefined', value: 'undefined' };
    if (typeof arg === 'string') return { type: 'string', value: arg };
    if (typeof arg === 'number') return { type: 'number', value: String(arg) };
    if (typeof arg === 'boolean') return { type: 'boolean', value: String(arg) };
    if (typeof arg === 'function') return { type: 'function', value: arg.toString() };
    if (arg instanceof Error) return { type: 'error', value: arg.message, stack: arg.stack || '' };
    if (Array.isArray(arg)) {
      try { return { type: 'array', value: JSON.stringify(arg, null, 2) }; }
      catch { return { type: 'array', value: String(arg) }; }
    }
    if (typeof arg === 'object') {
      try { return { type: 'object', value: JSON.stringify(arg, null, 2) }; }
      catch { return { type: 'object', value: String(arg) }; }
    }
    return { type: typeof arg, value: String(arg) };
  }

  function sendToParent(method, args) {
    try {
      window.parent.postMessage({
        type: 'liveframe:console',
        method,
        args: Array.from(args).map(serializeArg),
        timestamp: Date.now(),
      }, '*');
    } catch (e) {
      // postMessage serialization failed — fallback
      _console.error('LiveFrame console capture failed:', e);
    }
  }

  // Override console methods
  console.log = function(...args) { _console.log(...args); sendToParent('log', args); };
  console.warn = function(...args) { _console.warn(...args); sendToParent('warn', args); };
  console.error = function(...args) { _console.error(...args); sendToParent('error', args); };
  console.info = function(...args) { _console.info(...args); sendToParent('info', args); };
  console.debug = function(...args) { _console.debug(...args); sendToParent('debug', args); };
  console.clear = function() {
    _console.clear();
    window.parent.postMessage({ type: 'liveframe:console-clear' }, '*');
  };
})();
```

### 5.3 Parent Listener (React Component)

```tsx
import { useEffect, useCallback } from 'react';

interface ConsoleEntry {
  id: string;
  method: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: Array<{ type: string; value: string; stack?: string }>;
  timestamp: number;
  count: number; // for deduplication
}

export function useConsoleCapture(
  onEntry: (entry: ConsoleEntry) => void,
  onClear: () => void
) {
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'liveframe:console') {
      onEntry({
        id: `${event.data.timestamp}-${Math.random().toString(36).slice(2)}`,
        method: event.data.method,
        args: event.data.args,
        timestamp: event.data.timestamp,
        count: 1,
      });
    } else if (event.data?.type === 'liveframe:console-clear') {
      onClear();
    }
  }, [onEntry, onClear]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
}
```

### 5.4 Console Panel Component

```tsx
import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const METHOD_COLORS: Record<string, string> = {
  log: 'text-foreground',
  warn: 'text-yellow-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  debug: 'text-muted-foreground',
};

const METHOD_BADGES: Record<string, string> = {
  log: 'bg-secondary text-secondary-foreground',
  warn: 'bg-yellow-500/15 text-yellow-600',
  error: 'bg-red-500/15 text-red-600',
  info: 'bg-blue-500/15 text-blue-600',
  debug: 'bg-muted text-muted-foreground',
};

export function ConsolePanel({ entries }: { entries: ConsoleEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <ScrollArea className="h-full font-mono text-xs">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex items-start gap-2 px-3 py-1.5 border-b border-border/50 ${
            entry.method === 'error' ? 'bg-red-500/5' : 
            entry.method === 'warn' ? 'bg-yellow-500/5' : ''
          }`}
        >
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${METHOD_BADGES[entry.method]}`}>
            {entry.method}
          </Badge>
          <div className={`flex-1 whitespace-pre-wrap break-all ${METHOD_COLORS[entry.method]}`}>
            {entry.args.map((arg, i) => (
              <span key={i}>
                {i > 0 && ' '}
                {arg.type === 'object' || arg.type === 'array' 
                  ? arg.value 
                  : arg.type === 'undefined' 
                    ? <span className="text-muted-foreground italic">undefined</span>
                    : arg.value}
              </span>
            ))}
          </div>
          <span className="text-muted-foreground text-[10px] shrink-0">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
      <div ref={scrollRef} />
    </ScrollArea>
  );
}
```

### 5.5 postMessage Protocol

| Message Type | Direction | Payload |
|-------------|-----------|---------|
| `liveframe:console` | iframe → parent | `{ type, method, args: [{type, value}], timestamp }` |
| `liveframe:console-clear` | iframe → parent | `{ type }` |
| `liveframe:error` | iframe → parent | `{ type, message, source, lineno, colno, stack }` |
| `liveframe:resource-error` | iframe → parent | `{ type, url, kind }` |

All messages use `'*'` as the target origin for simplicity. For production, consider specifying the exact origin: `window.parent.postMessage(data, window.location.origin)`.

---

## 6. Error Overlay

### 6.1 Types of Errors

LiveFrame must handle two distinct error categories:

1. **Runtime Errors** — Occur during execution of user code inside the iframe (JavaScript errors, unhandled rejections). These are caught by `window.onerror` and `unhandledrejection` handlers injected into the iframe.

2. **Syntax Errors** — Detected by CodeMirror's linting before execution. These are shown inline in the editor.

### 6.2 Runtime Error Capture

The injection script from Section 5.2 already includes `window.onerror` and `unhandledrejection` handlers. Here's how the parent processes them:

```tsx
interface RuntimeError {
  id: string;
  message: string;
  source: string;
  lineno: number;
  colno: number;
  stack: string;
  timestamp: number;
}

export function useErrorCapture(onError: (error: RuntimeError) => void) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'liveframe:error') {
        onError({
          id: `error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          message: event.data.message,
          source: event.data.source,
          lineno: event.data.lineno,
          colno: event.data.colno,
          stack: event.data.stack,
          timestamp: Date.now(),
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onError]);
}
```

### 6.3 Error Overlay UI

The error overlay appears as a semi-transparent panel at the bottom of the preview pane. It shows the most recent error with a stack trace, and a count badge for additional errors:

```tsx
import { AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

interface ErrorOverlayProps {
  errors: RuntimeError[];
  onDismiss: () => void;
}

export function ErrorOverlay({ errors, onDismiss }: ErrorOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const latestError = errors[errors.length - 1];

  if (!latestError) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="absolute bottom-0 left-0 right-0 bg-red-950/95 text-red-100 border-t border-red-500/50 backdrop-blur-sm"
      >
        {/* Compact bar */}
        <div className="flex items-center gap-2 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm font-medium truncate flex-1">
            {latestError.message}
          </span>
          {errors.length > 1 && (
            <Badge className="bg-red-500/20 text-red-300">
              +{errors.length - 1}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-300 hover:text-red-100"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-300 hover:text-red-100"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Expanded stack trace */}
        {isExpanded && latestError.stack && (
          <div className="px-3 pb-2">
            <pre className="text-xs text-red-300/80 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
              {formatStackTrace(latestError.stack)}
            </pre>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

### 6.4 Syntax Error Display in Editor

For syntax errors caught during editing (via CodeMirror linting), errors appear inline as underlines with hover tooltips:

```tsx
import { linter, lintGutter } from '@codemirror/lint';

// CSS syntax validation using the CSS parser
const cssSyntaxLinter = linter(
  (view) => {
    const diagnostics: Diagnostic[] = [];
    // Use @lezer/css to parse and find syntax errors
    // ... implementation
    return diagnostics;
  },
  { delay: 750 }  // Wait 750ms after last keystroke
);
```

For the MVP, syntax error linting can be deferred — runtime errors are far more common and impactful for users. The error overlay for runtime errors should be the priority.

---

## 7. Auto-Refresh & Debouncing

### 7.1 Strategy Overview

LiveFrame provides two modes for preview refresh:

1. **Auto-refresh** (default ON): The preview updates automatically as the user types, with debouncing to avoid excessive iframe refreshes.
2. **Manual refresh**: The user clicks a refresh button (or presses Ctrl+Enter) to update the preview.

### 7.2 Debounce Implementation

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';

const DEBOUNCE_MS = 400; // Sweet spot between responsiveness and performance

export function useAutoRefresh(
  refreshCallback: () => void
) {
  const { htmlCode, cssCode, jsCode, autoRefresh, externalCSS, externalJS } = useEditorStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const debouncedRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      refreshCallback();
      lastRefreshRef.current = Date.now();
    }, DEBOUNCE_MS);
  }, [refreshCallback]);

  useEffect(() => {
    if (autoRefresh) {
      debouncedRefresh();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [htmlCode, cssCode, jsCode, externalCSS, externalJS, autoRefresh, debouncedRefresh]);

  return { debouncedRefresh };
}
```

### 7.3 Refresh Controller Component

```tsx
import { RefreshCw, Play, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface RefreshControlsProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export function RefreshControls({
  autoRefresh,
  onToggleAutoRefresh,
  onManualRefresh,
  isRefreshing,
}: RefreshControlsProps) {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex items-center gap-1.5">
        <Switch
          id="auto-refresh"
          checked={autoRefresh}
          onCheckedChange={onToggleAutoRefresh}
          className="scale-75"
        />
        <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">
          Auto
        </Label>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onManualRefresh}
        title="Refresh Preview (Ctrl+Enter)"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
```

### 7.4 Debounce Timing Analysis

| Delay | User Experience | Performance |
|-------|----------------|-------------|
| 100ms | Feels instant, but many refreshes during fast typing | High CPU/memory churn |
| 300ms | Good balance — feels responsive | Moderate |
| **400ms** | **Recommended** — noticeable but not laggy | Good |
| 500ms | Slightly noticeable delay | Excellent |
| 1000ms | Feels sluggish | Minimal overhead |

**Recommendation**: Use **400ms** for the debounce. This gives the user enough time to finish a "thought" (typing a word or line) before the preview refreshes. For users who prefer instant feedback, they can type in the CSS/JS tabs where changes are less computationally expensive and use a shorter debounce (250ms).

### 7.5 Smart Refresh — Only Refresh When Necessary

Not all code changes require a full iframe refresh. An optimization is to detect which tab changed and decide:

- **CSS change only**: Inject updated `<style>` tag without full refresh
- **HTML/JS change**: Full refresh required (HTML structure change, JS re-execution)

```tsx
const lastChangedTab = useRef<string>('');

// In the debounce callback:
const smartRefresh = useCallback(() => {
  if (lastChangedTab.current === 'css' && !jsCode.includes('document.querySelector')) {
    // CSS-only change: try hot-patching the style tag
    try {
      const iframe = iframeRef.current;
      const styleEl = iframe?.contentDocument?.getElementById('liveframe-user-style');
      if (styleEl) {
        styleEl.textContent = cssCode;
        return; // Skip full refresh
      }
    } catch {
      // Cross-origin or other error — fall through to full refresh
    }
  }
  // Full refresh
  setRefreshKey((k) => k + 1);
}, [cssCode, jsCode]);
```

> **Caveat**: Hot-patching CSS requires `allow-same-origin` on the iframe sandbox and the iframe must be on the same origin. Since `srcdoc` creates a unique origin, hot-patching via `contentDocument` will fail unless `allow-same-origin` is set. **This optimization is complex and fragile — defer to post-MVP.**

---

## 8. Responsive Device Frames

### 8.1 Architecture

The device frame feature wraps the preview iframe in a container that simulates different device dimensions. This involves:

1. A frame container with CSS to simulate a phone/tablet/desktop bezel
2. Resizing the iframe to match the device's viewport dimensions
3. A `ResizeObserver` to detect when the user manually resizes the preview pane

### 8.2 Device Presets

```tsx
interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: string; // lucide icon name
  category: 'phone' | 'tablet' | 'desktop';
}

const DEVICE_PRESETS: DevicePreset[] = [
  // Phones
  { name: 'iPhone SE', width: 375, height: 667, icon: 'smartphone', category: 'phone' },
  { name: 'iPhone 14', width: 390, height: 844, icon: 'smartphone', category: 'phone' },
  { name: 'Pixel 7', width: 412, height: 915, icon: 'smartphone', category: 'phone' },
  { name: 'Galaxy S22', width: 360, height: 780, icon: 'smartphone', category: 'phone' },
  // Tablets
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'tablet', category: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'tablet', category: 'tablet' },
  { name: 'Surface Duo', width: 540, height: 720, icon: 'tablet', category: 'tablet' },
  // Desktops
  { name: 'Laptop', width: 1366, height: 768, icon: 'laptop', category: 'desktop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'monitor', category: 'desktop' },
  { name: 'Responsive', width: 0, height: 0, icon: 'maximize', category: 'desktop' },
];
```

The "Responsive" preset (width: 0, height: 0) means the iframe fills the available container — no fixed dimensions.

### 8.3 Device Frame Component

```tsx
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DeviceFrameProps {
  children: React.ReactNode; // The iframe
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(DEVICE_PRESETS[9]); // Responsive
  const [zoom, setZoom] = useState(1);

  const isResponsive = selectedDevice.width === 0;

  // Calculate zoom to fit the device frame within the available space
  const containerWidth = useContainerWidth(); // From ResizeObserver

  useEffect(() => {
    if (isResponsive) {
      setZoom(1);
      return;
    }
    // Auto-fit: scale down if the device is wider than the container
    const newZoom = Math.min(1, (containerWidth - 48) / selectedDevice.width);
    setZoom(newZoom);
  }, [selectedDevice, containerWidth, isResponsive]);

  return (
    <div className="h-full flex flex-col">
      {/* Device selector toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <Select
          value={selectedDevice.name}
          onValueChange={(name) => {
            const device = DEVICE_PRESETS.find((d) => d.name === name)!;
            setSelectedDevice(device);
          }}
        >
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEVICE_PRESETS.map((device) => (
              <SelectItem key={device.name} value={device.name} className="text-xs">
                {device.name} ({device.width}×{device.height})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isResponsive && (
          <span className="text-xs text-muted-foreground">
            {selectedDevice.width}×{selectedDevice.height} · {Math.round(zoom * 100)}%
          </span>
        )}
      </div>

      {/* Preview area with device frame */}
      <div className="flex-1 flex items-center justify-center bg-muted/30 overflow-auto p-4">
        <div
          className="relative bg-white rounded-lg overflow-hidden shadow-lg transition-all duration-300"
          style={{
            width: isResponsive ? '100%' : `${selectedDevice.width}px`,
            height: isResponsive ? '100%' : `${selectedDevice.height}px`,
            transform: isResponsive ? 'none' : `scale(${zoom})`,
            transformOrigin: 'top center',
            // For non-responsive, add a phone-like bezel
            ...(selectedDevice.category === 'phone' ? {
              borderRadius: '2rem',
              border: '8px solid #1e293b',
            } : {}),
            ...(selectedDevice.category === 'tablet' ? {
              borderRadius: '1rem',
              border: '6px solid #1e293b',
            } : {}),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
```

### 8.4 ResizeObserver Hook

```tsx
import { useEffect, useState, useRef } from 'react';

export function useContainerWidth(): number {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return width;
}

// Full version returning ref + dimensions
export function useResizeObserver() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...dimensions };
}
```

### 8.5 Phone Notch Simulation (Post-MVP)

For a more realistic phone frame, add a CSS notch at the top:

```css
.device-phone::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 28px;
  background: #1e293b;
  border-radius: 0 0 16px 16px;
  z-index: 10;
}
```

---

## 9. Performance Considerations

### 9.1 Iframe Memory Management

Each iframe refresh via `srcdoc` creates a new document. The browser must:

1. Destroy the old document (including its JavaScript context, DOM, CSSOM)
2. Parse the new HTML
3. Create a new JavaScript context
4. Execute scripts

This is expensive. Key optimizations:

**Use `key` prop for forced remount** — Instead of updating `srcdoc` on the same iframe, use a `key` that changes to force React to unmount and remount the iframe. This ensures complete cleanup:

```tsx
const [refreshKey, setRefreshKey] = useState(0);

<iframe
  key={refreshKey}
  srcdoc={srcdoc}
  // ...
/>
```

**Clean up event listeners** — The `postMessage` listener in the parent must be cleaned up when the component unmounts. The `useEffect` cleanup function handles this.

**Avoid rapid refreshes** — The 400ms debounce is critical. Without it, fast typists can trigger 10+ refreshes per second, each creating a new iframe document. This causes:

- Memory spikes (old documents waiting for GC)
- CPU spikes (parsing + executing)
- Flickering (visual instability)

### 9.2 CodeMirror Instance Lifecycle

CM6 is designed for efficient updates — it uses an immutable state architecture where changes create new state objects without mutating the old ones. However, there are still lifecycle concerns:

**Unmounting cleanup**: When a tab switches or the component unmounts, CM6's `EditorView` must be properly destroyed. The `@uiw/react-codemirror` component handles this automatically — it calls `view.destroy()` in its cleanup effect.

**Extension reconfiguration**: When the theme changes, CM6 reconfigures the editor by dispatching a transaction with new extensions. This is O(n) in the number of extensions, but for typical setups (10-20 extensions), this is negligible.

**Avoid unnecessary re-renders**: The `<CodeMirror>` component re-renders when its props change. Use `React.memo` and stable references:

```tsx
const MemoizedEditor = React.memo(LiveFrameEditor);

// In the parent:
const handleChange = useCallback((value: string) => {
  setCode(value);
}, []);

const extensions = useMemo(() => getExtensionsForTab(activeTab), [activeTab]);
```

### 9.3 Preventing Memory Leaks on Tab Switches

The primary memory leak risk is from CM6 `EditorState` objects that are kept alive by closures or refs. Here's the strategy:

```tsx
// Use a WeakRef to store saved states — allows GC when memory is pressured
const savedStates = useRef<Record<string, WeakRef<EditorState> | null>>({
  html: null,
  css: null,
  javascript: null,
});

// When saving state:
const view = editorViewRef.current;
if (view) {
  savedStates.current[activeTab] = new WeakRef(view.state);
}

// When restoring state:
const savedState = savedStates.current[activeTab]?.deref();
if (savedState) {
  // Restore...
}
```

Alternatively, for a simpler approach, only save the selection (cursor position) and scroll position, not the full `EditorState`:

```tsx
const savedPositions = useRef<Record<string, { cursor: number; scroll: number }>>({
  html: { cursor: 0, scroll: 0 },
  css: { cursor: 0, scroll: 0 },
  javascript: { cursor: 0, scroll: 0 },
});
```

### 9.4 Iframe srcdoc Size Limitations

Browsers impose limits on the `srcdoc` attribute size. In practice:

- **Chrome**: No hard limit, but extremely large srcdoc (>10MB) causes sluggish behavior
- **Firefox**: No hard limit, similar performance concerns
- **Safari**: More conservative; srcdoc >5MB can cause issues

For LiveFrame's use case (single-file HTML/CSS/JS), the total code size is typically under 100KB, well within limits.

### 9.5 Web Workers for Heavy Processing

For future features like linting or code formatting, offload CPU-intensive work to Web Workers:

```tsx
// lintWorker.ts
const worker = new Worker(
  new URL('../workers/lintWorker.ts', import.meta.url),
  { type: 'module' }
);

worker.postMessage({ code: jsCode, language: 'javascript' });
worker.onmessage = (e) => {
  const diagnostics = e.data.diagnostics;
  // Apply to CodeMirror
};
```

### 9.6 Summary of Performance Best Practices

| Practice | Impact | Priority |
|----------|--------|----------|
| Debounce preview refresh (400ms) | **High** — prevents CPU/memory spikes | MVP |
| Use `key` prop for iframe remount | **High** — ensures clean document disposal | MVP |
| Memoize CodeMirror extensions | **Medium** — prevents unnecessary reconfigurations | MVP |
| Memoize onChange callback | **Medium** — prevents unnecessary re-renders | MVP |
| WeakRef for saved editor states | **Low** — only matters under memory pressure | Post-MVP |
| Web Workers for linting/formatting | **Medium** — prevents UI jank on large files | Post-MVP |
| CSS hot-patching (skip iframe refresh) | **Medium** — faster CSS iteration | Post-MVP |
| Virtualized console entries | **Low** — only matters with 1000+ log entries | Post-MVP |

---

## Appendix A: Complete Extension Configuration Reference

```tsx
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { emmet } from '@emmetio/codemirror-plugin';
import { search, searchKeymap } from '@codemirror/search';
import { linter } from '@codemirror/lint';
import { keymap } from '@codemirror/view';
import { EditorView } from '@codemirror/view';

function getExtensionsForTab(tab: 'html' | 'css' | 'javascript') {
  const base = [
    keymap.of([
      ...searchKeymap,
    ]),
  ];

  switch (tab) {
    case 'html':
      return [
        ...base,
        html({ autoCloseTags: true }),
        emmet(),
      ];
    case 'css':
      return [
        ...base,
        css(),
        emmet(),
      ];
    case 'javascript':
      return [
        ...base,
        javascript({ jsx: true, typescript: false }),
      ];
  }
}
```

## Appendix B: Full srcdoc Assembly (Production-Ready)

```tsx
export function assembleDocument(
  htmlCode: string,
  cssCode: string,
  jsCode: string,
  externalCSS: string[],
  externalJS: string[],
): string {
  const escapedJS = jsCode.replace(/<\/script/gi, '<\\/script');
  
  const consoleCapture = `<script>
(function(){
var O={log:console.log.bind(console),warn:console.warn.bind(console),error:console.error.bind(console),info:console.info.bind(console),debug:console.debug.bind(console),clear:console.clear.bind(console)};
function S(a){if(a===null)return{t:'null',v:'null'};if(a===undefined)return{t:'undefined',v:'undefined'};if(typeof a==='object'){try{return{t:typeof a,v:JSON.stringify(a,null,2)}}catch(e){return{t:typeof a,v:String(a)}}}return{t:typeof a,v:String(a)}}
function P(m,a){try{window.parent.postMessage({type:'liveframe:console',method:m,args:Array.from(a).map(S),ts:Date.now()},'*')}catch(e){}}
console.log=function(){O.log.apply(console,arguments);P('log',arguments)};
console.warn=function(){O.warn.apply(console,arguments);P('warn',arguments)};
console.error=function(){O.error.apply(console,arguments);P('error',arguments)};
console.info=function(){O.info.apply(console,arguments);P('info',arguments)};
console.debug=function(){O.debug.apply(console,arguments);P('debug',arguments)};
console.clear=function(){O.clear();window.parent.postMessage({type:'liveframe:console-clear'},'*')};
window.onerror=function(m,s,l,c,e){window.parent.postMessage({type:'liveframe:error',message:String(m),source:s||'',lineno:l||0,colno:c||0,stack:e&&e.stack||''},'*');return false};
window.addEventListener('unhandledrejection',function(e){window.parent.postMessage({type:'liveframe:error',message:'Unhandled Rejection: '+String(e.reason),source:'',lineno:0,colno:0,stack:e.reason&&e.reason.stack||''},'*')});
})();
<\/script>`;

  const cssLinks = externalCSS.map(u => `<link rel="stylesheet" href="${esc(u)}">`).join('');
  const jsScripts = externalJS.map(u => `<script src="${esc(u)}"><\/script>`).join('');
  const style = cssCode.trim() ? `<style id="liveframe-user-style">\n${cssCode}\n</style>` : '';
  const script = escapedJS.trim() ? `<script>\ntry{\n${escapedJS}\n}catch(e){window.onerror(e.message,'',0,0,e)}\n<\/script>` : '';

  if (htmlCode.includes('<head>') && htmlCode.includes('</head>')) {
    let doc = htmlCode;
    doc = doc.replace('</head>', `${cssLinks}\n${style}\n</head>`);
    doc = doc.replace('</body>', `${consoleCapture}\n${jsScripts}\n${script}\n</body>`);
    return doc;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${cssLinks}${style}</head><body>${htmlCode}${consoleCapture}${jsScripts}${script}</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```

---

*End of report. This document covers all nine research areas with specific package versions, code patterns, and architectural recommendations for the LiveFrame project.*
