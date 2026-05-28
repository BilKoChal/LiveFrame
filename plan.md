# LiveFrame — Project Plan

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Stack**: React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 + CodeMirror 6 + Zustand  
> **Target**: Both developers and learners | **Deployment**: Cloud Run / GitHub Pages  
> **Date**: 2026-05-29

---

## Project Overview

**LiveFrame** is a browser-based code editor that lets users write HTML, CSS, and vanilla JavaScript and see the results in real-time. It operates in two modes: a lightweight **single-file mode** with HTML/CSS/JS tabs (like CodePen) and a full **project mode** with a multi-file tree (like a mini CodeSandbox). Everything runs client-side with IndexedDB persistence — no backend, no account required.

### Main Features

1. **Real-time code editor** with CodeMirror 6 (syntax highlighting, Emmet, autocomplete)
2. **Live preview** via sandboxed iframe with srcdoc assembly
3. **Single-file mode** — HTML/CSS/JS tabs, like CodePen
4. **Project mode** — Multi-file tree with create/edit/delete/rename, like a mini IDE
5. **Console capture** — Display `console.log/warn/error` from preview in a built-in panel
6. **Error overlay** — Show runtime JavaScript errors on the preview
7. **Dark/Light/System theme** — Full theme toggle for both UI and editor
8. **Resizable split panes** — Drag to resize vertically and horizontally with persistence
9. **Responsive device frames** — Preview in simulated phone/tablet/desktop viewports
10. **Auto-refresh with debounce** — Preview updates as you type (400ms debounce) or manual refresh
11. **External CSS/JS resources** — Add CDN links (Bootstrap, Tailwind, Three.js, etc.)
12. **ZIP export** — Download project files as a ZIP
13. **IndexedDB persistence** — Projects survive page refresh
14. **Starter templates** — Blank, HTML boilerplate, Tailwind CDN, Bootstrap CDN, Three.js, Multi-file
15. **Keyboard shortcuts** — Tab switching, panel toggle, manual refresh
16. **GitHub Pages deployment** — Automated CI/CD with two-workflow pattern

### Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| UI Framework | React | 19.x |
| Build Tool | Vite | 6.x |
| Language | TypeScript | 5.8+ |
| Styling | Tailwind CSS | 4.x |
| Code Editor | CodeMirror 6 | 6.x (via @uiw/react-codemirror 4.25+) |
| State Management | Zustand | 5.x |
| Icons | lucide-react | 0.546.0 |
| Resizable Panels | react-resizable-panels | 3.x |

---

## Phases

### Phase 0 — Rapid Prototype (MVP) [COMPLETED]

**Goal**: A demonstrable, runnable prototype that covers one complete user journey: open the app → write HTML/CSS/JS → see live preview.

**All areas at minimal but functional level:**

#### [x] 0.1 Project Scaffolding
- Initialize Vite + React + TypeScript project
- Install and configure Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- Create `vite.config.ts` with path aliases (`@/`)
- Create `tsconfig.json` with project references
- Create `.gitignore`, `README.md`

#### [x] 0.2 Basic Layout
- Implement `AppLayout.tsx` with toolbar + main area
- Implement `SingleFileLayout.tsx` with `react-resizable-panels` (horizontal split: editor | preview)
- Add vertical split for console panel (below editor + preview)
- Create custom `ResizeHandle.tsx` component
- Set up `layoutStore.ts` (panel visibility, mode)

#### [x] 0.3 CodeMirror Integration
- Install and configure `@uiw/react-codemirror` + language packages
- Create `CodeMirrorEditor.tsx` component
- Implement `SingleFileTabs.tsx` (HTML | CSS | JS tab switching)
- Add basic extensions: syntax highlighting, bracket matching, auto-close tags
- Create `EditorSkeleton.tsx` loading state

#### [x] 0.4 Zustand Stores (Minimal)
- Create `editorStore.ts` with `html`, `css`, `javascript` state + setters
- Create `uiStore.ts` with `theme`, `autoRefresh`, `consoleEntries`, `errorOverlay`
- Wire stores to editor and preview components

#### [x] 0.5 Live Preview
- Create `preview-builder.ts` with `assembleDocument()` function
- Create `PreviewFrame.tsx` with iframe + srcdoc
- Implement `useAutoRefresh.ts` hook with 400ms debounce
- Add manual refresh button in toolbar

#### [x] 0.6 Dark/Light Theme
- Create `index.css` with CSS variables for both themes (`:root` + `.dark`)
- Implement `useTheme.ts` hook with system preference detection
- Create `ThemeToggle.tsx` dropdown (light/dark/system)
- Configure CodeMirror themes to read from CSS variables

#### [x] 0.7 Basic Toolbar
- Implement `Toolbar.tsx` with: logo, auto-refresh toggle, manual refresh, theme toggle
- Create `RefreshControls.tsx` component

**Phase 0 Deliverable**: A working CodePen-like single-file editor with live preview, dark/light theme, and resizable panels. Users can type HTML/CSS/JS and see results in real-time.
