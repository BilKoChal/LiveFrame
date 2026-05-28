# LiveFrame — Project Plan

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Stack**: React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4 + CodeMirror 6 + Zustand + shadcn/ui  
> **Target**: Both developers and learners | **Deployment**: GitHub Pages  
> **Date**: 2026-05-29  
> **Last Updated**: 2026-05-29

---

## Current Progress

| Phase | Status | Completion |
|-------|--------|-----------|
| Phase 0 — Rapid Prototype | **Complete** ✅ | 100% |
| Phase 1 — Core Features | **In Progress** 🔧 | ~60% |
| Phase 2 — Polish & Production | Partially Started | ~15% |
| Phase 3 — Enhancement | Not Started | 0% |

### Completed Milestones
- ✅ **M1: First Preview** — Code typed in editor appears in live preview iframe
- ✅ **M2: Theme Working** — Dark/light/system theme toggle works for both UI and CodeMirror
- ✅ **M5: Console & Errors** — Console capture and error overlay working (pulled into Phase 0 early)
- 🔧 M3: Project Mode — Partially implemented (1.1–1.4 done, 1.7–1.9 remaining)
- ⬜ M4: Persistent — Not yet implemented
- ⬜ M6: Production — Not yet deployed

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

#### 0.1 Project Scaffolding ✅
- [x] Initialize Vite + React + TypeScript project
- [x] Install and configure Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- [x] Set up shadcn/ui — **Deferred: shadcn/ui not required for MVP; custom Tailwind components used instead**
- [x] Create `vite.config.ts` with path aliases (`@/`)
- [x] Create `tsconfig.json` with project references
- [x] Create `.env.development` and `.env.production` with `VITE_BASE_PATH`
- [x] Create `.gitignore`, `README.md`

#### 0.2 Basic Layout ✅
- [x] Implement resizable panel layout with `react-resizable-panels` (horizontal: editor | preview; vertical: top | console)
- [x] Create custom `ResizeHandle.tsx` component (in `components/layout/`)
- [x] Implement `AppLayout.tsx` as a separate component (in `components/layout/`)
- [x] Implement `SingleFileLayout.tsx` — **Placeholder created; full implementation deferred to Phase 1 with project mode**
- [x] Set up `layoutStore.ts` (panel visibility, mode) — **Created with isConsoleOpen, mode, isFileTreeOpen**

#### 0.3 CodeMirror Integration ✅
- [x] Install and configure `@uiw/react-codemirror` + language packages (HTML, CSS, JS)
- [x] Implement `SingleFileTabs.tsx` (HTML | CSS | JS tab switching) (in `components/editor/`)
- [x] Add basic extensions: syntax highlighting, bracket matching, auto-close tags, autocompletion
- [x] Create `CodeMirrorEditor.tsx` as a lazy-loaded component — **Lazy-loaded via React.lazy() + Suspense with EditorSkeleton fallback**
- [x] Add Emmet plugin — **Installed `@emmetio/codemirror6-plugin`; abbreviationTracker enabled for HTML and CSS modes**
- [x] Create `EditorSkeleton.tsx` loading state — **Created with shimmer animation**

#### 0.4 Zustand Stores (Minimal) ✅
- [x] Create `editorStore.ts` with `html`, `css`, `javascript` state + setters
- [x] Create `uiStore.ts` with `theme`, `autoRefresh`, `consoleEntries`, `errorOverlay`
- [x] Wire stores to editor and preview components

#### 0.5 Live Preview ✅
- [x] Create `preview-builder.ts` with `assembleDocument()` function (located at `src/utils/previewBuilder.ts`)
- [x] Create `PreviewFrame.tsx` with iframe + srcdoc
- [x] Implement `useAutoRefresh.ts` hook with 400ms debounce
- [x] Add manual refresh button in toolbar

#### 0.6 Dark/Light Theme ✅
- [x] Create `index.css` with theme support (Tailwind v4 `@theme inline`, dark class toggle)
- [x] Implement `useTheme.ts` hook with system preference detection
- [x] Create `ThemeToggle.tsx` (light/dark/system toggle)
- [x] Configure CodeMirror themes to respond to dark/light mode

#### 0.7 Basic Toolbar ✅
- [x] Implement `Toolbar.tsx` with: logo, auto-refresh toggle, manual refresh, theme toggle, reset button (in `components/toolbar/`)
- [x] Create `RefreshControls.tsx` as a separate component — **Extracted from Toolbar into `components/toolbar/RefreshControls.tsx`**

**Phase 0 Deliverable**: A working CodePen-like single-file editor with live preview, dark/light theme, and resizable panels. Users can type HTML/CSS/JS and see results in real-time. **STATUS: ✅ COMPLETE — All Phase 0 items implemented.**

---

### Phase 1 — Core Features ⬜

**Goal**: Add project mode, persistence, console capture, error overlay, and external resources — making LiveFrame a complete editor.

> **Note**: Console capture (1.5) and error overlay (1.6) were implemented early as part of Phase 0 and are already functional in the codebase. They are kept here for tracking but are marked as done.

