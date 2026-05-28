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
│       │   └── 1 - plan-update-and-ghpages-deploy.md
│       ├── worklogs/
│       │   └── (to be created)
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
│   ├── App.tsx                              # Root component — layout + toolbar + panels
│   ├── index.css                            # Global styles + Tailwind v4 + theme vars + fonts
│   ├── types.ts                             # Shared types: Theme, ActiveTab, ConsoleEntry
│   │
│   ├── components/
│   │   ├── CodeMirrorEditor.tsx             # CodeMirror 6 editor (eager, not lazy yet)
│   │   ├── Toolbar.tsx                      # Top toolbar (logo, auto-run, run, reset, theme)
│   │   ├── PreviewFrame.tsx                 # Preview iframe + device mode + error overlay
│   │   ├── SingleFileTabs.tsx               # HTML|CSS|JS tab bar
│   │   ├── ConsolePanel.tsx                 # Console output panel (entries, search, clear)
│   │   ├── ThemeToggle.tsx                  # Dark/Light/System toggle
│   │   └── ResizeHandle.tsx                 # Custom drag handle for panel resizing
│   │
│   ├── stores/
│   │   ├── editorStore.ts                   # Editor content (html, css, js, activeTab)
│   │   └── uiStore.ts                       # UI state (theme, autoRefresh, console, errors)
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
└── metadata.json                            # Project metadata
```

---

## Comparison: Current vs Target Structure

| Category | Current State | Target State (from Plan) | Gap |
|----------|--------------|-------------------------|-----|
| **Components** | Flat `src/components/` | Subdirectories: `layout/`, `editor/`, `preview/`, `console/`, `toolbar/`, `shared/`, `ui/` | Need to reorganize into subdirectories |
| **Stores** | `editorStore.ts`, `uiStore.ts` | Add `projectStore.ts`, `layoutStore.ts` | 2 stores missing |
| **Hooks** | `useTheme.ts`, `useAutoRefresh.ts` | Add `usePreviewSrcdoc`, `useConsoleCapture`, `useErrorCapture`, `useKeyboardShortcuts` | 4 hooks missing (some logic is inline) |
| **Utils/Lib** | `src/utils/previewBuilder.ts` | `src/lib/` with `idb.ts`, `vfs.ts`, `preview-builder.ts`, `console-capture-script.ts`, `zip-export.ts`, `templates.ts`, `file-utils.ts`, `codemirror/` | Most lib files not created yet |
| **Pages** | None (all in `App.tsx`) | `src/pages/SingleFileEditor.tsx`, `ProjectEditor.tsx` | Not created yet |
| **Router** | None | `src/router/index.tsx` | React Router not installed yet |
| **UI Components** | None | `src/components/ui/` (shadcn) | shadcn/ui not initialized yet |
| **Workflows** | `deploy.yml` | `ci.yml` + `deploy.yml` | CI workflow not created yet |

---

## Key File Responsibilities

| File | Primary Responsibility |
|------|----------------------|
| `src/main.tsx` | Mount React app, import global CSS |
| `src/App.tsx` | Root layout — toolbar + resizable panels (editor/preview/console) |
| `src/index.css` | Tailwind v4 `@import`, `@theme`, custom fonts (Inter, JetBrains Mono), animations |
| `src/types.ts` | Shared TypeScript types (`Theme`, `ActiveTab`, `ConsoleEntry`) |
| `src/stores/editorStore.ts` | Editor content (html, css, javascript strings, activeTab) + default boilerplate |
| `src/stores/uiStore.ts` | Theme, autoRefresh, consoleEntries, errorOverlay, isConsoleOpen |
| `src/utils/previewBuilder.ts` | `assembleDocument()` — combines HTML + CSS + JS + console capture script into srcdoc |
| `src/hooks/useAutoRefresh.ts` | 400ms debounced auto-refresh; manual trigger support |
| `src/hooks/useTheme.ts` | Applies dark/light class to `<html>`, listens for system preference changes |
| `src/components/CodeMirrorEditor.tsx` | CodeMirror 6 editor with language extensions |
| `src/components/PreviewFrame.tsx` | Iframe preview + device mode switching + error overlay display + postMessage listener |
| `src/components/Toolbar.tsx` | Top bar with logo, auto-run toggle, manual run, reset, theme toggle |
| `src/components/ConsolePanel.tsx` | Console output with color-coded entries, search, clear |
| `src/components/SingleFileTabs.tsx` | HTML/CSS/JS tab switching with icons |
| `src/components/ThemeToggle.tsx` | Light/Dark/System selector |
| `src/components/ResizeHandle.tsx` | Custom resize handle with visual feedback |
| `.github/workflows/deploy.yml` | Auto-deploy to GitHub Pages on push to main |
| `public/404.html` | SPA redirect trick for GitHub Pages |
| `vite.config.ts` | Vite config with dynamic `base` path from `VITE_BASE_PATH` env var |
