# LiveFrame — Synthesis Report

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Date**: 2026-05-29  
> **Sources**: 5 sub-agent research reports (Architecture, Editor/Preview, Filesystem, UI/UX, DevOps)

---

## Executive Summary

LiveFrame is a browser-based code editor for HTML, CSS, and vanilla JavaScript that provides real-time preview in an iframe. It supports two modes: a lightweight **single-file mode** (HTML/CSS/JS tabs like CodePen) and a full **project mode** (multi-file tree like CodeSandbox). The application is built with React 19 + Vite 6 + TypeScript + Tailwind CSS v4, uses CodeMirror 6 for editing, Zustand for state management, shadcn/ui for components, and deploys to GitHub Pages via a two-workflow CI/CD pipeline.

The core value proposition is a **fast, local-first, zero-backend** playground that works entirely in the browser with IndexedDB persistence — no account or server required. It targets both frontend developers prototyping ideas and learners experimenting with web code.

---

## Key Decisions and Justifications

### 1. CodeMirror 6 over Monaco Editor
**Decision**: Use CodeMirror 6 (`@uiw/react-codemirror` wrapper)  
**Justification**: CM6 is modular (~130-250KB vs Monaco's ~4MB), mobile-friendly, native TypeScript, and has excellent React integration. Monaco's IntelliSense is overkill for HTML/CSS/JS editing and its bundle size would harm initial load time. CM6's extension system allows us to add exactly the features we need (Emmet, autocomplete, search) without bloating the bundle.

### 2. srcdoc for Preview over Blob URLs
**Decision**: Use `iframe.srcdoc` for assembling and rendering preview  
**Justification**: srcdoc is simpler (no cleanup), more secure (fully respects `sandbox` attribute), and performs better (direct HTML injection vs. full page load pipeline). The `srcdoc` origin (`about:srcdoc`) is isolated from the parent even with `allow-same-origin`, providing safe execution of user code.

### 3. Full iframe Refresh over Tiered Hot-Patching
**Decision**: Use full iframe refresh on every code change (debounced)  
**Justification**: While tiered hot-patching (CSS hot-patch, JS full refresh) offers better UX, it introduces significant complexity — duplicate event listeners, memory leaks, and inconsistent states. A full refresh is always correct and predictable. With 400ms debouncing, the UX is responsive enough. Hot-patching can be added later as an optimization.

### 4. Zustand with Slice Pattern over Single Store
**Decision**: Split state into 3 stores: `projectStore`, `editorStore`, `uiStore`  
**Justification**: Fine-grained subscriptions prevent unnecessary re-renders. The editor store updates on every keystroke; the project store updates on structural operations (file create/delete); the UI store handles preferences and runtime data (console entries, errors). Cross-store communication uses Zustand's `getState()` API.

### 5. Flat Map over Nested Tree for Virtual File System
**Decision**: Store files as `Record<FileId, FileEntry>` with a path index, derive tree on demand  
**Justification**: Flat maps simplify Zustand/Immer state updates (no deep cloning), provide O(1) file access by ID, and make operations like file movement trivial (just change the `path` string). The tree structure for the file tree UI is derived on demand with O(n log n) sorting — perfectly fine for typical projects with 50-200 files.

### 6. IndexedDB over localStorage for Persistence
**Decision**: Use IndexedDB via `idb` library for project/file storage  
**Justification**: localStorage is limited to 5-10MB and blocks the main thread. IndexedDB supports hundreds of MB, has async API (non-blocking), provides transactional safety, and can store binary data (for future image support). The `idb` library adds only ~1.2KB gzipped.

### 7. react-resizable-panels over allotment
**Decision**: Use `react-resizable-panels` for the layout system  
**Justification**: Built-in `autoSaveId` for persistence, imperative `PanelAPI` for programmatic collapse/expand, smaller bundle (~8KB vs ~18KB), and better conditional panel support (needed for single-file vs project mode switching).

### 8. React Router v7 over TanStack Router
**Decision**: Use React Router v7 for client-side routing  
**Justification**: LiveFrame has only 3-4 routes. TanStack Router's type-safe routing adds complexity that isn't justified for this scope. React Router v7 is the standard for Vite React templates and has better ecosystem support with shadcn/ui.

### 9. Lazy-Loaded CodeMirror
**Decision**: Lazy-load CodeMirror via `React.lazy()` + `Suspense`  
**Justification**: CodeMirror + Lezer parsers weigh ~120-180KB gzipped. By lazy-loading, the initial bundle drops to ~70-80KB gzip — the editor loads after the user navigates to the editor view. The separate `vendor-codemirror` chunk also benefits from long-term caching since it rarely changes.

### 10. Single-File Mode as Virtual Project
**Decision**: Internally represent single-file mode as a project with 3 virtual files  
**Justification**: This unifies the data model — the same store logic, preview assembly, and persistence code serves both modes. The only difference is UI rendering: tabs vs file tree. The `isVirtual` flag enables seamless promotion to project mode without data loss.

---

## Consolidated Recommendations

### Architecture
- **Component hierarchy**: App → Layout → TopBar + Route Outlets; shared `PreviewPanel`, `ConsolePanel`, `EditorPanel` used in both modes
- **Data flow**: Unidirectional — Zustand stores → React components → Side effects (IndexedDB, iframe)
- **Cross-cutting concerns**: Custom hooks (`usePreviewSrcdoc()`, `useConsoleCapture()`, `useAutoRefresh()`) encapsulate complex logic

### Editor & Preview
- **CodeMirror setup**: `@uiw/react-codemirror@4.25` + language packages + Emmet plugin + `@codemirror/search`
- **Theme switching**: CSS variable-aware CodeMirror themes that read from the same `--editor-*` custom properties as Tailwind — no reconfiguration needed on theme toggle
- **Tab preservation**: Save `EditorState` per tab in a `useRef`; restore cursor/scroll on tab switch
- **Console capture**: Override `console.*` in iframe via injected script; forward via `postMessage` with `liveframe:console` protocol
- **Error overlay**: Catch `window.onerror` + `unhandledrejection` in iframe; display in overlay with stack trace
- **Debouncing**: 400ms auto-refresh debounce; manual refresh via Ctrl+Enter

### File System & Projects
- **Data model**: Branded types (`ProjectId`, `FileId`) for type safety; flat map with path index for O(1) lookups
- **Auto-save**: Two-tier debounce — immediate structural saves (file create/delete), debounced content saves (3s default)
- **File tree**: Custom virtualized tree with `@tanstack/react-virtual` + `@dnd-kit` drag-and-drop + Radix context menu
- **ZIP export**: `fflate` library (faster than JSZip, smaller bundle); include manifest for re-import
- **Templates**: 6 built-in templates (Blank, HTML Boilerplate, Tailwind CDN, Bootstrap CDN, Three.js, Multi-file App)
- **Mode switching**: Virtual project promotion/demotion with `isVirtual` flag; animated sidebar transition

### UI/UX & Layout
- **Layout**: Nested `PanelGroup` — vertical (top area + console) containing horizontal (file tree + editor + preview)
- **Default proportions**: Single-file (50/50 editor/preview, 72/28 top/console); Project (18/41/41 tree/editor/preview)
- **Theme**: CSS variable system with oklch colors; `@theme inline` in Tailwind v4; `.dark` class toggle; system preference detection
- **Console panel**: Color-coded entries (log/warn/error/info), collapsible, clear, filter, search, auto-scroll
- **Toolbar**: Mode switcher, auto-refresh toggle, manual refresh, device selector, theme toggle, export button
- **Device frames**: 14 presets (phones, tablets, desktops); zoom-to-fit with ResizeObserver; CSS bezel simulation
- **Mobile**: 3-tier responsive (stacked < 640px, split 640-1023px, full 1024px+); shadcn `Sheet` for mobile panels
- **shadcn/ui**: 22+ components needed (Button, Dialog, Tabs, DropdownMenu, ScrollArea, ContextMenu, Sheet, etc.)

### DevOps & Build
- **Vite config**: Dynamic `base` path via `VITE_BASE_PATH` env var; `@tailwindcss/vite` plugin; CodeMirror separate chunk
- **CI**: `ci.yml` — lint + typecheck + test + build on push/PR to main; concurrency control
- **Deploy**: `deploy.yml` — triggered by CI success via `workflow_run`; dynamic base path per repo name; 404.html SPA trick
- **TypeScript**: Project references (`tsconfig.app.json` + `tsconfig.node.json`); strict mode with `noUncheckedIndexedAccess`
- **Testing**: Vitest + React Testing Library + jsdom; 70% coverage thresholds; Playwright for E2E (post-MVP)
- **Linting**: ESLint 9 flat config with `typescript-eslint/strictTypeChecked`; Prettier with `prettier-plugin-tailwindcss`
- **Bundle**: Initial ~70-80KB gzip; CodeMirror lazy-loaded ~120-180KB gzip additional

---

## Conflicts and Trade-offs

### Conflict 1: Full Refresh vs Hot-Patching
**Positions**: Editor report suggests tiered hot-patching for better UX; user chose full iframe refresh for simplicity.  
**Resolution**: Start with full refresh (user's choice). The architecture supports adding hot-patching later — the `useAutoRefresh` hook can be enhanced to detect change type and apply surgical updates. This is explicitly deferred to post-MVP.

### Conflict 2: Zustand Store Granularity
**Positions**: Architecture report suggests 3 stores; Filesystem report suggests 2 stores with immer middleware; Editor report combines editor state with UI state.  
**Resolution**: Use 3 stores (`projectStore`, `editorStore`, `uiStore`) as the architecture report recommends. The filesystem report's `immer` middleware recommendation is adopted for `projectStore` (complex nested updates) but not for `editorStore` (frequent simple updates where immer overhead isn't justified). Console/error data moves to `uiStore` as runtime state.

### Conflict 3: Persistence Layer
**Positions**: Architecture report uses Zustand `persist` with IndexedDB adapter; Filesystem report uses custom IndexedDB CRUD operations.  
**Resolution**: Use Zustand `persist` middleware with a custom `idb` storage adapter for simple key-value data (workspace settings, preferences). Use direct IndexedDB CRUD (via `idb` library) for project files and large data. This hybrid approach gives us the simplicity of `persist` for settings and the performance of direct IndexedDB for files.

### Trade-off: Security vs Functionality
**Decision**: Use `sandbox="allow-scripts allow-modals allow-forms allow-same-origin"` on the preview iframe.  
**Rationale**: `allow-same-origin` is needed for localStorage/cookies in user code (common in demos), but with `srcdoc` the iframe gets a unique origin that can't access the parent. We explicitly exclude `allow-top-navigation` and `allow-popups` to prevent user code from navigating away.

### Trade-off: Zero-Backend vs Feature Richness
**Decision**: No backend — everything runs client-side with IndexedDB.  
**Consequence**: No user accounts, no real-time collaboration, no server-side processing. Features like sharing are limited to URL encoding and ZIP export. This is acceptable for v1 — the "local-first" approach is a feature, not a limitation, for the target audience.

---

## High-Level Technical Approach

### Phase 0: Runnable Prototype (1-2 weeks)
Scaffold the Vite project, set up basic layout with resizable panels, integrate CodeMirror with HTML/CSS/JS tabs, implement iframe preview with srcdoc assembly, and add Zustand stores. The result is a working CodePen-like single-file editor.

### Phase 1: Core Features (2-3 weeks)
Add project mode with file tree, IndexedDB persistence, console capture, error overlay, dark/light theme, auto-refresh with debouncing, and external resource management.

### Phase 2: Polish & Production (1-2 weeks)
Add responsive device frames, ZIP export/import, starter templates, keyboard shortcuts, accessibility, CI/CD pipelines, and production optimizations (code splitting, lazy loading).

### Phase 3: Enhancement (ongoing)
Add linting, search/replace in editor, collaborative editing (future), PWA support (future), and CSS hot-patching optimization.
