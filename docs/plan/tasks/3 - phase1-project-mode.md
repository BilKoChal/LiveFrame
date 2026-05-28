# Task Plan — Phase 1: Project Mode (1.1–1.4)

> **Task ID**: 3
> **Date**: 2026-05-29
> **Scope**: Phase 1.1 (Data Model & Stores), 1.2 (File Tree UI), 1.3 (File Tabs), 1.4 (IndexedDB Persistence)

---

## Objective

Implement the core project mode features that transform LiveFrame from a single-file CodePen clone into a multi-file IDE-like editor. This includes the data model, file tree, file tabs, and IndexedDB persistence.

---

## Sub-Tasks

### 3.1 — Data Model & Stores (Phase 1.1)

- [x] Create `src/types/project.ts` with all type definitions (ProjectId, FileId, FileEntry, Project, etc.)
- [x] Implement branded types with prefixed template literals (`proj_`, `file_`)
- [x] Create `src/utils/vfs.ts` — VirtualFileSystem class with tree building and path utilities
- [x] Create `src/stores/projectStore.ts` with full CRUD actions
- [x] Enhance `src/stores/editorStore.ts` with per-file content, dirty state, tab management
- [x] Implement single-file mode as virtual project with stable IDs
- [x] Update `src/types.ts` to re-export project types

### 3.2 — File Tree UI (Phase 1.2)

- [x] Create `src/components/project/FileTree.tsx` with virtualized rendering (@tanstack/react-virtual)
- [x] Implement expand/collapse with expandedDirs state
- [x] Add file icons based on file type (lucide-react)
- [x] Add context menu (new file, new folder, rename, delete)
- [x] Add inline rename with double-click
- [x] Add new file/folder creation with inline input

### 3.3 — File Tabs (Phase 1.3)

- [x] Create `src/components/project/ProjectFileTabs.tsx` with sortable tabs (@dnd-kit/sortable)
- [x] Implement drag-and-drop tab reordering
- [x] Add close button, dirty indicator on tabs
- [x] Implement middle-click to close
- [x] Add auto-scroll to active tab

### 3.4 — IndexedDB Persistence (Phase 1.4)

- [x] Create `src/utils/idb.ts` with database schema, initialization, CRUD operations
- [x] Implement auto-save with two-tier debounce (structural: immediate, content: 3s)
- [x] Implement project hydration on startup
- [x] Add visibility change and beforeunload handlers
- [x] Create `src/components/project/ProjectList.tsx` for project list page
- [x] Integrate hydration into App.tsx

### 3.5 — Integration & Layout Updates

- [x] Create `src/components/project/ProjectLayout.tsx` — project mode layout with file tree
- [x] Update `src/components/layout/AppLayout.tsx` to support mode switching
- [x] Update `src/components/editor/CodeMirrorEditor.tsx` for project mode
- [x] Create `src/utils/projectPreviewBuilder.ts` for multi-file preview assembly
- [x] Update `src/hooks/useAutoRefresh.ts` for both modes
- [x] Update `src/components/toolbar/Toolbar.tsx` with mode switcher and file tree toggle

---

## Dependencies Installed

```
idb@^8.0.0
@dnd-kit/core@^6.0.0
@dnd-kit/sortable@^9.0.0
@dnd-kit/utilities@^3.0.0
@tanstack/react-virtual@^3.0.0
nanoid@^5.0.0
@codemirror/lang-json@^6.0.0
```

---

## New Files Created

```
src/types/project.ts                          — Type definitions for project mode
src/utils/vfs.ts                              — VirtualFileSystem utility class
src/utils/idb.ts                              — IndexedDB persistence layer
src/utils/projectPreviewBuilder.ts            — Multi-file preview assembler
src/stores/projectStore.ts                    — Project/file CRUD store
src/components/project/FileTree.tsx           — Virtualized file tree component
src/components/project/ProjectFileTabs.tsx    — Sortable file tabs component
src/components/project/ProjectLayout.tsx      — Project mode layout
src/components/project/ProjectList.tsx        — Project list page
```

---

## Modified Files

```
src/stores/editorStore.ts                     — Enhanced with per-file content & tab management
src/types.ts                                  — Re-exports project types
src/components/layout/AppLayout.tsx            — Mode switching support
src/components/editor/CodeMirrorEditor.tsx     — Project mode support
src/components/toolbar/Toolbar.tsx             — Mode switcher + file tree toggle
src/hooks/useAutoRefresh.ts                   — Dual mode support
src/utils/previewBuilder.ts                   — Export CONSOLE_HOOK
src/App.tsx                                   — IDB hydration + auto-save setup
```
