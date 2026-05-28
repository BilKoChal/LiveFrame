# LiveFrame — General Architecture Report

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Author**: General / Overall Architect Sub-Agent  
> **Date**: 2026-03-05  
> **Version**: 1.0

---

## Table of Contents

1. [Overall App Architecture](#1-overall-app-architecture)
2. [Tech Stack Integration](#2-tech-stack-integration)
3. [Routing Strategy](#3-routing-strategy)
4. [Testing Strategy](#4-testinging-strategy)
5. [Deployment Pipeline](#5-deployment-pipeline)
6. [Critical Path](#6-critical-path)
7. [Risk Assessment](#7-risk-assessment)
8. [Recommended Folder Structure](#8-recommended-folder-structure)

---

## 1. Overall App Architecture

### 1.1 Component Hierarchy

LiveFrame follows a top-down component hierarchy with clear separation of concerns. The application is structured around two primary modes — **Single-File Mode** and **Project Mode** — which share common infrastructure but differ in their file management and editor layout.

```
<App>
├── <ThemeProvider>                    // Dark/light theme context
├── <RouterProvider>
│   ├── <Layout>
│   │   ├── <TopBar>
│   │   │   ├── <Logo />
│   │   │   ├── <ModeToggle />         // Single-file vs Project
│   │   │   ├── <AutoRefreshToggle />
│   │   │   ├── <ThemeToggle />
│   │   │   └── <ActionButtons />      // Export ZIP, Settings
│   │   └── <Outlet />                 // Route content
│   │
│   ├── <SingleFileEditor>             // Route: /
│   │   ├── <EditorPane>
│   │   │   ├── <CodeMirrorEditor language="html" />
│   │   │   ├── <CodeMirrorEditor language="css" />
│   │   │   └── <CodeMirrorEditor language="javascript" />
│   │   ├── <ResizeHandle />
│   │   └── <PreviewPane>
│   │       ├── <DeviceFrame>
│   │       │   └── <IframePreview />
│   │       ├── <ConsoleOverlay />
│   │       └── <ErrorOverlay />
│   │
│   ├── <ProjectEditor>               // Route: /project/:id
│   │   ├── <Sidebar>
│   │   │   ├── <FileTree />
│   │   │   └── <ResourcePanel />     // External CSS/JS
│   │   ├── <EditorArea>
│   │   │   ├── <TabBar />
│   │   │   └── <CodeMirrorEditor />  // Dynamic language
│   │   ├── <ResizeHandle />
│   │   └── <PreviewPane>
│   │       ├── <DeviceFrame>
│   │       │   └── <IframePreview />
│   │       ├── <ConsoleOverlay />
│   │       └── <ErrorOverlay />
│   │
│   └── <SettingsDialog />            // Modal overlay
│       ├── <ExternalResourcesForm />
│       ├── <EditorPreferencesForm />
│       └── <TemplateGallery />
```

### 1.2 Data Flow Diagram (Text-Based)

The application follows a **unidirectional data flow** pattern. Zustand stores act as the single source of truth, React components subscribe to slices of store state, user actions dispatch to stores, and stores trigger re-renders only on subscribed components.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER INTERACTIONS                           │
│  (Typing in editor, clicking buttons, resizing panes, file ops)     │
└─────────────────────┬────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      ZUSTAND STORES (State Layer)                    │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │  editorStore │  │ projectStore │  │  uiStore       │              │
│  │              │  │              │  │                │              │
│  │ • sourceCode │  │ • projects[] │  │ • theme        │              │
│  │ • activeTab  │  │ • activeId   │  │ • autoRefresh  │              │
│  │ • language   │  │ • files{}    │  │ • deviceFrame  │              │
│  │ • cursorPos  │  │ • expanded[] │  │ • splitRatio   │              │
│  └──────┬───────┘  └──────┬───────┘  │ • consoleData  │              │
│         │                 │          │ • errorData    │              │
│         │                 │          └───────┬────────┘              │
│         │                 │                  │                        │
│         └─────────┬───────┘                  │                        │
│                   │                          │                        │
│                   ▼                          │                        │
│         ┌─────────────────┐                  │                        │
│         │ previewBuilder  │◄─────────────────┘                        │
│         │ (srcdoc assembly)│                                           │
│         └────────┬────────┘                                           │
└──────────────────┼────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     REACT COMPONENTS (View Layer)                    │
│                                                                      │
│  <CodeMirrorEditor> ◄── subscribes to editorStore/projectStore      │
│  <IframePreview>    ◄── subscribes to assembled srcdoc              │
│  <ConsoleOverlay>   ◄── subscribes to uiStore.consoleData           │
│  <ErrorOverlay>     ◄── subscribes to uiStore.errorData             │
│  <FileTree>         ◄── subscribes to projectStore                  │
│  <DeviceFrame>      ◄── subscribes to uiStore.deviceFrame           │
└──────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  SIDE EFFECTS (Persistence Layer)                     │
│                                                                      │
│  IndexedDB (via `idb` v8.x)  ◄── auto-save debounce (1s)           │
│  ZIP Export (via `jszip`)     ◄── manual trigger                    │
│  Console Capture              ◄── postMessage from iframe            │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 Zustand Store Organization (Slicing Strategy)

LiveFrame uses **Zustand with a slice pattern** where each domain concern gets its own store. This avoids the single-giant-store anti-pattern and enables fine-grained subscriptions. Each store is created with `create()` and exposes actions co-located with state. Stores may reference each other via the `getState()` API (Zustand's recommended pattern for cross-store communication), but we avoid circular dependencies.

#### Store 1: `editorStore` (Single-File Mode)

```typescript
// src/stores/editorStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getIDB } from '@/lib/idb';

interface EditorState {
  // State
  html: string;
  css: string;
  javascript: string;
  activeTab: 'html' | 'css' | 'javascript';
  cursorPosition: { line: number; col: number } | null;

  // Actions
  setHtml: (code: string) => void;
  setCss: (code: string) => void;
  setJavascript: (code: string) => void;
  setActiveTab: (tab: 'html' | 'css' | 'javascript') => void;
  setCursorPosition: (pos: { line: number; col: number } | null) => void;
  resetAll: () => void;
  loadTemplate: (template: Template) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      html: '',
      css: '',
      javascript: '',
      activeTab: 'html',
      cursorPosition: null,

      setHtml: (code) => set({ html: code }),
      setCss: (code) => set({ css: code }),
      setJavascript: (code) => set({ javascript: code }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setCursorPosition: (pos) => set({ cursorPosition: pos }),
      resetAll: () => set({ html: '', css: '', javascript: '' }),
      loadTemplate: (template) => set({
        html: template.html,
        css: template.css,
        javascript: template.javascript,
      }),
    }),
    {
      name: 'liveframe-editor',
      storage: createJSONStorage(() => getIDB()), // IndexedDB persistence
      partialize: (state) => ({
        html: state.html,
        css: state.css,
        javascript: state.javascript,
      }),
    }
  )
);
```

#### Store 2: `projectStore` (Multi-File Mode)

```typescript
// src/stores/projectStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getIDB } from '@/lib/idb';

interface ProjectFile {
  id: string;
  name: string;
  path: string;         // e.g., "src/App.tsx"
  language: string;     // html, css, javascript, typescript, json
  content: string;
}

interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  externalCSS: string[];   // URLs
  externalJS: string[];    // URLs
  createdAt: number;
  updatedAt: number;
}

interface ProjectState {
  // State
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;
  expandedFolders: string[];

  // Computed (via selectors)
  getActiveProject: () => Project | undefined;
  getActiveFile: () => ProjectFile | undefined;

  // Actions
  createProject: (name: string, template?: ProjectTemplate) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  addFile: (projectId: string, file: Omit<ProjectFile, 'id'>) => string;
  deleteFile: (projectId: string, fileId: string) => void;
  renameFile: (projectId: string, fileId: string, newName: string) => void;
  updateFileContent: (projectId: string, fileId: string, content: string) => void;
  setActiveProject: (id: string | null) => void;
  setActiveFile: (id: string | null) => void;
  toggleFolder: (path: string) => void;
  addExternalCSS: (projectId: string, url: string) => void;
  removeExternalCSS: (projectId: string, url: string) => void;
  addExternalJS: (projectId: string, url: string) => void;
  removeExternalJS: (projectId: string, url: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeFileId: null,
      expandedFolders: [],

      getActiveProject: () =>
        get().projects.find((p) => p.id === get().activeProjectId),

      getActiveFile: () =>
        get().getActiveProject()?.files.find((f) => f.id === get().activeFileId),

      createProject: (name, template) => {
        const id = crypto.randomUUID();
        const files: ProjectFile[] = template
          ? template.files.map((f) => ({ ...f, id: crypto.randomUUID() }))
          : [
              { id: crypto.randomUUID(), name: 'index.html', path: 'index.html', language: 'html', content: '' },
              { id: crypto.randomUUID(), name: 'style.css', path: 'style.css', language: 'css', content: '' },
              { id: crypto.randomUUID(), name: 'script.js', path: 'script.js', language: 'javascript', content: '' },
            ];
        set((state) => ({
          projects: [
            ...state.projects,
            { id, name, files, externalCSS: [], externalJS: [], createdAt: Date.now(), updatedAt: Date.now() },
          ],
          activeProjectId: id,
          activeFileId: files[0]?.id ?? null,
        }));
        return id;
      },
      // ... other actions
    }),
    {
      name: 'liveframe-projects',
      storage: createJSONStorage(() => getIDB()),
    }
  )
);
```

#### Store 3: `uiStore` (UI Preferences & Runtime Data)

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ConsoleEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

interface UIState {
  // Preferences (persisted)
  theme: 'dark' | 'light' | 'system';
  autoRefresh: boolean;
  deviceFrame: 'none' | 'iphone' | 'ipad' | 'android' | 'desktop';
  splitRatio: number;         // 0..1, position of the resize handle
  fontSize: number;
  emmetEnabled: boolean;
  tabSize: number;
  wordWrap: boolean;

  // Runtime (not persisted)
  consoleEntries: ConsoleEntry[];
  errorOverlay: { message: string; line?: number; column?: number } | null;
  isPreviewLoading: boolean;

  // Actions
  setTheme: (theme: UIState['theme']) => void;
  setAutoRefresh: (v: boolean) => void;
  setDeviceFrame: (frame: UIState['deviceFrame']) => void;
  setSplitRatio: (ratio: number) => void;
  addConsoleEntry: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => void;
  clearConsole: () => void;
  setErrorOverlay: (error: UIState['errorOverlay']) => void;
  setPreviewLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      autoRefresh: true,
      deviceFrame: 'none',
      splitRatio: 0.5,
      fontSize: 14,
      emmetEnabled: true,
      tabSize: 2,
      wordWrap: true,
      consoleEntries: [],
      errorOverlay: null,
      isPreviewLoading: false,

      setTheme: (theme) => set({ theme }),
      setAutoRefresh: (v) => set({ autoRefresh: v }),
      setDeviceFrame: (frame) => set({ deviceFrame: frame }),
      setSplitRatio: (ratio) => set({ splitRatio: ratio }),
      addConsoleEntry: (entry) =>
        set((state) => ({
          consoleEntries: [
            ...state.consoleEntries,
            { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
          ],
        })),
      clearConsole: () => set({ consoleEntries: [] }),
      setErrorOverlay: (error) => set({ errorOverlay: error }),
      setPreviewLoading: (loading) => set({ isPreviewLoading: loading }),
    }),
    {
      name: 'liveframe-ui',
      partialize: (state) => ({
        theme: state.theme,
        autoRefresh: state.autoRefresh,
        deviceFrame: state.deviceFrame,
        splitRatio: state.splitRatio,
        fontSize: state.fontSize,
        emmetEnabled: state.emmetEnabled,
        tabSize: state.tabSize,
        wordWrap: state.wordWrap,
      }),
    }
  )
);
```

### 1.4 Component Communication Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| **Store subscription** | Primary data flow; components subscribe to Zustand slices | `<CodeMirrorEditor>` reads `useEditorStore(s => s.html)` |
| **Props drilling** | Only within a small parent-child scope | `<Layout>` passes `onToggle` to `<TopBar>` |
| **Custom hooks** | Encapsulate store logic + side effects | `usePreviewSrcdoc()` assembles HTML from store state |
| **Event handlers** | Imperative actions dispatched to stores | `onChange` in CodeMirror calls `editorStore.setHtml()` |
| **Iframe postMessage** | Runtime: iframe sends console/error messages to parent | `window.parent.postMessage({ type: 'console', ... })` |
| **Debounced selectors** | Performance: auto-refresh uses a debounced `srcdoc` builder | `useDebouncedSrcdoc(300)` for auto-refresh, immediate for manual |

---

## 2. Tech Stack Integration

### 2.1 How the Pieces Fit Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vite (Build Tool)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ TypeScript   │  │ React 19     │  │ Tailwind CSS 4        │ │
│  │ (tsc via     │  │ (with JSX    │  │ (via @tailwindcss/    │ │
│  │  vite-plugin)│  │  transform)  │  │  vite plugin)         │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                      │             │
│         └────────┬────────┘──────────────────────┘             │
│                  │                                              │
│  ┌───────────────▼───────────────────────────────────────────┐ │
│  │                  Application Layer                         │ │
│  │                                                            │ │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────────────────┐  │ │
│  │  │ Zustand  │  │ React Router│  │  shadcn/ui           │  │ │
│  │  │ (State)  │  │ (Routing)   │  │  (UI Components)     │  │ │
│  │  └────┬─────┘  └──────┬──────┘  └──────────┬───────────┘  │ │
│  │       │               │                     │              │ │
│  │  ┌────▼───────────────▼─────────────────────▼───────────┐  │ │
│  │  │           Feature Components                         │  │ │
│  │  │  ┌────────────────┐  ┌─────────────────────────────┐ │  │ │
│  │  │  │ CodeMirror 6   │  │ Iframe Preview              │ │  │ │
│  │  │  │ (@uiw/react-   │  │ (srcdoc-based rendering)    │ │  │ │
│  │  │  │  codemirror)   │  │                             │ │  │ │
│  │  │  │ + Emmet plugin │  │ + Console capture           │ │  │ │
│  │  │  │ + Theme sync   │  │ + Error overlay             │ │  │ │
│  │  │  └────────────────┘  └─────────────────────────────┘ │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Persistence Layer                            │  │
│  │  ┌──────────┐  ┌─────────┐  ┌──────────────────────┐    │  │
│  │  │ IndexedDB│  │ JSZip   │  │ file-saver           │    │  │
│  │  │ (via idb)│  │ (export)│  │ (download trigger)   │    │  │
│  │  └──────────┘  └─────────┘  └──────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Dependency Map

Below is the precise dependency graph with concrete package names and versions (as of 2026-03):

```
liveframe/
├── react@^19.0.0                     # Core UI library
├── react-dom@^19.0.0                 # React DOM renderer
├── react-router-dom@^7.15.0          # Client-side routing
│
├── zustand@^5.0.0                    # State management
├── idb@^8.0.0                        # IndexedDB wrapper (for persist middleware)
├── immer@^10.0.0                     # Immutable state helpers (optional, for complex updates)
│
├── @uiw/react-codemirror@^4.25.0     # React wrapper for CM6
│   ├── @codemirror/state             # (transitive) CM6 state management
│   ├── @codemirror/view              # (transitive) CM6 view layer
│   ├── @codemirror/lang-html@^6.4.0  # HTML language support
│   ├── @codemirror/lang-css@^6.3.0   # CSS language support
│   ├── @codemirror/lang-javascript@^6.2.0  # JS/TS language support
│   ├── @codemirror/lang-json@^6.0.0  # JSON language support
│   ├── @codemirror/autocomplete@^6.20.0    # Autocomplete
│   ├── @codemirror/theme-one-dark@^6.1.0   # One Dark theme
│   ├── @codemirror/lint              # Linting support
│   └── @emmetio/codemirror6-plugin@^0.4.0  # Emmet abbreviations
│
├── tailwindcss@^4.0.0                # Utility CSS framework
│   └── @tailwindcss/vite             # Vite plugin for Tailwind 4
│
├── jszip@^3.10.0                     # ZIP file creation
├── file-saver@^2.0.5                 # Client-side file download
│
├── lucide-react@^0.470.0             # Icon library
├── clsx@^2.1.0                       # Conditional classnames
├── tailwind-merge@^3.0.0             # Merge Tailwind classes safely
│
├── class-variance-authority@^0.7.0   # Variant-based component styling
└── @radix-ui/*                       # Primitives for shadcn/ui components
```

**Dev Dependencies:**

```
├── vite@^6.0.0                       # Build tool
├── @vitejs/plugin-react@^4.0.0       # React Fast Refresh
├── typescript@^5.7.0                 # Type checker
├── @types/react@^19.0.0              # React type definitions
├── @types/react-dom@^19.0.0          # React DOM type definitions
├── vitest@^3.0.0                     # Unit test runner (Vite-native)
├── @testing-library/react@^16.3.0    # React component testing
├── @testing-library/jest-dom@^6.6.0  # Custom DOM matchers
├── jsdom@^26.0.0                     # DOM environment for tests
├── @playwright/test@^1.60.0          # E2E test framework
├── eslint@^9.0.0                     # Linter
├── prettier@^3.5.0                   # Code formatter
└── @vitest/coverage-v8@^3.0.0        # Code coverage
```

### 2.3 Integration Points and Potential Conflicts

| Integration Point | Concern | Resolution |
|---|---|---|
| **Tailwind 4 + shadcn/ui** | shadcn/ui components ship with Tailwind class names; Tailwind 4 changed config format (`@theme` in CSS vs `tailwind.config.js`) | Use the `@tailwindcss/vite` plugin; ensure shadcn/ui is initialized with Tailwind v4 support. Most shadcn/ui CLI versions now support v4. Run `npx shadcn@latest init` with Tailwind v4 flag. |
| **CodeMirror 6 theme ↔ Zustand theme** | When user toggles dark/light mode, both Tailwind CSS classes AND CodeMirror editor theme must update in sync | Create a `useEditorTheme()` hook that reads `uiStore.theme` and returns the appropriate CM6 `Extension[]` (either `oneDark` or a custom light theme). Apply as a compartment. |
| **React 19 + CodeMirror imperative API** | CodeMirror 6 uses an imperative API; React's concurrent rendering can cause stale references | Use `useRef` for the `EditorView` instance; avoid storing CM6 state in React state. Use `useEffect` with stable dependency arrays to sync CM6 extensions. |
| **Zustand `persist` + IndexedDB** | `persist` middleware defaults to `localStorage`; IndexedDB is async | Use `createJSONStorage(() => idbStorageAdapter)` where `idbStorageAdapter` wraps the `idb` library to expose `getItem`/`setItem`/`removeItem` as async methods. Zustand's `persist` middleware supports async storage. |
| **Emmet plugin + CodeMirror autocompletion** | Both provide completion sources; Emmet abbreviations may conflict with standard HTML/CSS completions | Configure Emmet with `emmetConfig` to only trigger on explicit key (Tab), while standard autocomplete uses Ctrl+Space. Use CM6's `precedence` to control ordering. |
| **Vite `base` config + React Router** | GitHub Pages serves from a subpath (`/LiveFrame/`); React Router needs to know the basename | Set `base: '/LiveFrame/'` in `vite.config.ts` and `<BrowserRouter basename="/LiveFrame">`. All asset paths are then handled correctly. |

### 2.4 shadcn/ui Component Inventory

The following shadcn/ui components will be needed (install via `npx shadcn@latest add <component>`):

- `button` — Toolbar actions, mode toggle
- `dropdown-menu` — Settings menu, file context menus
- `dialog` — Settings dialog, template gallery
- `tabs` — Single-file editor tab switching (HTML/CSS/JS)
- `tooltip` — Toolbar icon labels
- `select` — Device frame selector, font size
- `switch` — Auto-refresh toggle, Emmet toggle, word wrap
- `slider` — Split pane ratio (optional)
- `scroll-area` — Console output, file tree
- `separator` — Visual dividers
- `input` — File name input, external resource URL
- `skeleton` — Loading states
- `sheet` — Mobile sidebar (project mode)
- `collapsible` — File tree folders
- `toast` / `sonner` — Notification toasts
- `context-menu` — File tree right-click actions
- `resizable` (via `react-resizable-panels`) — Split pane layout

---

## 3. Routing Strategy

### 3.1 React Router vs TanStack Router

**Recommendation: React Router v7**

Rationale:
- **React Router v7** (the latest, `react-router-dom@7.x`) is the standard, well-documented choice. It now incorporates many Remix-inspired patterns (loaders, actions) but works perfectly as a client-side SPA router.
- **TanStack Router** offers type-safe routing and built-in search params, but adds significant complexity for a project of LiveFrame's scope. Its file-based routing and strong typing shine in large apps with many routes.
- LiveFrame has a small route surface (3-4 routes). The added type-safety of TanStack Router doesn't justify the learning curve and boilerplate.
- React Router v7 is the default for Vite React templates and has better community support for the shadcn/ui + Vite ecosystem.

### 3.2 Route Structure

```
/                        → Home / Single-File Editor
/project                 → Project list (create/manage projects)
/project/:projectId      → Project editor (file tree + code editor + preview)
/project/:projectId/file/:fileId → (Optional deep-link to specific file, scroll-into-view)
/settings                → (Could be a dialog instead of a route)
```

### 3.3 Route Configuration

```typescript
// src/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SingleFileEditor } from '@/pages/SingleFileEditor';
import { ProjectList } from '@/pages/ProjectList';
import { ProjectEditor } from '@/pages/ProjectEditor';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        {
          index: true,
          element: <SingleFileEditor />,
        },
        {
          path: 'project',
          children: [
            {
              index: true,
              element: <ProjectList />,
            },
            {
              path: ':projectId',
              element: <ProjectEditor />,
              loader: async ({ params }) => {
                // Verify project exists in store; redirect if not
                const { useProjectStore } = await import('@/stores/projectStore');
                const project = useProjectStore.getState().projects.find(
                  (p) => p.id === params.projectId
                );
                if (!project) {
                  throw new Response('Not Found', { status: 404 });
                }
                return { project };
              },
            },
          ],
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL, // '/LiveFrame/' in production, '/' in dev
  }
);
```

### 3.4 Mode Switching Logic

The transition between Single-File and Project mode is handled via the `<ModeToggle>` button in the top bar. This is **not** a route-level concern but a navigation concern:

- **Single-File → Project**: Navigate to `/project` to see the project list, then select/create one.
- **Project → Single-File**: Navigate to `/` to return to single-file mode.
- The mode toggle is simply a link/redirect, not a state toggle — the URL is the source of truth for which mode is active.

### 3.5 URL-Based State

| Route | Derived State | Purpose |
|-------|--------------|---------|
| `/` | `mode = 'single'` | Single-file editor with HTML/CSS/JS tabs |
| `/project` | `mode = 'project-list'` | Browse/create/manage projects |
| `/project/:id` | `mode = 'project'`, `activeProjectId = id` | Project editor with file tree |
| Query `?tab=css` | `activeTab = 'css'` | Deep-link to specific tab (single-file) |
| Query `?file=style.css` | `activeFile = ...` | Deep-link to specific file (project) |

---

## 4. Testing Strategy

### 4.1 Framework Choices

| Level | Framework | Rationale |
|-------|-----------|-----------|
| **Unit** | **Vitest 3** | Native Vite integration (shared config, instant transforms), Jest-compatible API, ESM-first |
| **Component** | **React Testing Library (RTL) 16** | Tests user behavior, not implementation; pairs perfectly with Vitest |
| **E2E** | **Playwright 1.60** | Cross-browser, auto-wait, excellent iframe support (critical for LiveFrame's preview) |

### 4.2 Test Pyramid

```
         ╱╲
        ╱  ╲         E2E (Playwright)
       ╱    ╲        ~10 tests
      ╱──────╲       Critical user journeys only
     ╱        ╲
    ╱          ╲     Integration (RTL + Vitest)
   ╱            ╲    ~40 tests
  ╱──────────────╲   Component behavior, store interactions
 ╱                ╲
╱                  ╲  Unit (Vitest)
╱────────────────────╲ ~80 tests
                      Pure functions, store logic, utility functions
```

### 4.3 What to Test at Each Level

#### Unit Tests (~80 tests)

| Module | What to Test | Examples |
|--------|-------------|----------|
| **Zustand Stores** | State transitions, action correctness, persistence logic | `editorStore.setHtml('x')` → `state.html === 'x'`; `projectStore.createProject()` adds to list |
| **Preview Builder** | srcdoc assembly from source code | `buildSrcdoc({ html, css, js, externalCSS, externalJS })` produces correct HTML document |
| **Template System** | Template loading, validation | `loadTemplate('blank')` produces correct initial state |
| **File Path Utilities** | Path normalization, language detection from extension | `getLanguageFromPath('App.tsx')` → `'typescript'` |
| **Debounce Utilities** | Timing correctness | `debounce(fn, 300)` fires after delay, cancels on subsequent calls |
| **Console Capture Script** | Message serialization | Injected iframe script correctly intercepts `console.log/warn/error` |

#### Component/Integration Tests (~40 tests)

| Component | What to Test | Key Assertions |
|-----------|-------------|----------------|
| **`<SingleFileEditor>`** | Tab switching updates active editor | Click CSS tab → CSS editor visible |
| **`<CodeMirrorEditor>`** | Code changes dispatch to store | Type in editor → store updates |
| **`<IframePreview>`** | srcdoc changes trigger iframe refresh | Update store → iframe srcdoc matches |
| **`<FileTree>`** | File operations (add, rename, delete) | Add file → tree updates; click file → activeFileId changes |
| **`<ConsoleOverlay>`** | Console entries display correctly | Add console entry → entry visible in overlay |
| **`<ErrorOverlay>`** | Error display and dismiss | Set error → overlay visible; click dismiss → overlay hidden |
| **`<DeviceFrame>`** | Frame switching | Select iPhone → iframe wrapped in iPhone frame |
| **`<SettingsDialog>`** | Preference persistence | Toggle auto-refresh → preference saved in store |
| **`<TopBar>`** | Navigation and mode toggle | Click mode toggle → navigates to correct route |

#### E2E Tests (~10 tests)

| Flow | Steps | Assertion |
|------|-------|-----------|
| **Single-file edit & preview** | Navigate to `/` → Type HTML → See preview update | Preview iframe contains typed HTML |
| **CSS live update** | Type in CSS tab → Preview styles update | Element in iframe has applied styles |
| **Console capture** | JS code with `console.log()` → Console panel shows entry | Console entry matches log message |
| **Error overlay** | JS code with syntax error → Error overlay appears | Error overlay shows error message |
| **Project create & edit** | Create project → Add file → Edit → Preview | Project saved, preview reflects edits |
| **Template load** | Load starter template → Preview shows template | Preview renders template correctly |
| **ZIP export** | Create content → Click export → Download ZIP | ZIP file contains expected files |
| **Theme toggle** | Toggle dark/light → Both UI and editor theme change | Editor uses correct CM6 theme |
| **Device frame** | Select device frame → Preview wraps in frame | Preview iframe has device dimensions |
| **Auto-refresh toggle** | Disable auto-refresh → Edit code → No preview update; Enable → Updates | Preview only updates when auto-refresh is on |

### 4.4 Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,               // Don't process CSS in tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver (needed for shadcn/ui components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia (needed for theme detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

### 4.5 Playwright E2E Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 5. Deployment Pipeline

### 5.1 Overview

LiveFrame uses **two GitHub Actions workflows** with a `workflow_run` dependency to ensure that deployment only happens after CI passes:

```
┌───────────────────┐
│   Push / PR       │
│   to main branch  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│   CI Workflow     │  (ci.yml)
│   - Lint          │
│   - Type-check    │
│   - Unit tests    │
│   - Build         │
└────────┬──────────┘
         │
         │ (on success only)
         ▼
┌───────────────────┐
│  Deploy Workflow  │  (deploy.yml)
│  - Build (prod)   │
│  - Deploy to      │
│    GitHub Pages   │
└───────────────────┘
```

### 5.2 CI Workflow (`ci.yml`)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    name: Unit & Component Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  build:
    name: Build Verification
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

### 5.3 Deploy Workflow (`deploy.yml`)

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: deploy-pages
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          BASE_PATH: /LiveFrame/

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 5.4 Base Path Handling for GitHub Pages

GitHub Pages serves sites at `https://<username>.github.io/<repo-name>/`, meaning all asset paths must be prefixed with `/LiveFrame/`. This requires careful configuration across three systems:

**1. Vite Config:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@uiw/react-codemirror',
            '@codemirror/state',
            '@codemirror/view',
          ],
        },
      },
    },
  },
});
```

**2. React Router:**

```typescript
// src/router.tsx
export const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL, // Vite injects this from `base` config
});
```

**3. Asset References in Code:**

All static asset references should use `import` or `new URL()` patterns that Vite can resolve. Never hardcode `/LiveFrame/` in source code — always use `import.meta.env.BASE_URL` as a prefix for dynamic paths.

### 5.5 Workflow_run Dependency Details

The `workflow_run` trigger in `deploy.yml` ensures:

1. **Deployment only on `main` branch**: The CI workflow must complete on the `main` branch before deploy triggers.
2. **PR previews are NOT deployed**: PRs trigger CI (lint, test, build) but not deployment.
3. **No race conditions**: `concurrency: group: deploy-pages` with `cancel-in-progress: false` ensures sequential deployments.
4. **Failure isolation**: If CI fails, the `workflow_run.conclusion` will be `'failure'`, and the deploy job's `if` condition prevents it from running.

### 5.6 NPM Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## 6. Critical Path

### 6.1 Build Order (Dependency Chain)

The following diagram shows what must be built first and what depends on what. Items at the same level can be built in parallel.

```
Phase 0: Project Scaffolding
├── Vite + React + TypeScript project setup
├── Tailwind CSS 4 + shadcn/ui initialization
├── ESLint + Prettier configuration
└── GitHub repository + CI/CD workflows

Phase 1: Core Infrastructure (BLOCKING — everything depends on this)
├── Zustand stores (editorStore, uiStore)
│   └── Depends on: idb storage adapter
├── Layout component + TopBar
├── Router setup (React Router)
└── Theme system (dark/light)

Phase 2: Single-File Editor (MVP — must work first)
├── CodeMirror integration (@uiw/react-codemirror)
│   ├── HTML/CSS/JS language modes
│   ├── Theme sync (dark/light)
│   └── Basic editor preferences (font size, tab size)
├── Split-pane layout (resizable)
├── Iframe preview (srcdoc-based)
│   ├── srcdoc assembly from HTML + CSS + JS
│   └── Auto-refresh with debounce
└── Tab switching (HTML / CSS / JS)

Phase 3: Preview Enhancements
├── Console capture (postMessage from iframe)
│   └── Injected script that overrides console methods
├── Error overlay (parse iframe errors)
├── Device frame (responsive preview)
└── Manual refresh toggle (auto-refresh on/off)

Phase 4: Persistence & Templates
├── IndexedDB persistence for editor state
├── Starter templates (blank, hello-world, portfolio, etc.)
├── Template gallery UI
└── Auto-save with debounce

Phase 5: Project Mode
├── Project store (projectStore)
├── Project list page (create/delete/rename)
├── File tree component (add/delete/rename files)
├── Multi-tab editor (dynamic language)
├── External CSS/JS resource management
└── Project-level IndexedDB persistence

Phase 6: Export & Polish
├── ZIP export (JSZip + file-saver)
├── Emmet support (@emmetio/codemirror6-plugin)
├── Keyboard shortcuts
├── Mobile-responsive layout
└── Accessibility (keyboard nav, ARIA)

Phase 7: Testing & Hardening
├── Unit tests (Vitest)
├── Component tests (RTL)
├── E2E tests (Playwright)
├── Performance optimization (code splitting, lazy loading)
└── Error boundaries
```

### 6.2 Key Dependencies (Critical Items)

| Item | Why Critical | Blocked By |
|------|-------------|------------|
| CodeMirror integration | Core user experience; complex setup with extensions, themes, Emmet | Phase 1 (store, layout) |
| Iframe preview + console capture | The "live" in "LiveFrame"; console capture requires injected script | Phase 2 (editor, srcdoc builder) |
| IndexedDB persistence | Data loss on refresh kills UX; async storage adapter is non-trivial | Phase 1 (store architecture) |
| Project mode file tree | Complex UI component; recursive rendering, drag-drop, context menus | Phase 2 (single-file editor as template) |
| GitHub Pages base path | Breaking asset paths = broken deployment; must get right early | Phase 0 (project setup) |

---

## 7. Risk Assessment

### Risk 1: Iframe srcdoc Performance with Large Code

**Severity**: High  
**Likelihood**: Medium

When users write large applications (1000+ lines of HTML/CSS/JS), re-rendering the entire iframe via `srcdoc` on every keystroke can cause visible lag, especially with auto-refresh enabled. The browser must parse, layout, and paint the entire document from scratch each time.

**Mitigation**:
- **Debounced auto-refresh**: Default 300ms debounce; configurable by user.
- **Incremental updates for CSS**: Instead of full srcdoc refresh, inject CSS changes via `iframe.contentDocument.querySelector('style').textContent = newCSS`. This avoids a full re-parse for style-only changes.
- **Manual refresh mode**: Allow users to disable auto-refresh and trigger preview updates manually (Ctrl+Enter).
- **Web Worker for srcdoc assembly**: Offload the string concatenation and template building to a Web Worker if profiling shows it's a bottleneck.

### Risk 2: CodeMirror 6 Extension Conflicts and Complexity

**Severity**: Medium-High  
**Likelihood**: Medium

CodeMirror 6 uses a compartment-based extension system. Adding multiple extensions (language modes, themes, Emmet, autocomplete, lint) dynamically requires careful use of `Compartment.reconfigure()`. Mismanagement can lead to stale extensions, duplicate completions, or broken themes.

**Mitigation**:
- **Centralize extension management**: Create a `useCodeMirrorExtensions()` hook that returns a stable `Extension[]` based on current store state. Use `useMemo` with precise dependency arrays.
- **Compartment pattern**: Use `EditorView.theme` compartment for theme switching (not full re-creation). Use `LanguageSupport` compartment for language switching in project mode.
- **Extension testing**: Write unit tests for the extension builder function to verify correct output for all combinations.
- **Fallback**: If Emmet proves too problematic, disable it by default and make it an opt-in preference.

### Risk 3: IndexedDB Persistence Reliability

**Severity**: High  
**Likelihood**: Low-Medium

IndexedDB has edge cases that can cause data loss: storage quota limits, user clearing browser data, private browsing mode (where IDB may be ephemeral or unavailable), and Safari's 7-day eviction for non-PWA sites.

**Mitigation**:
- **Dual persistence**: Use IndexedDB as primary, but also write to `localStorage` as a synchronous fallback for small data (single-file mode). Check IDB availability on app startup.
- **Storage quota monitoring**: Before writes, check `navigator.storage.estimate()` and warn users if approaching limits.
- **Export before clear**: Add a "Download Backup" button that exports all data as a JSON file.
- **Graceful degradation**: If IDB is unavailable (private browsing on some browsers), fall back to in-memory + `localStorage` with a warning banner.
- **Safari 7-day eviction**: Register a Service Worker to qualify as a PWA, which prevents Safari from evicting IDB data. This is a lightweight addition.

### Risk 4: Cross-Browser Iframe Security Restrictions

**Severity**: Medium  
**Likelihood**: Medium

The iframe preview must execute user-written JavaScript while also capturing console output and errors. Cross-origin restrictions between the parent page and the srcdoc iframe can interfere with `postMessage` communication and DOM inspection.

**Mitigation**:
- **srcdoc iframes are same-origin**: Iframes with `srcdoc` attribute are treated as same-origin with their parent, so `postMessage` and `contentDocument` access work without restrictions.
- **Sandbox attribute caution**: If using `sandbox` for security, must include `allow-scripts allow-same-origin` — but note that `allow-same-origin` with `allow-scripts` together negate most security benefits of sandbox. For LiveFrame, this is acceptable since the user is running their own code.
- **Console capture script**: Inject a `<script>` block at the start of the srcdoc that overrides `console.log/warn/error/info` before any user code runs. Use `try/catch` around the entire user script for error capture.
- **Error parsing**: Use `window.onerror` and `window.addEventListener('unhandledrejection')` inside the iframe to catch runtime errors and forward them to the parent.

### Risk 5: Bundle Size and Initial Load Performance

**Severity**: Medium  
**Likelihood**: Medium-High

CodeMirror 6 with all language modes (HTML, CSS, JS, JSON, TypeScript), Emmet, autocomplete, and the React wrapper can easily exceed 500KB+ gzipped. Combined with React, Zustand, shadcn/ui components, and Tailwind CSS, the initial bundle could be too large for a snappy loading experience, especially on GitHub Pages (no CDN caching beyond GitHub's default).

**Mitigation**:
- **Code splitting with dynamic imports**: Lazy-load the project editor (`/project/:id`) and the template gallery.
- **Manual chunks in Rollup**: Separate CodeMirror into its own chunk (already configured in vite.config.ts above) so it can be cached independently.
- **Tree-shake language modes**: Only import the specific `@codemirror/lang-*` packages needed. In single-file mode, only load HTML/CSS/JS. Load TypeScript and JSON modes only when entering project mode.
- **Prefetching**: Use `<link rel="prefetch">` for likely-next routes (e.g., prefetch project editor when user hovers the mode toggle).
- **Bundle analysis**: Add `rollup-plugin-visualizer` as a dev dependency and run it in CI to track bundle size changes.
- **Target `esnext`**: Since LiveFrame is a modern browser tool (developers use Chrome/Firefox latest), set `build.target: 'esnext'` to avoid transpilation bloat.

---

## 8. Recommended Folder Structure

```
liveframe/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI pipeline (lint, test, build)
│       └── deploy.yml                # Deploy to GitHub Pages
│
├── e2e/                              # Playwright E2E tests
│   ├── fixtures/
│   │   └── test-utils.ts             # E2E test helpers
│   ├── single-file.spec.ts           # Single-file editor E2E
│   ├── project-mode.spec.ts          # Project editor E2E
│   └── preview.spec.ts              # Preview & console E2E
│
├── public/
│   └── favicon.svg                   # App icon
│
├── src/
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── ...
│   │   │
│   │   ├── editor/                   # Editor-related components
│   │   │   ├── CodeMirrorEditor.tsx  # Core CM6 wrapper
│   │   │   ├── EditorTabBar.tsx      # Tabs for HTML/CSS/JS (single-file)
│   │   │   ├── EditorStatusBar.tsx   # Cursor position, language, encoding
│   │   │   └── useCodeMirrorSetup.ts # Hook: extensions, theme, keymap
│   │   │
│   │   ├── preview/                  # Preview-related components
│   │   │   ├── PreviewPane.tsx       # Container for iframe + overlays
│   │   │   ├── IframePreview.tsx     # The actual <iframe> element
│   │   │   ├── ConsoleOverlay.tsx    # Console output panel
│   │   │   ├── ErrorOverlay.tsx      # Error display overlay
│   │   │   ├── DeviceFrame.tsx       # Device bezel wrapper
│   │   │   └── usePreviewSrcdoc.ts   # Hook: assemble srcdoc from stores
│   │   │
│   │   ├── project/                  # Project mode components
│   │   │   ├── FileTree.tsx          # Recursive file tree
│   │   │   ├── FileTreeItem.tsx      # Individual file/folder node
│   │   │   ├── ResourcePanel.tsx     # External CSS/JS management
│   │   │   └── ProjectTabBar.tsx     # Open file tabs
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── Layout.tsx            # Main app layout
│   │   │   ├── TopBar.tsx            # Header toolbar
│   │   │   ├── ModeToggle.tsx        # Single-file / Project switch
│   │   │   ├── ThemeToggle.tsx       # Dark / Light / System
│   │   │   ├── AutoRefreshToggle.tsx # Auto-refresh switch
│   │   │   └── SplitPane.tsx         # Resizable split layout
│   │   │
│   │   └── shared/                   # Shared/reusable components
│   │       ├── SettingsDialog.tsx    # Global settings modal
│   │       ├── TemplateGallery.tsx   # Starter template browser
│   │       ├── ExportButton.tsx      # ZIP export trigger
│   │       └── KeyboardShortcuts.tsx # Global shortcut handler
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useDebouncedCallback.ts   # Generic debounce hook
│   │   ├── useDebouncedSrcdoc.ts     # Debounced preview builder
│   │   ├── useEditorTheme.ts         # CM6 theme from uiStore
│   │   ├── useConsoleCapture.ts      # Setup iframe message listener
│   │   ├── useAutoSave.ts            # Debounced IDB persistence
│   │   └── useMediaQuery.ts          # Responsive breakpoint hook
│   │
│   ├── lib/                          # Utility modules (no React deps)
│   │   ├── idb.ts                    # IndexedDB adapter for Zustand persist
│   │   ├── srcdoc-builder.ts         # Assemble HTML document from parts
│   │   ├── console-inject.ts         # Script to inject into iframe for console capture
│   │   ├── zip-export.ts             # JSZip + file-saver export logic
│   │   ├── templates.ts              # Starter template definitions
│   │   ├── language-utils.ts         # getLanguageFromPath, getFileIcon, etc.
│   │   ├── path-utils.ts             # normalizePath, joinPath, dirname, etc.
│   │   └── cn.ts                     # clsx + tailwind-merge utility
│   │
│   ├── pages/                        # Route-level page components
│   │   ├── SingleFileEditor.tsx      # Route: /
│   │   ├── ProjectList.tsx           # Route: /project
│   │   └── ProjectEditor.tsx         # Route: /project/:projectId
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── editorStore.ts            # Single-file mode state
│   │   ├── projectStore.ts           # Project mode state
│   │   └── uiStore.ts               # UI preferences & runtime data
│   │
│   ├── styles/                       # Global styles
│   │   └── globals.css               # Tailwind directives + CSS variables
│   │
│   ├── test/                         # Test infrastructure
│   │   ├── setup.ts                  # Vitest setup (jest-dom, mocks)
│   │   ├── test-utils.tsx            # RTL render helpers with providers
│   │   └── __mocks__/                # Module mocks
│   │       └── @uiw/
│   │           └── react-codemirror.tsx
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── editor.ts                 # Editor-related types
│   │   ├── project.ts                # Project, ProjectFile, etc.
│   │   ├── template.ts               # Template types
│   │   └── console.ts                # ConsoleEntry, ErrorEntry types
│   │
│   ├── App.tsx                       # Root component (RouterProvider + ThemeProvider)
│   ├── router.tsx                    # React Router configuration
│   └── main.tsx                      # Entry point (render <App>)
│
├── .eslintrc.cjs                     # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── components.json                   # shadcn/ui configuration
├── index.html                        # Vite HTML entry
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

### Key Design Decisions in the Folder Structure

1. **`components/` is organized by domain** (`editor/`, `preview/`, `project/`, `layout/`, `shared/`), not by type. This keeps related components co-located and makes it easy to find everything about a feature in one place.

2. **`ui/` is reserved for shadcn/ui auto-generated components**. These should never be manually edited — they are managed by the `shadcn` CLI. Custom components go in domain folders.

3. **`lib/` contains pure utility functions** with no React dependencies. This makes them trivially testable and reusable. React hooks go in `hooks/`, not `lib/`.

4. **`stores/` is flat** — one file per store. Zustand's slice pattern means each store is self-contained. If a store grows too large, split it into `stores/editor/` with an `index.ts` barrel.

5. **`types/` are shared type definitions** used across stores, components, and utilities. They prevent circular imports that would occur if types were defined inside stores or components.

6. **`e2e/` is at the root level** alongside `src/`, not inside `src/test/`. Playwright tests run against the built/deployed app and should not be mixed with unit/component tests.

7. **Test files are co-located with source files** by convention (e.g., `src/stores/editorStore.test.ts`). The `src/test/` directory only contains setup and utility code for the test framework itself.

---

## Appendix A: Key Configuration Files

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@uiw/react-codemirror',
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/lang-html',
            '@codemirror/lang-css',
            '@codemirror/lang-javascript',
          ],
          vendor: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
});
```

### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

### `components.json` (shadcn/ui)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "hooks": "@/hooks"
  }
}
```

---

## Appendix B: Iframe Console Capture Implementation Sketch

```typescript
// src/lib/console-inject.ts
// This script is injected into the iframe's srcdoc before user code

export const CONSOLE_CAPTURE_SCRIPT = `
(function() {
  const _origConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
  };

  function serialize(args) {
    return Array.from(args).map(arg => {
      try {
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      } catch (e) {
        return String(arg);
      }
    });
  }

  function send(type, args) {
    window.parent.postMessage({
      type: 'liveframe:console',
      payload: { type, args: serialize(args), timestamp: Date.now() }
    }, '*');
  }

  console.log = function() { send('log', arguments); _origConsole.apply(null, arguments); };
  console.warn = function() { send('warn', arguments); _origConsole.apply(null, arguments); };
  console.error = function() { send('error', arguments); _origConsole.apply(null, arguments); };
  console.info = function() { send('info', arguments); _origConsole.apply(null, arguments); };

  window.onerror = function(msg, source, line, col, error) {
    window.parent.postMessage({
      type: 'liveframe:error',
      payload: { message: String(msg), line, column: col }
    }, '*');
  };

  window.addEventListener('unhandledrejection', function(event) {
    window.parent.postMessage({
      type: 'liveframe:error',
      payload: { message: 'Unhandled Promise Rejection: ' + event.reason }
    }, '*');
  });
})();
`;
```

```typescript
// src/lib/srcdoc-builder.ts
import { CONSOLE_CAPTURE_SCRIPT } from './console-inject';

interface SrcdocOptions {
  html: string;
  css: string;
  javascript: string;
  externalCSS: string[];
  externalJS: string[];
}

export function buildSrcdoc(options: SrcdocOptions): string {
  const { html, css, javascript, externalCSS, externalJS } = options;

  const externalCSSLinks = externalCSS
    .map((url) => `<link rel="stylesheet" href="${escapeAttr(url)}">`)
    .join('\n');

  const externalJSScripts = externalJS
    .map((url) => `<script src="${escapeAttr(url)}"><\/script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${externalCSSLinks}
  <style>${css}</style>
</head>
<body>
  ${html}
  ${externalJSScripts}
  <script>${CONSOLE_CAPTURE_SCRIPT}<\/script>
  <script>${javascript}<\/script>
</body>
</html>`;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

---

*End of LiveFrame General Architecture Report v1.0*
