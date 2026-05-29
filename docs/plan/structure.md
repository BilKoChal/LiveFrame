# LiveFrame — Project Structure

> This file documents the **current** project structure as of 2026-05-29.
> For the target structure, see the original plan in `LiveFrame_plan.md`.

---

## Current Directory Tree

```
liveframe/
├── .github/
│   └── workflows/
│       └── deploy.yml                       # GitHub Pages auto-deploy on push to main
│
├── docs/
│   ├── prompt.md                            # Development Agent behavior prompt
│   └── plan/
│       ├── LiveFrame_plan.md                # Main project plan (with progress markers)
│       ├── synthesis.md                     # Synthesis report from research
│       ├── structure.md                     # This file — current project structure
│       ├── tasks/
│       │   ├── 1 - plan-update-and-ghpages-deploy.md
│       │   ├── 2 - complete-phase-0.md
│       │   └── 3 - phase1-project-mode.md
│       ├── worklogs/
│       │   ├── 1 - worklog.md
│       │   ├── 2 - worklog.md
│       │   └── 3 - worklog.md
│       └── research/
│           ├── LiveFrame_general_architect_report.md
│           ├── LiveFrame_editor_preview_report.md
│           ├── LiveFrame_filesystem_project_report.md
│           ├── LiveFrame_uiux_layout_report.md
│           ├── LiveFrame_devops_build_report.md
│           ├── phase1-idb-persistence-research.md
│           ├── phase1-filetree-tabs-research.md
│           └── phase1-data-model-research.md
│
├── public/
│   └── 404.html                             # SPA redirect for GitHub Pages
│
├── src/
│   ├── main.tsx                             # Entry point — renders App
│   ├── App.tsx                              # Root component — theme hook + IDB hydration + AppLayout
│   ├── index.css                            # Global styles + Tailwind v4 + theme vars + fonts
│   ├── vite-env.d.ts                        # Vite type declarations
│   │
│   ├── types/
│   │   ├── index.ts                         # Shared types (Theme, ActiveTab, ConsoleEntry) + re-exports
│   │   └── project.ts                       # Project mode types (ProjectId, FileId, FileEntry, Project, etc.)
│   │
│   ├── constants/
│   │   └── defaultContent.ts                # Single source of truth for DEFAULT_HTML/CSS/JS boilerplate
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx                # Root layout — mode switching between single-file and project
│   │   │   ├── SingleFileLayout.tsx         # Single-file mode layout (placeholder)
│   │   │   └── ResizeHandle.tsx             # Custom drag handle for panel resizing
│   │   │
│   │   ├── editor/
│   │   │   ├── CodeMirrorEditor.tsx         # Lazy-loaded CM6 editor (dual mode: single-file + project)
│   │   │   ├── SingleFileTabs.tsx           # HTML|CSS|JS tab bar
│   │   │   └── EditorSkeleton.tsx           # Loading skeleton for lazy-loaded CodeMirror
│   │   │
│   │   ├── preview/
│   │   │   └── PreviewFrame.tsx             # Preview iframe + device mode + error overlay
│   │   │
│   │   ├── console/
│   │   │   └── ConsolePanel.tsx             # Console output panel (entries, search, clear)
│   │   │
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx                  # Top toolbar (logo, mode switcher, file tree toggle, theme)
│   │   │   ├── RefreshControls.tsx          # Auto-run toggle + manual run button
│   │   │   └── ThemeToggle.tsx              # Dark/Light/System toggle
│   │   │
│   │   └── project/                         # NEW — Project mode components
│   │       ├── FileTree.tsx                 # Virtualized file tree with context menu + inline rename
│   │       ├── ProjectFileTabs.tsx          # Sortable file tabs with drag-and-drop
│   │       ├── ProjectLayout.tsx            # Project mode layout (file tree + editor + preview)
│   │       ├── ProjectList.tsx              # Project list page with create/delete/duplicate
│   │       └── ExternalResourcePanel.tsx    # External CDN resource manager
│   │
│   ├── stores/
│   │   ├── editorStore.ts                   # Editor content + per-file content + tab management
│   │   ├── uiStore.ts                       # UI state (theme, autoRefresh, console, errors)
│   │   ├── layoutStore.ts                   # Layout state (isConsoleOpen, mode, isFileTreeOpen)
│   │   └── projectStore.ts                  # NEW — Project/file CRUD, virtual project, workspace
│   │
│   ├── hooks/
│   │   ├── useTheme.ts                      # Theme detection + application
│   │   └── useAutoRefresh.ts               # Debounced auto-refresh + manual trigger (dual mode)
│   │
│   └── utils/
│       ├── previewBuilder.ts               # assembleDocument() + CONSOLE_HOOK (exported)
│       ├── projectPreviewBuilder.ts         # NEW — Multi-file project preview assembler
│       ├── vfs.ts                           # NEW — VirtualFileSystem class (tree building, path utils)
│       └── idb.ts                           # NEW — IndexedDB persistence layer (CRUD, auto-save, hydration)
│
├── .env.development                         # VITE_BASE_PATH=/
├── .env.production                          # VITE_BASE_PATH=/LiveFrame/
├── .env.example                             # Documentation for env vars
├── .gitignore                               # Ignores node_modules, dist, .env*, etc.
├── index.html                               # HTML entry point with SPA routing script
├── package.json                             # Scripts + dependencies
├── package-lock.json                        # Locked dependency versions
├── tsconfig.json                            # TypeScript configuration
├── vite.config.ts                           # Vite + Tailwind v4 + dynamic base path
└── README.md                                # Project documentation
```

