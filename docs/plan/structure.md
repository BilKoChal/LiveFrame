# LiveFrame — Initial Project Structure

> This file defines the baseline directory layout for the LiveFrame project.  
> The Development Agent will use this as a starting reference and may update it during implementation.

---

## Directory Tree

```
liveframe/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # CI pipeline (lint, typecheck, test, build)
│       └── deploy.yml                      # Deploy to GitHub Pages on CI success
│
├── public/
│   └── favicon.svg                         # App favicon
│
├── src/
│   ├── main.tsx                            # Entry point — renders App
│   ├── App.tsx                             # Root component — providers + router
│   ├── index.css                           # Global styles + Tailwind v4 + theme variables
│   ├── vite-env.d.ts                       # Vite type declarations
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx               # Root layout shell (toolbar + main area)
│   │   │   ├── SingleFileLayout.tsx        # Single-file mode panel layout
│   │   │   ├── ProjectLayout.tsx           # Project mode panel layout
│   │   │   ├── ResizeHandle.tsx            # Custom resize handle component
│   │   │   └── StatusBar.tsx               # Optional bottom status bar
│   │   │
│   │   ├── editor/
│   │   │   ├── CodeMirrorEditor.tsx        # Lazy-loaded CM6 editor (separate chunk)
│   │   │   ├── EditorPanel.tsx             # Editor panel wrapper (tabs + editor)
│   │   │   ├── SingleFileTabs.tsx          # HTML|CSS|JS tab bar for single-file mode
│   │   │   ├── ProjectFileTabs.tsx         # File tab bar for project mode (sortable)
│   │   │   ├── SortableTab.tsx             # Draggable tab item (@dnd-kit)
│   │   │   └── EditorSkeleton.tsx          # Loading skeleton for lazy-loaded editor
│   │   │
│   │   ├── preview/
│   │   │   ├── PreviewPanel.tsx            # Preview panel wrapper
│   │   │   ├── PreviewFrame.tsx            # Iframe component with srcdoc
│   │   │   ├── DeviceFrame.tsx             # Device frame wrapper (phone/tablet/desktop)
│   │   │   ├── ErrorOverlay.tsx            # Runtime error overlay on preview
│   │   │   └── DevicePresets.ts            # Device dimension presets data
│   │   │
│   │   ├── console/
│   │   │   ├── ConsolePanel.tsx            # Console panel (bottom)
│   │   │   ├── ConsoleEntry.tsx            # Individual console message row
│   │   │   └── ConsoleToolbar.tsx          # Console header (clear, filter, search)
│   │   │
│   │   ├── project/
│   │   │   ├── FileTree.tsx                # File tree component (virtualized)
│   │   │   ├── FileTreeNode.tsx            # Tree node (file or directory)
│   │   │   ├── FileTreeContextMenu.tsx     # Right-click context menu
│   │   │   └── ProjectList.tsx             # Project list/gallery page
│   │   │
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx                 # Top toolbar
│   │   │   ├── ModeSwitcher.tsx            # Single-file / Project mode toggle
│   │   │   ├── RefreshControls.tsx         # Auto-refresh toggle + manual refresh
│   │   │   ├── DeviceSelector.tsx          # Device frame preset dropdown
│   │   │   ├── ThemeToggle.tsx             # Dark/Light/System theme dropdown
│   │   │   └── ExportButton.tsx            # ZIP export trigger
│   │   │
│   │   ├── shared/
│   │   │   ├── ExternalResourcePanel.tsx   # Manage external CSS/JS URLs
│   │   │   ├── TemplateGallery.tsx         # Starter template picker dialog
│   │   │   └── SettingsDialog.tsx          # App settings dialog
│   │   │
│   │   └── ui/                             # shadcn/ui generated components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── tabs.tsx
│   │       ├── tooltip.tsx
│   │       ├── select.tsx
│   │       ├── switch.tsx
│   │       ├── scroll-area.tsx
│   │       ├── separator.tsx
│   │       ├── input.tsx
│   │       ├── skeleton.tsx
│   │       ├── sheet.tsx
│   │       ├── collapsible.tsx
│   │       ├── context-menu.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── badge.tsx
│   │       ├── sonner.tsx
│   │       └── ... (other shadcn components)
│   │
│   ├── stores/
│   │   ├── projectStore.ts                 # Project + file CRUD, mode switching
│   │   ├── editorStore.ts                  # Editor content, cursor, dirty state
│   │   ├── uiStore.ts                      # Theme, console entries, errors, preferences
│   │   └── layoutStore.ts                  # Panel visibility, mode, device frame
│   │
│   ├── hooks/
│   │   ├── usePreviewSrcdoc.ts             # Assembles srcdoc from store state
│   │   ├── useConsoleCapture.ts            # Listens for iframe postMessage
│   │   ├── useErrorCapture.ts              # Listens for iframe error messages
│   │   ├── useAutoRefresh.ts               # Debounced auto-refresh logic
│   │   ├── useTheme.ts                     # Theme detection + application
│   │   └── useKeyboardShortcuts.ts         # Global keyboard shortcut handler
│   │
│   ├── lib/
│   │   ├── idb.ts                          # IndexedDB wrapper (database init + CRUD)
│   │   ├── vfs.ts                          # VirtualFileSystem class (flat map + path index)
│   │   ├── preview-builder.ts              # assembleDocument() function
│   │   ├── console-capture-script.ts       # Script injected into iframe for console capture
│   │   ├── zip-export.ts                   # ZIP export/import using fflate
│   │   ├── templates.ts                    # Built-in starter template definitions
│   │   ├── file-utils.ts                  # getLanguageFromPath(), getFileType(), path utils
│   │   └── codemirror/
│   │       ├── themes.ts                   # Dark/light CM6 themes using CSS variables
│   │       ├── extensions.ts               # Extension configs per language
│   │       └── setup.ts                    # CM6 basic setup configuration
│   │
│   ├── pages/
│   │   ├── SingleFileEditor.tsx            # Route: / — single-file editor page
│   │   └── ProjectEditor.tsx               # Route: /project/:id — project editor page
│   │
│   ├── router/
│   │   └── index.tsx                       # React Router configuration
│   │
│   └── test/
│       ├── setup.ts                        # Vitest setup (matchMedia, ResizeObserver mocks)
│       └── utils.tsx                       # Test utilities (custom render, helpers)
│
├── e2e/                                    # Playwright E2E tests (post-MVP)
│   └── editor.spec.ts
│
├── docs/
│   └── plan/                               # This planning package
│       ├── LiveFrame_plan.md
│       ├── synthesis.md
│       ├── structure.md
│       └── research/
│           ├── LiveFrame_general_architect_report.md
│           ├── LiveFrame_editor_preview_report.md
│           ├── LiveFrame_filesystem_project_report.md
│           ├── LiveFrame_uiux_layout_report.md
│           └── LiveFrame_devops_build_report.md
│
├── .env.development                        # VITE_BASE_PATH=/
├── .env.production                         # VITE_BASE_PATH=/LiveFrame/
├── .env.example                            # Documentation for env vars
├── .gitignore
├── .prettierrc                             # Prettier config + tailwind plugin
├── .prettierignore
├── eslint.config.js                        # ESLint 9 flat config
├── tsconfig.json                           # Root — project references
├── tsconfig.app.json                       # App code (browser, strict)
├── tsconfig.node.json                      # Config files (Node.js)
├── vite.config.ts                          # Vite + Tailwind v4 + code splitting
├── vitest.config.ts                        # Vitest + jsdom + coverage
├── package.json                            # Scripts + dependencies
└── README.md                               # Project documentation
```

