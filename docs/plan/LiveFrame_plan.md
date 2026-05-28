# LiveFrame — Project Plan

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Stack**: React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 + CodeMirror 6 + Zustand + shadcn/ui  
> **Target**: Both developers and learners | **Deployment**: GitHub Pages  
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
| UI Components | shadcn/ui | latest |
| Icons | lucide-react | 0.470+ |
| Persistence | IndexedDB (via `idb`) | 8.x |
| ZIP Export | fflate | latest |
| Routing | React Router | 7.x |
| Resizable Panels | react-resizable-panels | 3.x |
| Drag & Drop | @dnd-kit | latest |
| Testing | Vitest + React Testing Library | 3.x / 16.x |
| Linting | ESLint 9 + typescript-eslint | 9.x / 8.x |
| Formatting | Prettier + prettier-plugin-tailwindcss | 3.x / 0.6+ |
| CI/CD | GitHub Actions | N/A |
| Deployment | GitHub Pages | N/A |

---

## Project Structure

See [`structure.md`](./structure.md) for the complete directory tree and file responsibilities.

---

## Phases

### Phase 0 — Rapid Prototype (MVP)

**Goal**: A demonstrable, runnable prototype that covers one complete user journey: open the app → write HTML/CSS/JS → see live preview.

**All areas at minimal but functional level:**

#### 0.1 Project Scaffolding
- Initialize Vite + React + TypeScript project
- Install and configure Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- Set up shadcn/ui (`npx shadcn@latest init`)
- Create `vite.config.ts` with path aliases (`@/`)
- Create `tsconfig.json` with project references
- Create `.env.development` and `.env.production` with `VITE_BASE_PATH`
- Create `.gitignore`, `README.md`

#### 0.2 Basic Layout
- Implement `AppLayout.tsx` with toolbar + main area
- Implement `SingleFileLayout.tsx` with `react-resizable-panels` (horizontal split: editor | preview)
- Add vertical split for console panel (below editor + preview)
- Create custom `ResizeHandle.tsx` component
- Set up `layoutStore.ts` (panel visibility, mode)

#### 0.3 CodeMirror Integration
- Install and configure `@uiw/react-codemirror` + language packages
- Create `CodeMirrorEditor.tsx` as a lazy-loaded component
- Implement `SingleFileTabs.tsx` (HTML | CSS | JS tab switching)
- Add basic extensions: syntax highlighting, bracket matching, auto-close tags
- Add Emmet plugin (`@emmetio/codemirror-plugin`)
- Create `EditorSkeleton.tsx` loading state

#### 0.4 Zustand Stores (Minimal)
- Create `editorStore.ts` with `html`, `css`, `javascript` state + setters
- Create `uiStore.ts` with `theme`, `autoRefresh`, `consoleEntries`, `errorOverlay`
- Wire stores to editor and preview components

#### 0.5 Live Preview
- Create `preview-builder.ts` with `assembleDocument()` function
- Create `PreviewFrame.tsx` with iframe + srcdoc
- Implement `useAutoRefresh.ts` hook with 400ms debounce
- Add manual refresh button in toolbar

#### 0.6 Dark/Light Theme
- Create `index.css` with CSS variables for both themes (`:root` + `.dark`)
- Implement `useTheme.ts` hook with system preference detection
- Create `ThemeToggle.tsx` dropdown (light/dark/system)
- Configure CodeMirror themes to read from CSS variables

#### 0.7 Basic Toolbar
- Implement `Toolbar.tsx` with: logo, auto-refresh toggle, manual refresh, theme toggle
- Create `RefreshControls.tsx` component

**Phase 0 Deliverable**: A working CodePen-like single-file editor with live preview, dark/light theme, and resizable panels. Users can type HTML/CSS/JS and see results in real-time.

---

### Phase 1 — Core Features

**Goal**: Add project mode, persistence, console capture, error overlay, and external resources — making LiveFrame a complete editor.

#### 1.1 Project Mode — Data Model & Stores
- Create `projectStore.ts` with full project/file CRUD actions
- Create `editorStore.ts` (enhanced) with per-file content, dirty state, cursor positions
- Implement `vfs.ts` (VirtualFileSystem class with flat Map + path index)
- Create type definitions (`ProjectId`, `FileId`, `FileEntry`, `Project`, etc.)
- Implement single-file mode as virtual project (3 files with `isVirtual: true`)