---

## Key File Responsibilities

| File | Primary Responsibility |
|------|----------------------|
| `src/main.tsx` | Mount React app, import global CSS |
| `src/App.tsx` | Root component — initializes theme, IDB hydration, auto-save setup, renders AppLayout |
| `src/index.css` | Tailwind v4 `@import`, `@theme`, custom fonts (Inter, JetBrains Mono), animations |
| `src/types/project.ts` | Project mode type definitions (ProjectId, FileId, FileEntry, Project, etc.) + branded ID factories |
| `src/types/index.ts` | Shared types + re-exports of project types |
| `src/constants/defaultContent.ts` | Single source of truth for DEFAULT_HTML, DEFAULT_CSS, DEFAULT_JS boilerplate |
| `src/stores/projectStore.ts` | Project/file CRUD, virtual project, workspace, mode switching |
| `src/stores/editorStore.ts` | Editor content (legacy + per-file), dirty map, tab management |
| `src/stores/uiStore.ts` | Theme, autoRefresh, consoleEntries, errorOverlay |
| `src/stores/layoutStore.ts` | Panel visibility (isConsoleOpen), mode (single-file/project), file tree visibility |
| `src/utils/vfs.ts` | VirtualFileSystem — tree building, path utilities, file type detection |
| `src/utils/idb.ts` | IndexedDB — database schema, CRUD, auto-save scheduler, hydration |
| `src/utils/previewBuilder.ts` | `assembleDocument()` + `CONSOLE_HOOK` + `buildExternalResourceTags()` (shared helper) |
| `src/utils/projectPreviewBuilder.ts` | `assembleProjectDocument()` — multi-file project preview assembly |
| `src/hooks/useAutoRefresh.ts` | 400ms debounced auto-refresh; dual mode (single-file + project) |
| `src/hooks/useTheme.ts` | Applies dark/light class to `<html>`, listens for system preference changes |
| `src/components/layout/AppLayout.tsx` | Root layout — mode switching between single-file and project layouts |
| `src/components/project/FileTree.tsx` | Virtualized file tree with @tanstack/react-virtual, context menu, inline rename |
| `src/components/project/ProjectFileTabs.tsx` | Sortable file tabs with @dnd-kit/sortable, drag reordering, close/dirty indicators |
| `src/components/project/ProjectLayout.tsx` | Project mode layout — file tree + editor tabs + preview + console |
| `src/components/project/ProjectList.tsx` | Project list page — create, delete, duplicate, open projects |
| `src/components/editor/CodeMirrorEditor.tsx` | Lazy-loaded CodeMirror 6 — dual mode (single-file + project) |
| `src/components/editor/EditorSkeleton.tsx` | Shimmer loading skeleton shown while CodeMirror loads |
| `src/components/editor/SingleFileTabs.tsx` | HTML/CSS/JS tab switching with icons |
| `src/components/preview/PreviewFrame.tsx` | Iframe preview + device mode switching + error overlay + postMessage listener |
| `src/components/console/ConsolePanel.tsx` | Console output with color-coded entries, search, clear |
| `src/components/toolbar/Toolbar.tsx` | Top bar with logo, mode switcher, file tree toggle, RefreshControls, reset, ThemeToggle |
| `src/components/toolbar/RefreshControls.tsx` | Auto-run toggle + manual run button |
| `src/components/toolbar/ThemeToggle.tsx` | Light/Dark/System selector |
| `src/components/layout/ResizeHandle.tsx` | Custom resize handle with visual feedback |
| `.github/workflows/deploy.yml` | Auto-deploy to GitHub Pages on push to main |
| `public/404.html` | SPA redirect trick for GitHub Pages |
| `vite.config.ts` | Vite config with dynamic `base` path from `VITE_BASE_PATH` env var |

---

## New Dependencies (Phase 1)

| Package | Version | Purpose |
|---------|---------|---------|
| `idb` | ^8.0.0 | IndexedDB wrapper (typed, promise-based) |
| `@dnd-kit/core` | ^6.0.0 | Drag-and-drop core |
| `@dnd-kit/sortable` | ^9.0.0 | Sortable items (file tabs) |
| `@dnd-kit/utilities` | ^3.0.0 | DnD utility functions |
| `@tanstack/react-virtual` | ^3.0.0 | Virtualized file tree rendering |
| `nanoid` | ^5.0.0 | ID generation (not yet used; crypto.randomUUID preferred) |
| `@codemirror/lang-json` | ^6.0.0 | JSON language support for CodeMirror |

---

## Build Output

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| `index.js` | ~374 KB | ~114 KB | Main app bundle (React, Zustand, panels, dnd-kit, virtual) |
| `CodeMirrorEditor.js` | ~923 KB | ~314 KB | Lazy-loaded; only fetched when editor renders |
| `index.css` | ~57 KB | ~10 KB | All styles |