---

## Key File Responsibilities

| File | Primary Responsibility |
|------|----------------------|
| `src/main.tsx` | Mount React app, import global CSS |
| `src/App.tsx` | Theme provider, router provider, error boundary |
| `src/index.css` | Tailwind v4 `@import`, `@theme inline`, CSS variables for both themes |
| `src/stores/projectStore.ts` | Project CRUD, file tree operations, mode switching, external resources |
| `src/stores/editorStore.ts` | File content per ID, dirty state, cursor/scroll positions, editor view refs |
| `src/stores/uiStore.ts` | Theme, console entries, error overlay, auto-refresh, device frame preference |
| `src/lib/vfs.ts` | VirtualFileSystem class with flat Map + path index, tree building |
| `src/lib/idb.ts` | IndexedDB schema, initialization, CRUD operations |
| `src/lib/preview-builder.ts` | `assembleDocument()` — combines HTML + CSS + JS + external resources + console capture script |
| `src/components/editor/CodeMirrorEditor.tsx` | Lazy-loaded CodeMirror component (separate vendor chunk) |
| `vite.config.ts` | Vite config with dynamic base path, Tailwind v4 plugin, CodeMirror chunk splitting |

---

## Notes for Development Agent

- The `src/components/ui/` directory will be populated by `npx shadcn@latest add <component>` commands — do not manually create these files
- The `src/lib/codemirror/` directory contains theme and extension configurations that read from CSS custom properties, enabling seamless theme switching
- The `src/stores/` directory uses Zustand with `immer` middleware for `projectStore` only; `editorStore` and `uiStore` use plain Zustand for performance
- The `docs/plan/` directory is reserved for planning documents; the Development Agent may store task plans and worklogs here