#### 1.2 Project Mode — File Tree UI
- Create `FileTree.tsx` with virtualized rendering (`@tanstack/react-virtual`)
- Create `FileTreeNode.tsx` with expand/collapse, file icons, dirty indicators
- Create `FileTreeContextMenu.tsx` (new file, new folder, rename, delete)
- Implement `ProjectLayout.tsx` with file tree panel + editor + preview

#### 1.3 Project Mode — File Tabs
- Create `ProjectFileTabs.tsx` with sortable tabs (`@dnd-kit/sortable`)
- Create `SortableTab.tsx` with drag handle, close button, dirty indicator
- Implement tab state management (open, close, reorder, activate)

#### 1.4 IndexedDB Persistence
- Create `idb.ts` with database schema, initialization, CRUD operations
- Implement auto-save with two-tier debounce (structural: immediate, content: 3s)
- Implement project loading on startup
- Implement project list page (`ProjectList.tsx`)

#### 1.5 Console Capture
- Create `console-capture-script.ts` (injected into iframe)
- Implement `useConsoleCapture.ts` hook (listens for `liveframe:console` postMessage)
- Create `ConsolePanel.tsx` with color-coded entries, clear button
- Create `ConsoleEntry.tsx` with formatted output (objects, arrays, errors)
- Create `ConsoleToolbar.tsx` with filter, search, timestamp toggle

#### 1.6 Error Overlay
- Implement `useErrorCapture.ts` hook (listens for `liveframe:error` postMessage)
- Create `ErrorOverlay.tsx` with error message, stack trace, dismiss button
- Add error count badge on preview panel

#### 1.7 Mode Switching
- Implement seamless switching between single-file and project mode
- Add `ModeSwitcher.tsx` to toolbar
- Handle panel resizing on mode switch (imperative `PanelAPI.resize()`)
- Preserve work when switching modes (virtual project promotion/demotion)

#### 1.8 External Resources
- Create `ExternalResourcePanel.tsx` (add/remove/reorder CDN URLs)
- Add common library presets (Tailwind CDN, Bootstrap, Three.js, jQuery, etc.)
- Inject external CSS/JS into preview srcdoc assembly

#### 1.9 Routing
- Set up React Router with routes: `/` (single-file), `/project` (list), `/project/:id` (editor)
- Configure `BrowserRouter` with dynamic `basename` from `import.meta.env.BASE_URL`
- Add route-based state derivation (mode from URL)

**Phase 1 Deliverable**: A fully functional editor with both single-file and project modes, persistence across refresh, console output, error display, external resources, and mode switching.

---

### Phase 2 — Polish & Production

**Goal**: Add responsive device frames, ZIP export, templates, keyboard shortcuts, accessibility, and production-ready CI/CD.

#### 2.1 Responsive Device Frames
- Create `DeviceFrame.tsx` with CSS bezel simulation
- Create `DevicePresets.ts` with 14 device dimension presets
- Add `DeviceSelector.tsx` dropdown to toolbar
- Implement zoom-to-fit with `ResizeObserver`
- Add custom device size dialog

#### 2.2 ZIP Export & Import
- Create `zip-export.ts` using `fflate`
- Add `ExportButton.tsx` to toolbar
- Implement ZIP import (drag & drop or file picker)
- Include manifest file in exported ZIP for re-import

#### 2.3 Starter Templates
- Create `templates.ts` with 6 built-in templates
- Create `TemplateGallery.tsx` dialog with preview cards
- Implement template initialization (populate VFS from template)

#### 2.4 Keyboard Shortcuts
- Create `useKeyboardShortcuts.ts` hook
- Implement shortcuts: Ctrl+1/2/3 (tab switch), Ctrl+J (console toggle), Ctrl+B (file tree toggle), Ctrl+Enter (manual refresh), Ctrl+S (save)
- Add keyboard shortcut reference dialog