#### 1.1 Project Mode — Data Model & Stores ✅
- [x] Create `projectStore.ts` with full project/file CRUD actions — **Created at `src/stores/projectStore.ts`**
- [x] Create `editorStore.ts` (enhanced) with per-file content, dirty state, tab management — **Enhanced at `src/stores/editorStore.ts`**
- [x] Implement `vfs.ts` (VirtualFileSystem class with flat Map + path index) — **Created at `src/utils/vfs.ts`**
- [x] Create type definitions (`ProjectId`, `FileId`, `FileEntry`, `Project`, etc.) — **Created at `src/types/project.ts`**
- [x] Implement single-file mode as virtual project (3 files with `isVirtual: true`) — **Uses stable IDs: `proj_virtual_default`, `file_virtual_html/css/js`**

#### 1.2 Project Mode — File Tree UI ✅
- [x] Create `FileTree.tsx` with virtualized rendering (`@tanstack/react-virtual`) — **Created at `src/components/project/FileTree.tsx`**
- [x] Expand/collapse, file icons (lucide-react), dirty indicators — **Integrated inline (no separate FileTreeNode)**
- [x] Context menu (new file, new folder, rename, delete) — **Integrated inline (no separate FileTreeContextMenu)**
- [x] Implement `ProjectLayout.tsx` with file tree panel + editor + preview — **Created at `src/components/project/ProjectLayout.tsx`**

#### 1.3 Project Mode — File Tabs ✅
- [x] Create `ProjectFileTabs.tsx` with sortable tabs (`@dnd-kit/sortable`) — **Created at `src/components/project/ProjectFileTabs.tsx`**
- [x] SortableTab with drag handle, close button, dirty indicator — **Integrated inline (SortableTab sub-component)**
- [x] Implement tab state management (open, close, reorder, activate) — **In `editorStore.ts`**

#### 1.4 IndexedDB Persistence ✅
- [x] Create `idb.ts` with database schema, initialization, CRUD operations — **Created at `src/utils/idb.ts`**
- [x] Implement auto-save with two-tier debounce (structural: immediate, content: 3s) — **Implemented with `scheduleContentSave` and `saveStructuralChange`**
- [x] Implement project loading on startup — **Hydration in `App.tsx` via `hydrateFromIDB`**
- [x] Implement project list page (`ProjectList.tsx`) — **Created at `src/components/project/ProjectList.tsx`**

#### 1.5 Console Capture ✅ (Implemented early in Phase 0)
- [x] Create console capture script (injected into iframe) — **Located in `src/utils/previewBuilder.ts` as `CONSOLE_HOOK`**
- [x] Implement `postMessage` listener for `liveframe:console` — **Located in `PreviewFrame.tsx`**
- [x] Create `ConsolePanel.tsx` with color-coded entries, clear button, search filter
- [ ] Create `ConsoleEntry.tsx` as a separate component — **Inline in ConsolePanel**
- [ ] Create `ConsoleToolbar.tsx` as a separate component — **Inline in ConsolePanel**

#### 1.6 Error Overlay ✅ (Implemented early in Phase 0)
- [x] Implement error capture via `postMessage` — **Located in `PreviewFrame.tsx`**
- [x] Create error overlay with error message, dismiss button — **Inline in `PreviewFrame.tsx`**
- [ ] Add error count badge on preview panel — **Not done**

#### 1.7 Mode Switching ✅ (Implemented as part of 1.1–1.4)
- [x] Implement seamless switching between single-file and project mode — **In `Toolbar.tsx` mode switcher button**
- [x] Add `ModeSwitcher.tsx` to toolbar — **Integrated into `Toolbar.tsx`**
- [ ] Handle panel resizing on mode switch (imperative `PanelAPI.resize()`) — **Not yet done**
- [x] Preserve work when switching modes (virtual project promotion/demotion) — **`switchToProjectMode`/`switchToSingleFileMode` in projectStore**

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

### Phase 2 — Polish & Production 🔧

**Goal**: Add responsive device frames, ZIP export, templates, keyboard shortcuts, accessibility, and production-ready CI/CD.

#### 2.1 Responsive Device Frames ~30%
- [x] Basic device mode switching (fluid/tablet/phone) — **Inline in `PreviewFrame.tsx`**
- [ ] Create `DeviceFrame.tsx` with CSS bezel simulation — **Not a separate component**
- [ ] Create `DevicePresets.ts` with 14 device dimension presets — **Only 3 presets exist**
- [ ] Add `DeviceSelector.tsx` dropdown to toolbar — **Device buttons are inline in PreviewFrame**
- [ ] Implement zoom-to-fit with `ResizeObserver`
- [ ] Add custom device size dialog

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

#### 2.6 CI/CD Pipeline 🔧 (Deploy workflow being added now)
- [ ] Create `.github/workflows/ci.yml` (lint, typecheck, test, build) — **Not yet done**
- [x] Create `.github/workflows/deploy.yml` (build + deploy on push to main) — **Being added now**
- [x] Add `404.html` SPA routing trick — **Being added now**
- [x] Configure dynamic base path per repo name — **Being added via `VITE_BASE_PATH` env var**
- [x] Add concurrency control to workflows — **Being added now**

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

1. ~~**Extract this planning package** into the project repository's `docs/plan/` directory~~ ✅ Done
2. ~~**Initialize the project** using the Development Agent with the scaffold structure from `structure.md`~~ ✅ Done
3. ~~**Complete Phase 0** — All items implemented ✅~~
4. **Start Phase 1** — Project mode (data model, file tree, tabs, IndexedDB persistence, mode switching, routing)
5. **Deploy to GitHub Pages** — Deploy workflow configured; push to `main` to trigger auto-deploy

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
