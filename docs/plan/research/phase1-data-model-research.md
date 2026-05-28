# Phase 1.1 Data Model & Stores — Research Report

**Date:** 2025-03-04  
**Scope:** Project Mode Data Model, VFS, Store Architecture, Type Safety, Preview Builder Updates  
**Current Codebase State:** Zustand v5.0.14, React 19, TypeScript ~5.8

---

## Table of Contents

1. [ID Generation: NanoID vs crypto.randomUUID vs Custom](#1-id-generation-nanoid-vs-cryptorandomuuid-vs-custom)
2. [Zustand Store Composition Patterns](#2-zustand-store-composition-patterns)
3. [VirtualFileSystem: Class vs Plain Functions](#3-virtualfilesystem-class-vs-plain-functions)
4. [Single-File → Project Mode Migration](#4-single-file--project-mode-migration)
5. [Branded/Opaque Types for ProjectId & FileId](#5-brandedopaque-types-for-projectid--fileid)
6. [Preview Builder Updates for Per-File Model](#6-preview-builder-updates-for-per-file-model)

---

## 1. ID Generation: NanoID vs crypto.randomUUID vs Custom

### Comparison Matrix

| Criterion | `crypto.randomUUID()` | `nanoid` (npm) | Custom (crypto.getRandomValues) |
|---|---|---|---|
| **Bundle size** | 0 B (native) | ~130 B (non-secure) / ~2.2 KB (full) | ~150 B (inline) |
| **ID length** | 36 chars (UUID v4) | 21 chars (default) / configurable | Configurable |
| **Uniqueness** | 122-bit entropy (RFC 4122) | 126-bit (default 21 chars) | Depends on config |
| **Collision probability** | ~10⁻¹⁸ at 10⁹ IDs | ~1% at 149 yr @ 1000 IDs/hr | Configurable |
| **Browser support** | All modern (Chrome 92+, Firefox 95+, Safari 15.4+) | All | All |
| **Performance** (100K IDs) | **~26 ms** ✅ fastest | ~35 ms (non-secure) | ~200 ms |
| **Format** | `fcca0542-4f6b-4606-81b8-7f3768cb8c5f` | `V1StGXR8_Z5jdHi6B-myT` | Custom |
| **URL-safe** | Yes (with hyphens) | Yes (by design) | Depends |
| **Dependency** | None | External package | None |
| **Secure** | Yes (CSPRNG) | Yes (crypto.getRandomValues) | Yes (if using crypto) |

### Performance Benchmark Results

```
crypto.randomUUID: 100,000 IDs in 26.05ms   ← Fastest (native C++ impl)
customId (21 chars): 100,000 IDs in 198.92ms
nanoidStyle (12 chars): 100,000 IDs in 213.29ms
```

### Recommendation: **Template-literal prefixed `crypto.randomUUID()`**

```typescript
// Recommended pattern — zero dependencies, fast, branded at runtime
function createProjectId(): ProjectId {
  return `proj_${crypto.randomUUID()}` as ProjectId;
}

function createFileId(): FileId {
  return `file_${crypto.randomUUID()}` as FileId;
}
```

**Rationale:**
- Zero bundle cost — `crypto.randomUUID()` is a Web Crypto API standard
- Native implementation is 7-8x faster than JS-based alternatives
- Runtime prefix (`proj_`, `file_`) provides debuggability — you can identify ID type in logs, network requests, and localStorage
- The prefix pairs with TypeScript template literal types for compile-time safety (see §5)
- For LiveFrame's scale (dozens of projects, hundreds of files), collision probability is effectively zero
- **Avoid NanoID**: adds an external dependency for zero meaningful benefit in this context
- The only consideration: `crypto.randomUUID()` is not available in insecure contexts (HTTP without TLS). Since LiveFrame is a dev tool that will run on `localhost` (which browsers treat as a secure context), this is a non-issue

### Fallback Strategy

```typescript
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for edge cases (shouldn't occur in LiveFrame's target env)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 2);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

---

## 2. Zustand Store Composition Patterns

### Current Architecture

The existing codebase has three independent Zustand stores with no cross-references:
- `editorStore` — `html`, `css`, `javascript`, `activeTab`
- `uiStore` — `theme`, `autoRefresh`, `consoleEntries`, `errorOverlay`
- `layoutStore` — `isConsoleOpen`, `mode`, `isFileTreeOpen`

### Challenge

The new `projectStore` needs to coordinate with `editorStore` (e.g., when a file is selected in the project tree, editorStore's active file must change). This creates a potential for circular dependencies.

### Pattern Analysis

#### Pattern A: Direct Store Access (Recommended ✅)

Zustand v5 exports `createStore` which creates a standalone store accessible outside React. Every `create()` store also exposes `.getState()`, `.setState()`, and `.subscribe()` without needing React hooks.

```typescript
// projectStore.ts
import { useEditorStore } from './editorStore';

interface ProjectState {
  projects: Record<ProjectId, Project>;
  activeProjectId: ProjectId | null;
  openFile: (fileId: FileId) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: {},
  activeProjectId: null,
  
  openFile: (fileId: FileId) => {
    const project = get().projects[get().activeProjectId!];
    const file = project.files[fileId];
    
    // Cross-store communication: directly call editorStore
    useEditorStore.getState().setActiveFileId(fileId);
    useEditorStore.getState().setFileContent(fileId, file.content);
  },
}));
```

**Advantages:**
- No circular dependencies if imports are one-directional (projectStore → editorStore, never reverse)
- Works outside React components (in utility functions, event handlers)
- Simple, explicit, no magic
- Zustand v5 guarantees `.getState()` always returns the latest snapshot

**Rule:** Establish a **dependency direction**: `projectStore → editorStore → uiStore`. Never import upward. `editorStore` never imports `projectStore`.

#### Pattern B: Subscribe/React Pattern

Use Zustand's `subscribeWithSelector` middleware to react to changes in another store:

```typescript
// In projectStore.ts setup
import { useEditorStore } from './editorStore';

// React to editor dirty state changes
useEditorStore.subscribe(
  (state) => state.dirtyFiles,
  (dirtyFiles) => {
    // Sync dirty state back to project metadata
    useProjectStore.getState().markFilesDirty(dirtyFiles);
  }
);
```

**When to use:** For background synchronization tasks (e.g., marking files as dirty when content changes, auto-save triggers). Not for user-initiated actions.

#### Pattern C: Event Bus / Middleware

```typescript
// Overkill for LiveFrame — only consider if the store graph becomes complex
const eventBus = create((set) => ({
  events: [],
  emit: (event) => set((s) => ({ events: [...s.events, event] })),
}));
```

**Not recommended** — adds indirection without proportional benefit for a 4-store application.

#### Pattern D: Combined Store with Slices

```typescript
// Single store with logical slices
interface AppState {
  editor: EditorSlice;
  project: ProjectSlice;
  ui: UISlice;
  layout: LayoutSlice;
}
```

**Not recommended** for LiveFrame — would require rewriting all existing stores and components. The current 3-store structure works well. Adding `projectStore` as a 4th store is the incremental approach.

### Recommended Architecture

```
┌──────────────┐     ┌──────────────┐
│ projectStore │────▶│ editorStore  │
│              │     │              │
│ - projects   │     │ - activeFile │
│ - activeProj │     │ - contents   │
│ - VFS ref    │     │ - dirtyFiles │
│              │     │ - cursors    │
└──────────────┘     └──────────────┘
       │                     │
       │              ┌──────▼──────┐
       │              │  uiStore    │
       │              │ - theme     │
       │              │ - console   │
       │              └─────────────┘
       │
┌──────▼──────┐
│ layoutStore │  (independent — no cross-store deps)
│ - mode      │
│ - console   │
│ - fileTree  │
└─────────────┘
```

**Dependency rules:**
- `projectStore` → `editorStore` (one-way)
- `editorStore` → `uiStore` (for error reporting — already implicit via `useAutoRefresh`)
- `layoutStore` → standalone (only reads `mode` to decide layout)
- **Never** reverse: editorStore does NOT import projectStore

### Store Communication Within React Components

For React components that need data from multiple stores, use the standard selector pattern:

```tsx
function FileTreeItem({ fileId }: { fileId: FileId }) {
  // Each store independently — no coupling at the component level
  const fileName = useProjectStore((s) => s.files[fileId].name);
  const isDirty = useEditorStore((s) => s.dirtyFiles.has(fileId));
  const isActive = useEditorStore((s) => s.activeFileId === fileId);
  
  // ...
}
```

---

## 3. VirtualFileSystem: Class vs Plain Functions

### Design Question

Should the VFS be:
1. A **class instance** stored outside Zustand (as a module-level singleton)
2. **Integrated into Zustand** as a `Map<string, FileEntry>` field
3. A **hybrid** — class instance for VFS logic, Zustand for reactive state

### Performance: Map vs Record

Benchmarks with 10,000 file entries:

| Operation | `Map<string, FileEntry>` | `Record<string, FileEntry>` |
|---|---|---|
| Insert 10K | 12.17 ms | **4.65 ms** ✅ |
| Lookup 10K | 1.17 ms | **1.25 ms** (comparable) |
| Delete 10K | **2.25 ms** ✅ | 2.72 ms |

**Key insight:** For LiveFrame's actual scale (typically <100 files per project, often <20), both `Map` and `Record` perform identically. The performance difference only emerges at 10K+ entries, which is far beyond LiveFrame's use case.

### Zustand + Map Integration Issue

Zustand uses shallow equality by default. `Map` mutations create reference inequality problems:

```typescript
// ❌ Problem: Map.set() mutates in place — Zustand won't detect the change
state.files.set(fileId, content);  // No re-render!

// ✅ Fix: Create a new Map each time (expensive for large maps)
set((state) => ({ files: new Map(state.files).set(fileId, content) }));
```

With `Record`, every update naturally creates a new object reference:

```typescript
// ✅ Works naturally with Zustand
set((state) => ({ 
  files: { ...state.files, [fileId]: content } 
}));
```

### Recommendation: **Hybrid Approach** ✅

```typescript
// vfs.ts — Pure logic, no React/Zustand dependency
export class VirtualFileSystem {
  private files: Map<string, FileEntry>;
  private pathIndex: Map<string, string>; // path → fileId

  constructor(entries?: FileEntry[]) {
    this.files = new Map();
    this.pathIndex = new Map();
    entries?.forEach((e) => this.addEntry(e));
  }

  // CRUD operations return new VFS instance (immutable pattern)
  addEntry(entry: FileEntry): VirtualFileSystem { /* ... */ }
  removeEntry(fileId: string): VirtualFileSystem { /* ... */ }
  getByPath(path: string): FileEntry | undefined { /* ... */ }
  getById(fileId: string): FileEntry | undefined { /* ... */ }
  getChildren(dirPath: string): FileEntry[] { /* ... */ }
  
  // Serialize to plain object for Zustand
  toJSON(): Record<string, FileEntry> { /* ... */ }
  
  // Deserialize from Zustand
  static fromJSON(data: Record<string, FileEntry>): VirtualFileSystem { /* ... */ }
}
```

```typescript
// projectStore.ts — Zustand stores serializable data
interface ProjectState {
  // VFS data as plain Record (Zustand-friendly)
  files: Record<FileId, FileEntry>;
  
  // VFS instance for complex queries (reconstructed via useMemo or selector)
  // NOT stored in Zustand state — derived
  
  // CRUD actions
  createFile: (projectId: ProjectId, entry: Omit<FileEntry, 'id'>) => void;
  deleteFile: (projectId: ProjectId, fileId: FileId) => void;
  renameFile: (projectId: ProjectId, fileId: FileId, newName: string) => void;
  moveFile: (projectId: ProjectId, fileId: FileId, newPath: string) => void;
}
```

**Why hybrid over pure class:**
1. **Zustand compatibility** — `Record<FileId, FileEntry>` works with selectors, devtools, and persist middleware
2. **Devtools** — Zustand devtools can serialize Records but not Map instances
3. **Persist middleware** — `createJSONStorage` works with Records out of the box
4. **VFS logic** — Complex queries (path traversal, directory listing, tree building) use the `VirtualFileSystem` class as a **derived utility**, reconstructed from the Record when needed
5. **Performance** — VFS class is only instantiated when tree rendering or path resolution is needed, not on every content keystroke

### VFS Path Index Strategy

```typescript
interface FileEntry {
  id: FileId;
  projectId: ProjectId;
  name: string;           // "App.tsx"
  path: string;           // "/src/components/App.tsx"
  parentPath: string;     // "/src/components/"
  type: 'file' | 'directory';
  language: Language;
  content: string;
  isVirtual: boolean;     // true for single-file mode's 3 built-in files
  createdAt: number;      // Date.now()
  updatedAt: number;
}
```

The `path` and `parentPath` fields enable O(1) directory listing without maintaining a separate tree structure:

```typescript
// Get all children of a directory
Object.values(files).filter(f => f.parentPath === dirPath);

// Find a file by path
Object.values(files).find(f => f.path === searchPath);
```

For projects with <200 files (LiveFrame's typical range), this is faster than maintaining a tree because:
- No tree rebalancing on file moves
- Simple `filter` over a flat array is cache-friendly
- No need for recursive traversal

---

## 4. Single-File → Project Mode Migration

### Current Flow

```
SingleFileMode: html + css + javascript strings → assembleDocument() → iframe srcDoc
```

### Proposed Virtual Project Pattern

When the app starts in single-file mode, a "virtual project" is created automatically:

```typescript
const SINGLE_FILE_VIRTUAL_PROJECT: Project = {
  id: createProjectId(),  // but see note on stable ID below
  name: 'Untitled',
  isVirtual: true,        // ← Key flag
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const SINGLE_FILE_VIRTUAL_FILES: FileEntry[] = [
  {
    id: VIRTUAL_HTML_FILE_ID,  // stable constant
    projectId: SINGLE_FILE_VIRTUAL_PROJECT.id,
    name: 'index.html',
    path: '/index.html',
    parentPath: '/',
    type: 'file',
    language: 'html',
    content: DEFAULT_HTML,
    isVirtual: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: VIRTUAL_CSS_FILE_ID,
    name: 'style.css',
    path: '/style.css',
    parentPath: '/',
    type: 'file',
    language: 'css',
    content: DEFAULT_CSS,
    isVirtual: true,
    // ...
  },
  {
    id: VIRTUAL_JS_FILE_ID,
    name: 'main.js',
    path: '/main.js',
    parentPath: '/',
    type: 'file',
    language: 'javascript',
    content: DEFAULT_JS,
    isVirtual: true,
    // ...
  },
];
```

### Migration: Virtual → Real Project

When the user switches from single-file to project mode:

```typescript
promoteVirtualProject(): void {
  const state = useProjectStore.getState();
  const virtualProject = state.projects[state.activeProjectId!];
  
  if (!virtualProject.isVirtual) return; // Already a real project
  
  set((state) => {
    // 1. Update project metadata
    const updatedProject = {
      ...virtualProject,
      isVirtual: false,
      name: 'My Project',  // Or prompt user
    };
    
    // 2. Mark all files as non-virtual
    const updatedFiles = { ...state.files };
    for (const fileId of Object.keys(updatedFiles)) {
      if (updatedFiles[fileId].projectId === virtualProject.id) {
        updatedFiles[fileId] = {
          ...updatedFiles[fileId],
          isVirtual: false,
        };
      }
    }
    
    return {
      projects: {
        ...state.projects,
        [virtualProject.id]: updatedProject,
      },
      files: updatedFiles,
    };
  });
  
  // 3. Update layout mode
  useLayoutStore.getState().setMode('project');
  useLayoutStore.getState().setIsFileTreeOpen(true);
}
```

### Stable Virtual IDs

Use **constant** IDs for the virtual project and its 3 files. This avoids migration headaches:

```typescript
// Stable IDs — never regenerated, always the same
export const VIRTUAL_PROJECT_ID = 'proj_virtual_default' as ProjectId;
export const VIRTUAL_HTML_FILE_ID = 'file_virtual_html' as FileId;
export const VIRTUAL_CSS_FILE_ID = 'file_virtual_css' as FileId;
export const VIRTUAL_JS_FILE_ID = 'file_virtual_javascript' as FileId;
```

**Why stable IDs matter:**
- No need to update references when promoting to real project
- Editor cursors, undo history, and dirty state stay bound to the same file IDs
- localStorage persistence works consistently
- Debugging is easier — you always know which files are the virtual ones

### Migration UX Flow

```
[Single-file mode]  →  user clicks "Convert to Project"
       │                          │
       │                    promoteVirtualProject()
       │                          │
       │                    ┌─────▼──────┐
       │                    │ isVirtual:  │
       │                    │   false     │
       │                    │ File tree   │
       │                    │ visible     │
       │                    │ Can add     │
       │                    │ new files   │
       │                    └────────────┘
       │
       ▼
 Content preserved because
 file IDs are stable
```

### Backward Compatibility with editorStore

During Phase 1.1, the `editorStore` needs to be enhanced to work with the new per-file model while still supporting existing components:

```typescript
// Enhanced editorStore.ts
interface EditorState {
  // New per-file model
  activeFileId: FileId | null;
  fileContents: Record<FileId, string>;
  dirtyFiles: Set<FileId>;
  cursorPositions: Record<FileId, { line: number; col: number }>;
  
  // Legacy compatibility — derived from fileContents
  // These exist temporarily so existing components don't break
  html: string;     // = fileContents[VIRTUAL_HTML_FILE_ID]
  css: string;      // = fileContents[VIRTUAL_CSS_FILE_ID]
  javascript: string; // = fileContents[VIRTUAL_JS_FILE_ID]
  activeTab: ActiveTab; // derived from activeFileId
  
  // Actions
  setActiveFileId: (fileId: FileId) => void;
  setFileContent: (fileId: FileId, content: string) => void;
  markDirty: (fileId: FileId) => void;
  markClean: (fileId: FileId) => void;
  setCursorPosition: (fileId: FileId, pos: { line: number; col: number }) => void;
  
  // Legacy setters (delegate to new model)
  setHtml: (html: string) => void;
  setCss: (css: string) => void;
  setJavascript: (js: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  resetAll: () => void;
}
```

**Migration strategy:** Legacy fields are computed properties that read/write through the new per-file model. Components can be migrated incrementally — old components use `html`/`css`/`javascript`, new components use `fileContents[activeFileId]`.

---

## 5. Branded/Opaque Types for ProjectId & FileId

### The Problem

```typescript
// Without branding — this compiles but is a bug:
function openProject(id: ProjectId) { /* ... */ }
function openFile(id: FileId) { /* ... */ }

const myFile: FileId = "file_abc123";
openProject(myFile);  // Should error, but doesn't — both are just `string`
```

### Approach Comparison

| Approach | Compile-time safety | Runtime value | Debuggability | Complexity |
|---|---|---|---|---|
| **A: Intersection brand** | ✅ Full | Raw UUID | Low (no prefix) | Medium |
| **B: Opaque helper** | ✅ Full | Raw UUID | Low | Medium |
| **C: Template literal prefix** | ✅ Full | Prefixed | **High** ✅ | **Low** ✅ |
| **D: Class wrapper** | ✅ Full | Object | Medium | High |

### Recommendation: **Pattern C — Template Literal Prefix** ✅

```typescript
// types/brands.ts

// === Brand types using template literals ===
// Compile-time: TypeScript enforces the prefix pattern
// Runtime: IDs are prefixed strings, easily identifiable in devtools/logs

export type ProjectId = `proj_${string}`;
export type FileId = `file_${string}`;

// === Factory functions (single source of truth for ID creation) ===

export function createProjectId(): ProjectId {
  return `proj_${crypto.randomUUID()}` as ProjectId;
}

export function createFileId(): FileId {
  return `file_${crypto.randomUUID()}` as FileId;
}

// === Type guards for runtime validation ===

export function isProjectId(id: string): id is ProjectId {
  return id.startsWith('proj_');
}

export function isFileId(id: string): id is FileId {
  return id.startsWith('file_');
}

// === Safe parsing from external sources (localStorage, URL params) ===

export function parseProjectId(raw: unknown): ProjectId | null {
  if (typeof raw === 'string' && raw.startsWith('proj_')) {
    return raw as ProjectId;
  }
  return null;
}

export function parseFileId(raw: unknown): FileId | null {
  if (typeof raw === 'string' && raw.startsWith('file_')) {
    return raw as FileId;
  }
  return null;
}
```

### Why This Pattern Wins for LiveFrame

1. **Compile-time safety:** `ProjectId` and `FileId` are different types — passing a `FileId` where `ProjectId` is expected is a TypeScript error
2. **Runtime prefix:** In console logs, React DevTools, and network requests, you can immediately see whether an ID is a project or file: `proj_fcca0542-...` vs `file_a1b2c3d4-...`
3. **Zero runtime cost:** The prefix is a string concatenation — negligible overhead
4. **Type guards:** `isProjectId()` / `isFileId()` work at runtime boundaries (localStorage, URL params, postMessage)
5. **Stable virtual IDs** fit naturally: `'proj_virtual_default'` matches `ProjectId`, `'file_virtual_html'` matches `FileId`
6. **No external dependencies:** Unlike `io-ts` or `zod` branded types

### What This Prevents

```typescript
// ❌ Error: Type '`file_${string}`' is not assignable to type '`proj_${string}`'
const fileId = createFileId();
openProject(fileId);

// ❌ Error: Type 'string' is not assignable to type '`proj_${string}`'
openProject("hello");

// ✅ Works
const projectId = createProjectId();
openProject(projectId);

// ✅ Stable IDs work
const virtualProjectId: ProjectId = 'proj_virtual_default';
```

### Limitation & Mitigation

The template literal brand doesn't prevent this specific unsafe pattern:

```typescript
const fake: ProjectId = "proj_totally_fake" as ProjectId;  // Compiles!
```

**Mitigation:** This is only possible with explicit `as` casts. The factory functions (`createProjectId`, `createFileId`) and the `parse*` functions are the only approved ways to create these IDs. Lint rules or code review can catch stray `as` casts. For a team project, consider adding an ESLint rule for `no-unsafe-brand-cast`.

---

## 6. Preview Builder Updates for Per-File Model

### Current Architecture

```
editorStore.html/css/javascript → useAutoRefresh hook → assembleDocument() → iframe srcDoc
```

The `useAutoRefresh` hook directly subscribes to `editorStore.html`, `editorStore.css`, and `editorStore.javascript`. The `assembleDocument()` function takes three flat strings.

### Problem

With the per-file model, content is stored as `fileContents: Record<FileId, string>`. The preview builder needs to:
1. Know which files exist (to resolve `<script src="./utils.js">` references)
2. Get the content of each file
3. Assemble a document that may include multiple CSS/JS files
4. Handle the single-file mode's 3 virtual files as before (backward compatibility)

### Proposed Solution: Project-Aware Assembler

```typescript
// utils/previewBuilder.ts — Enhanced

interface PreviewInput {
  /** All files in the active project */
  files: Record<FileId, FileEntry>;
  /** The project's entry point HTML file */
  entryFileId: FileId;
  /** Whether this is a single-file (virtual) project */
  isVirtual: boolean;
}

/**
 * Assembles a complete HTML document from project files.
 * 
 * For virtual/single-file projects: behaves exactly like the current
 * assembleDocument(html, css, javascript) — inline everything.
 * 
 * For real projects: resolves file references, inlines all CSS/JS,
 * and handles relative imports.
 */
export function assembleProjectDocument(input: PreviewInput): string {
  const { files, entryFileId, isVirtual } = input;
  
  const entryFile = files[entryFileId];
  if (!entryFile) return errorDocument('Entry file not found');
  
  if (isVirtual) {
    // Fast path: single-file mode — same as current behavior
    return assembleSingleFileProject(files);
  }
  
  // Project mode: collect all CSS and JS files, inline them
  const allFiles = Object.values(files);
  const cssFiles = allFiles
    .filter(f => f.language === 'css' && f.type === 'file')
    .sort((a, b) => a.path.localeCompare(b.path));
  
  const jsFiles = allFiles
    .filter(f => f.language === 'javascript' && f.type === 'file')
    .sort((a, b) => a.path.localeCompare(b.path));
  
  const htmlContent = entryFile.content;
  const cssContent = cssFiles.map(f => `/* ${f.path} */\n${f.content}`).join('\n\n');
  const jsContent = jsFiles.map(f => `// ${f.path}\n${f.content}`).join('\n\n');
  
  return assembleDocument(htmlContent, cssContent, jsContent);
}

/** Backward-compatible single-file assembly (current behavior) */
function assembleSingleFileProject(files: Record<FileId, FileEntry>): string {
  const html = files[VIRTUAL_HTML_FILE_ID]?.content ?? '';
  const css = files[VIRTUAL_CSS_FILE_ID]?.content ?? '';
  const js = files[VIRTUAL_JS_FILE_ID]?.content ?? '';
  return assembleDocument(html, css, js);
}

/** Current function — unchanged, used internally */
export function assembleDocument(html: string, css: string, javascript: string): string {
  // ... existing implementation unchanged
}
```

### Updated useAutoRefresh Hook

```typescript
// hooks/useAutoRefresh.ts — Enhanced

import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useLayoutStore } from '../stores/layoutStore';
import { assembleProjectDocument } from '../utils/previewBuilder';
import { VIRTUAL_HTML_FILE_ID } from '../types/brands';

export function useAutoRefresh(manualTrigger: number) {
  const fileContents = useEditorStore((state) => state.fileContents);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const projects = useProjectStore((state) => state.projects);
  const files = useProjectStore((state) => state.files);
  const mode = useLayoutStore((state) => state.mode);
  const autoRefresh = useUIStore((state) => state.autoRefresh);
  const setErrorOverlay = useUIStore((state) => state.setErrorOverlay);

  const [srcDoc, setSrcDoc] = useState('');

  // Create a stable input object for the assembler
  const previewInput = useMemo(() => {
    if (!activeProjectId || !projects[activeProjectId]) return null;
    const project = projects[activeProjectId];
    
    // Merge project file entries with latest editor content
    const enrichedFiles: Record<FileId, FileEntry> = {};
    for (const [fileId, entry] of Object.entries(files)) {
      if (entry.projectId === activeProjectId) {
        enrichedFiles[fileId as FileId] = {
          ...entry,
          content: fileContents[fileId as FileId] ?? entry.content,
        };
      }
    }
    
    return {
      files: enrichedFiles,
      entryFileId: VIRTUAL_HTML_FILE_ID, // or project.entryPointId
      isVirtual: project.isVirtual,
    };
  }, [activeProjectId, projects, files, fileContents]);

  // Auto-refresh with debounce (same pattern as current)
  useEffect(() => {
    if (!autoRefresh || !previewInput) return;
    const timeout = setTimeout(() => {
      setErrorOverlay(null);
      setSrcDoc(assembleProjectDocument(previewInput));
    }, 400);
    return () => clearTimeout(timeout);
  }, [previewInput, autoRefresh, setErrorOverlay]);

  // Manual refresh
  useEffect(() => {
    if (manualTrigger > 0 && previewInput) {
      setErrorOverlay(null);
      setSrcDoc(assembleProjectDocument(previewInput));
    }
  }, [manualTrigger, previewInput, setErrorOverlay]);

  return srcDoc;
}
```

### Key Design Decisions for Preview Builder

1. **Inline everything** — No `<link href>` or `<script src>` in the assembled document. All CSS and JS is inlined into the single HTML document. This avoids the need for a dev server or blob URL management.

2. **CSS/JS ordering** — Sort by path alphabetically. This gives deterministic, predictable output. Users can control order via naming (e.g., `01-base.css`, `02-components.css`).

3. **Entry point** — For virtual projects, always use `index.html`. For real projects, default to `index.html` but allow configuration via `project.entryPointId`.

4. **Backward compatibility** — `assembleDocument()` remains unchanged and is called internally by `assembleProjectDocument()`. The `useAutoRefresh` hook is the only consumer that changes.

5. **Future: Multi-file imports** — For Phase 2+, when the user writes `<script src="./utils.js">` in their HTML, the assembler should resolve this to the corresponding `FileEntry` content and inline it. This requires parsing the HTML for import references, which is out of scope for Phase 1.1.

### Selector Optimization

To prevent unnecessary re-renders when unrelated files change:

```typescript
// Custom selector that only returns a hash of relevant file contents
const previewContentsHash = useEditorStore(
  useShallow((state) => {
    // Only hash files that affect the preview
    const activeProject = useProjectStore.getState().activeProjectId;
    if (!activeProject) return '';
    const projectFiles = useProjectStore.getState().files;
    return Object.entries(state.fileContents)
      .filter(([id]) => projectFiles[id as FileId]?.projectId === activeProject)
      .map(([id, content]) => `${id}:${content.length}`)
      .join('|');
  })
);
```

This ensures the preview only re-assembles when a file in the active project actually changes content, not when the cursor moves or a different project's files change.

---

## Summary of Recommendations

| Topic | Decision | Key Rationale |
|---|---|---|
| **ID Generation** | Prefixed `crypto.randomUUID()` | Zero deps, fastest, debug-friendly prefix |
| **Store Composition** | One-way dependency: projectStore → editorStore | No circular deps, uses `.getState()` for cross-store calls |
| **VFS Architecture** | Hybrid: Record in Zustand + VFS class as utility | Zustand compatibility + devtools + persist + Map for queries |
| **Mode Migration** | Stable virtual IDs + `isVirtual` flag promotion | No ID rewrites needed, content preserved transparently |
| **Branded Types** | Template literal prefix (`proj_`, `file_`) | Compile-time safety + runtime debuggability + zero deps |
| **Preview Builder** | Project-aware assembler with inline strategy | Backward-compatible, no dev server needed, deterministic |

### Implementation Order

1. **types/brands.ts** — ProjectId, FileId, factory functions, type guards
2. **types/project.ts** — FileEntry, Project, Language, etc.
3. **stores/projectStore.ts** — Project CRUD, file CRUD, virtual project initialization
4. **vfs.ts** — VirtualFileSystem class with path queries
5. **stores/editorStore.ts** — Enhance with per-file model, keep legacy compat
6. **utils/previewBuilder.ts** — Add `assembleProjectDocument()`
7. **hooks/useAutoRefresh.ts** — Update to use project-aware assembler
8. **Migrate components** — Incrementally replace `html`/`css`/`javascript` with per-file API