#### 2.5 Accessibility
- Add ARIA labels to all panels and interactive elements
- Implement focus management (focus trap in modals, skip navigation)
- Add screen reader announcements for preview updates
- Support `prefers-reduced-motion` and `prefers-contrast`
- Ensure keyboard navigation for file tree and tabs

#### 2.6 CI/CD Pipeline
- Create `.github/workflows/ci.yml` (lint, typecheck, test, build)
- Create `.github/workflows/deploy.yml` (build + deploy on CI success)
- Add `404.html` SPA routing trick to deploy workflow
- Configure dynamic base path per repo name
- Add concurrency control to workflows

#### 2.7 Production Optimizations
- Verify code splitting: `vendor-react`, `vendor-codemirror`, `vendor`, app chunks
- Verify lazy loading of CodeMirror editor
- Configure `optimizeDeps` for faster dev startup
- Set up coverage thresholds (70%) in Vitest
- Add `simple-git-hooks` + `lint-staged` pre-commit hooks

#### 2.8 Testing
- Write unit tests for Zustand stores, preview builder, VFS, file utils
- Write component tests for editor tabs, console panel, file tree, theme toggle
- Write integration tests for editor→preview sync, tab switching, mode switching
- Add Playwright E2E setup (post-MVP, minimum viable tests)

#### 2.9 Mobile Responsiveness
- Implement 3-tier responsive layout (stacked < 640px, split 640-1023px, full 1024px+)
- Use shadcn `Sheet` for mobile file tree and console panels
- Add touch-friendly resize handles
- Test on various viewport sizes

**Phase 2 Deliverable**: A polished, production-ready editor deployed to GitHub Pages with device frames, export, templates, keyboard shortcuts, accessibility, CI/CD, and testing.

---

### Phase 3 — Enhancement (Post-Launch)

**Goal**: Iterative improvements based on user feedback.

- CodeMirror linting (HTMLHint, Stylelint, ESLint via Web Workers)
- Search & replace in editor (`@codemirror/search`)
- CSS hot-patching optimization (surgical updates instead of full refresh)
- Collaborative editing (WebSocket-based, requires backend)
- PWA support (service worker, offline mode)
- GitHub Gist import/export
- Code formatting (Prettier integration)
- Snippet library (user-defined code snippets)
- Multi-cursor editing improvements
- Browser extension (edit code from any webpage)

---

## Dependencies and Critical Path

```
Phase 0 ──────────────────────────────────────────────────►
  │  (Scaffolding → Layout → Editor → Preview → Theme)
  │
  ▼
Phase 1 ──────────────────────────────────────────────────►
  │  (Project Store → File Tree → Tabs → IndexedDB →
  │   Console → Errors → Mode Switch → Resources → Routing)
  │
  ▼
Phase 2 ──────────────────────────────────────────────────►
  │  (Device Frames → ZIP → Templates → Shortcuts →
  │   A11y → CI/CD → Optimization → Testing → Mobile)
  │
  ▼
Phase 3 (ongoing, no strict dependencies)
```

**Critical Path**: Phase 0 → Phase 1 → Phase 2

- Phase 0 must be complete before Phase 1 (project mode builds on top of single-file editor)
- Phase 1 must be complete before Phase 2 (polish requires all core features)
- Phase 3 is independent and iterative

**Blocking dependencies within phases:**
- Phase 0: Layout (0.2) → Editor (0.3) → Preview (0.5) — sequential
- Phase 1: Stores (1.1) → File Tree (1.2) → Tabs (1.3) — sequential; Console (1.5) and Errors (1.6) can be parallel after Stores
- Phase 2: Most sub-phases are independent and can be parallelized

---

## Milestones

| Milestone | Phase | Description |
|-----------|-------|-------------|
| **M1: First Preview** | Phase 0.5 | Code typed in editor appears in live preview iframe |
| **M2: Theme Working** | Phase 0.7 | Dark/light theme toggle works for both UI and CodeMirror |
| **M3: Project Mode** | Phase 1.3 | Can create a project, add files, edit them, see preview |
| **M4: Persistent** | Phase 1.4 | Projects survive page refresh via IndexedDB |
| **M5: Console & Errors** | Phase 1.6 | Console output and runtime errors display in the UI |
| **M6: Production** | Phase 2.7 | App deployed to GitHub Pages with CI/CD pipeline |

