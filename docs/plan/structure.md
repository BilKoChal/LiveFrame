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
│       │   └── 2 - complete-phase-0.md
│       ├── worklogs/
│       │   ├── 1 - worklog.md
│       │   └── (more to come)
│       └── research/
│           ├── LiveFrame_general_architect_report.md
│           ├── LiveFrame_editor_preview_report.md
│           ├── LiveFrame_filesystem_project_report.md
│           ├── LiveFrame_uiux_layout_report.md
│           └── LiveFrame_devops_build_report.md
│
├── public/
│   └── 404.html                             # SPA redirect for GitHub Pages
│
├── src/
│   ├── main.tsx                             # Entry point — renders App
│   ├── App.tsx                              # Root component — theme hook + AppLayout
│   ├── index.css                            # Global styles + Tailwind v4 + theme vars + fonts
│   ├── vite-env.d.ts                        # Vite type declarations
│   ├── types.ts                             # Shared types: Theme, ActiveTab, ConsoleEntry
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx                # Root layout: toolbar + resizable panels
│   │   │   ├── SingleFileLayout.tsx         # Single-file mode layout (placeholder for Phase 1)
│   │   │   └── ResizeHandle.tsx             # Custom drag handle for panel resizing
│   │   │
│   │   ├── editor/
│   │   │   ├── CodeMirrorEditor.tsx         # Lazy-loaded CM6 editor with Emmet support
│   │   │   ├── SingleFileTabs.tsx           # HTML|CSS|JS tab bar
│   │   │   └── EditorSkeleton.tsx           # Loading skeleton for lazy-loaded CodeMirror
│   │   │
│   │   ├── preview/
│   │   │   └── PreviewFrame.tsx             # Preview iframe + device mode + error overlay
│   │   │
│   │   ├── console/
│   │   │   └── ConsolePanel.tsx             # Console output panel (entries, search, clear)
│   │   │
│   │   └── toolbar/
│   │       ├── Toolbar.tsx                  # Top toolbar (logo, reset, theme)
│   │       ├── RefreshControls.tsx          # Auto-run toggle + manual run button
│   │       └── ThemeToggle.tsx              # Dark/Light/System toggle
│   │
│   ├── stores/
│   │   ├── editorStore.ts                   # Editor content (html, css, js, activeTab)
│   │   ├── uiStore.ts                       # UI state (theme, autoRefresh, console, errors)
│   │   └── layoutStore.ts                   # Layout state (isConsoleOpen, mode, isFileTreeOpen)
│   │
│   ├── hooks/
│   │   ├── useTheme.ts                      # Theme detection + application
│   │   └── useAutoRefresh.ts               # Debounced auto-refresh + manual trigger
│   │
│   └── utils/
│       └── previewBuilder.ts               # assembleDocument() + console capture script
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
| `src/App.tsx` | Root component — initializes theme, renders AppLayout |
| `src/index.css` | Tailwind v4 `@import`, `@theme`, custom fonts (Inter, JetBrains Mono), animations |
| `src/types.ts` | Shared TypeScript types (`Theme`, `ActiveTab`, `ConsoleEntry`) |
| `src/stores/editorStore.ts` | Editor content (html, css, javascript strings, activeTab) + default boilerplate |
| `src/stores/uiStore.ts` | Theme, autoRefresh, consoleEntries, errorOverlay |
| `src/stores/layoutStore.ts` | Panel visibility (isConsoleOpen), mode (single-file/project), file tree visibility |
| `src/utils/previewBuilder.ts` | `assembleDocument()` — combines HTML + CSS + JS + console capture script into srcdoc |
| `src/hooks/useAutoRefresh.ts` | 400ms debounced auto-refresh; manual trigger support |
| `src/hooks/useTheme.ts` | Applies dark/light class to `<html>`, listens for system preference changes |
| `src/components/layout/AppLayout.tsx` | Root layout shell — lazy-loaded CodeMirror in Suspense, resizable panels |
| `src/components/editor/CodeMirrorEditor.tsx` | Lazy-loaded CodeMirror 6 with Emmet (abbreviationTracker) for HTML/CSS |
| `src/components/editor/EditorSkeleton.tsx` | Shimmer loading skeleton shown while CodeMirror loads |
| `src/components/editor/SingleFileTabs.tsx` | HTML/CSS/JS tab switching with icons |
| `src/components/preview/PreviewFrame.tsx` | Iframe preview + device mode switching + error overlay + postMessage listener |
| `src/components/console/ConsolePanel.tsx` | Console output with color-coded entries, search, clear |
| `src/components/toolbar/Toolbar.tsx` | Top bar with logo, RefreshControls, reset, ThemeToggle |
| `src/components/toolbar/RefreshControls.tsx` | Auto-run toggle + manual run button (extracted from Toolbar) |
| `src/components/toolbar/ThemeToggle.tsx` | Light/Dark/System selector |
| `src/components/layout/ResizeHandle.tsx` | Custom resize handle with visual feedback |
| `.github/workflows/deploy.yml` | Auto-deploy to GitHub Pages on push to main |
| `public/404.html` | SPA redirect trick for GitHub Pages |
| `vite.config.ts` | Vite config with dynamic `base` path from `VITE_BASE_PATH` env var |

---

## Build Output

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| `index.js` | ~265 KB | ~82 KB | Main app bundle (React, Zustand, panels) |
| `CodeMirrorEditor.js` | ~661 KB | ~228 KB | Lazy-loaded; only fetched when editor renders |
| `index.css` | ~52 KB | ~9 KB | All styles |