---

## Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | **Iframe performance** — Full srcdoc rebuilds on every keystroke may lag with large documents | Medium | Medium | 400ms debounce already mitigates; consider CSS hot-patching in Phase 3; profile with large files early |
| 2 | **CodeMirror extension complexity** — CM6's extension system has a steep learning curve; misconfigured extensions can conflict | Medium | Medium | Start with minimal extensions in Phase 0; add extensions one at a time; use compartments for dynamic extensions |
| 3 | **IndexedDB reliability** — Browser storage can be cleared, corrupted, or blocked (private browsing) | Low | High | Graceful degradation: detect IDB availability, fall back to localStorage for settings; show warning in private browsing |
| 4 | **Iframe security** — User code could attempt to escape sandbox or access parent | Low | High | Strict sandbox attributes; no `allow-top-navigation` or `allow-popups`; srcdoc provides unique origin; CSP headers |
| 5 | **Bundle size** — CodeMirror + React + Zustand + shadcn could result in large initial load | Medium | Medium | Lazy-load CodeMirror; separate vendor-codemirror chunk; tree-shake unused shadcn components; monitor bundle size in CI |
| 6 | **Tailwind v4 + shadcn/ui compatibility** — Tailwind v4 changed config format; some shadcn components may not be updated | Medium | Low | Use latest shadcn CLI with v4 support; test all components early; pin dependency versions |

---

## Next Steps

1. **Extract this planning package** into the project repository's `docs/plan/` directory
2. **Initialize the project** using the Development Agent with the scaffold structure from `structure.md`
3. **Start Phase 0** — Focus on getting a working single-file editor with live preview
4. **Set up CI early** — Even a basic CI workflow in Phase 0 catches issues early
5. **Test on GitHub Pages** — Deploy a skeleton early to validate the base path and SPA routing

---

## Appendix: Complete Package Dependency List

### Runtime Dependencies
```
react@^19.1.0
react-dom@^19.1.0
react-router-dom@^7.15.0
zustand@^5.0.0
idb@^8.0.0
@uiw/react-codemirror@^4.25.0
@codemirror/lang-html@^6.4.0
@codemirror/lang-css@^6.3.0
@codemirror/lang-javascript@^6.2.0
@codemirror/theme-one-dark@^6.1.0
@codemirror/autocomplete@^6.20.0
@codemirror/lint@^6.9.0
@codemirror/search@^6.7.0
@emmetio/codemirror-plugin@^1.2.0
fflate@^0.8.0
lucide-react@^0.470.0
clsx@^2.1.0
tailwind-merge@^3.0.0
class-variance-authority@^0.7.0
react-resizable-panels@^3.0.0
@dnd-kit/core@^6.0.0
@dnd-kit/sortable@^9.0.0
@dnd-kit/utilities@^3.0.0
@radix-ui/react-dialog@latest
@radix-ui/react-dropdown-menu@latest
@radix-ui/react-tabs@latest
@radix-ui/react-tooltip@latest
@radix-ui/react-select@latest
@radix-ui/react-switch@latest
@radix-ui/react-scroll-area@latest
@radix-ui/react-separator@latest
@radix-ui/react-context-menu@latest
@radix-ui/react-collapsible@latest
@radix-ui/react-alert-dialog@latest
@radix-ui/react-slot@latest
```

### Dev Dependencies
```
vite@^6.3.0
@vitejs/plugin-react@^4.4.0
@tailwindcss/vite@^4.3.0
tailwindcss@^4.3.0
typescript@^5.8.0
@types/react@^19.1.0
@types/react-dom@^19.1.0
vitest@^3.2.0
@testing-library/react@^16.3.0
@testing-library/jest-dom@^6.6.0
@testing-library/user-event@^14.6.0
jsdom@^26.0.0
@vitest/coverage-v8@^3.2.0
eslint@^9.28.0
typescript-eslint@^8.33.0
prettier@^3.5.0
prettier-plugin-tailwindcss@^0.6.0
simple-git-hooks@^2.12.0
lint-staged@^15.5.0
```
