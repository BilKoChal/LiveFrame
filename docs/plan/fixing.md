# Fixing Plan — LiveFrame Runtime Bugs & Code Quality Issues

> **Created**: 2026-05-29  
> **Status**: Phase 1 & 2 & 3 Implemented  
> **Scope**: Project mode not working, panel sliders stuck, IDB persistence broken, hardcoded values, duplicate code, and code quality issues  
> **Based on**: Full codebase analysis of all 30+ source files

---

## Bug Reports by Severity

### 🔴 CRITICAL — App-Breaking Bugs

---

#### BUG 1 — All `onResize` callbacks call `setTopPanelSize` (copy-paste error)

**Files**: `src/components/project/ProjectLayout.tsx` lines 83, 98, 127, 147  
**Also**: `src/components/layout/AppLayout.tsx` line 108

**Current (buggy) code** — `ProjectLayout.tsx`:
```tsx
// File Tree panel (line 83)
onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}  // ❌

// Editor panel (line 98)
onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}  // ❌

// Preview panel (line 127)
onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}  // ❌

// Console panel (line 147)
onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}  // ❌
```

**AppLayout.tsx** (line 108):
```tsx
// Console panel
onResize={(panelSize) => setTopPanelSize(panelSize.asPercentage)}  // ❌
```

**Impact**: Every panel resize overwrites `topPanelSize` instead of the correct per-panel setter. After remount (e.g., mode switch, route change), all panels revert to wrong defaults because `fileTreeSize`, `editorSize`, `previewSize`, `consoleSize` were never updated — only `topPanelSize` was overwritten repeatedly.

This is the **root cause** of "console slider and project tree slider stop and can't expand freely" — when the component remounts after a mode switch or route change, the stored sizes for individual panels are still the initial defaults (18, 41, 41, 25), but `topPanelSize` has been overwritten to whatever the last resized panel's size was, causing the top panel's `defaultSize` to be wrong.

**Fix**: Replace each `onResize` with the correct setter:
```tsx
// File Tree panel
onResize={(panelSize) => setFileTreeSize(panelSize.asPercentage)}

// Editor panel
onResize={(panelSize) => setEditorSize(panelSize.asPercentage)}

// Preview panel
onResize={(panelSize) => setPreviewSize(panelSize.asPercentage)}

// Console panel
onResize={(panelSize) => setConsoleSize(panelSize.asPercentage)}
```

Same fix in `AppLayout.tsx` for the console panel.

---

#### BUG 2 — `isIDBAvailable()` always returns `false`, disabling ALL persistence

**File**: `src/utils/idb.ts` lines 105-111

**Current (buggy) code**:
```tsx
const testDB = await openDB('__liveframe_test__', 1, {
  upgrade(db) {
    db.createObjectStore('test');
  },
});
await testDB.deleteObjectStore('test');  // ❌ THROWS InvalidStateError
dbInstance = null;
idbAvailable = true;
```

**Impact**: `deleteObjectStore()` can only be called inside an `onupgradeneeded` handler (i.e., during the `upgrade()` callback). Calling it after the database is open throws `InvalidStateError`. The `catch` block sets `idbAvailable = false`, so **all IDB operations are permanently disabled** — no projects, files, or settings are ever persisted. Every page refresh loses all work.

This also explains the runtime `Symbol.iterator` error from the previous session: when IDB hydration returns empty data (because it's disabled), and the store defaults are used, certain selectors may return `undefined` during the async hydration race condition.

**Fix**:
```tsx
const testDB = await openDB('__liveframe_test__', 1, {
  upgrade(db) {
    db.createObjectStore('test');
  },
});
testDB.close();
await deleteDB('__liveframe_test__');
dbInstance = null;  // Don't cache test DB connection
idbAvailable = true;
```

Import `deleteDB` from the `idb` package (it's already exported).

---

### 🟠 HIGH — Feature-Breaking Bugs

---

#### BUG 3 — Route handlers fight with user-initiated mode switches

**File**: `src/App.tsx` lines 59-68

**Current (buggy) code**:
```tsx
function SingleFileRouteHandler() {
  const setMode = useLayoutStore((s) => s.setMode);
  const activeProject = useProjectStore((s) => s.activeProject);

  useEffect(() => {
    setMode('single-file');  // ❌ Re-runs on every activeProject change
    if (!activeProject) {
      const projectStore = useProjectStore.getState();
      if (projectStore.projects['proj_virtual_default']) {
        projectStore.setActiveProject('proj_virtual_default');
      }
    }
  }, [setMode, activeProject]);  // ❌ activeProject causes re-run
```

**Impact**: When the user clicks the "Project" mode switch button while at `/`:
1. `switchToProjectMode()` creates a new `activeProject` object (mode: 'project')
2. This triggers the `useEffect` because `activeProject` changed
3. The effect calls `setMode('single-file')`, immediately reverting the mode switch
4. **Result: Project mode never activates on the root route.**

This is the root cause of "project mode not working or not showing anything."

**Fix**: Only set mode on initial mount, not on every `activeProject` change:
```tsx
function SingleFileRouteHandler() {
  const setMode = useLayoutStore((s) => s.setMode);
  const activeProject = useProjectStore((s) => s.activeProject);

  useEffect(() => {
    setMode('single-file');
    // Ensure virtual project is active for single-file mode
    if (!activeProject) {
      const projectStore = useProjectStore.getState();
      if (projectStore.projects['proj_virtual_default']) {
        projectStore.setActiveProject('proj_virtual_default');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Only run once on mount
```

Additionally, the mode-switch button should navigate to `/project/:id` when switching to project mode, so the correct route handler is active.

---

#### BUG 4 — `getActiveFileType()` returns `'html'` for all non-virtual project files

**File**: `src/stores/editorStore.ts` line 340

**Current (buggy) code**:
```tsx
getActiveFileType: () => {
  const state = get();
  if (state.activeFileId) {
    if (state.activeFileId === VIRTUAL_HTML_FILE_ID) return 'html';
    if (state.activeFileId === VIRTUAL_CSS_FILE_ID) return 'css';
    if (state.activeFileId === VIRTUAL_JS_FILE_ID) return 'javascript';
    // For project mode, derive from file extension in project store
    return 'html'; // default  ❌ Always returns 'html' for real project files!
  }
  return state.activeTab;
},
```

**Impact**: Any `.css`, `.js`, `.json` file opened in project mode will be reported as `'html'`. This is currently latent because `CodeMirrorEditor.tsx` derives the file type from `files[activeFileId]?.type` directly instead of using `getActiveFileType()`. But any future consumer of `getActiveFileType()` will get wrong results.

**Fix**: Look up the file type from projectStore:
```tsx
getActiveFileType: () => {
  const state = get();
  if (state.activeFileId) {
    if (state.activeFileId === VIRTUAL_HTML_FILE_ID) return 'html';
    if (state.activeFileId === VIRTUAL_CSS_FILE_ID) return 'css';
    if (state.activeFileId === VIRTUAL_JS_FILE_ID) return 'javascript';
    // For project mode, derive from project store
    const { files } = useProjectStore.getState();
    const file = files[state.activeFileId];
    return file?.type ?? 'html';
  }
  return state.activeTab;
},
```

---

#### BUG 5 — Console toggle button doesn't collapse/expand the panel

**File**: `src/components/console/ConsoleToolbar.tsx` line 24

**Current code**:
```tsx
<button onClick={toggleConsole} ...>
```

**Impact**: `toggleConsole` flips `isConsoleOpen` in layoutStore, which controls whether the console entries are shown/hidden inside `ConsolePanel.tsx`. But the actual `react-resizable-panels` panel uses `onCollapse`/`onExpand` callbacks tied to the separator drag. Clicking the toggle button hides the content but the panel stays at its current size — an empty panel taking up space. The user expects the panel to collapse to 0 when toggled off, and expand back when toggled on.

**Fix**: Use the `react-resizable-panels` imperative handle (`panelRef.collapse()` / `panelRef.expand()`) to actually collapse/expand the panel, instead of just toggling a content-visibility flag:

In `ProjectLayout.tsx` and `AppLayout.tsx`, add a `panelRef` to the console panel:
```tsx
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';

const consolePanelRef = useRef<ImperativePanelHandle>(null);

// Pass ref to Panel
<Panel ref={consolePanelRef} ...>

// Pass collapse/expand functions to ConsoleToolbar
<ConsolePanel
  onCollapse={() => consolePanelRef.current?.collapse()}
  onExpand={() => consolePanelRef.current?.expand()}
  isCollapsed={!isConsoleOpen}
/>
```

In `ConsoleToolbar.tsx`, use the provided callbacks:
```tsx
<button onClick={() => isCollapsed ? onExpand() : onCollapse()} ...>
```

---

#### BUG 6 — `activeFileId` desync between editorStore and projectStore

**File**: `src/components/project/ProjectFileTabs.tsx` line 165

**Current code**:
```tsx
const handleActivate = useCallback(
  (fileId: FileId) => {
    setActiveFileId(fileId);  // Only updates editorStore
  },
  [setActiveFileId]
);
```

**Impact**: Clicking a tab updates `editorStore.activeFileId` but NOT `projectStore.activeProject.activeFileId`. Preview building and persistence use the project store and will reference the wrong file. After reload, the wrong file will be active.

**Fix**: Also update projectStore:
```tsx
const handleActivate = useCallback(
  (fileId: FileId) => {
    setActiveFileId(fileId);
    useProjectStore.getState().setActiveFile(fileId);  // Sync to project store
  },
  [setActiveFileId]
);
```

---

### 🟡 MEDIUM — Code Quality Issues

---

#### BUG 7 — `DEFAULT_HTML/CSS/JS` duplicated in two stores

**Files**: `src/stores/editorStore.ts` lines 65-157, `src/stores/projectStore.ts` lines 29-121

**Impact**: DRY violation. If one set of defaults is updated, the other could be forgotten, causing inconsistency between single-file and project mode defaults.

**Fix**: Extract to a shared module `src/utils/defaults.ts`:
```tsx
export const DEFAULT_HTML = `...`;
export const DEFAULT_CSS = `...`;
export const DEFAULT_JS = `...`;
```

Then import in both stores.

---

#### BUG 8 — `resetAll()` doesn't sync project-mode state

**File**: `src/stores/editorStore.ts` lines 171-177

**Current code**:
```tsx
resetAll: () =>
  set({
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    javascript: DEFAULT_JS,
    activeTab: 'html' as ActiveTab,
    // ❌ Doesn't reset: fileContents, dirtyMap, openTabIds, activeFileId
  }),
```

**Impact**: After reset, project mode shows stale content because `fileContents`, `dirtyMap`, `openTabIds`, and `activeFileId` are not reset. The editor shows old file content even though the legacy `html/css/javascript` were reset.

**Fix**:
```tsx
resetAll: () =>
  set({
    html: DEFAULT_HTML,
    css: DEFAULT_CSS,
    javascript: DEFAULT_JS,
    activeTab: 'html' as ActiveTab,
    fileContents: {
      [VIRTUAL_HTML_FILE_ID]: DEFAULT_HTML,
      [VIRTUAL_CSS_FILE_ID]: DEFAULT_CSS,
      [VIRTUAL_JS_FILE_ID]: DEFAULT_JS,
    },
    dirtyMap: {},
    openTabIds: [VIRTUAL_HTML_FILE_ID, VIRTUAL_CSS_FILE_ID, VIRTUAL_JS_FILE_ID],
    activeFileId: VIRTUAL_HTML_FILE_ID,
  }),
```

---

#### BUG 9 — `VIRTUAL_PROJECT_ID` hardcoded as string literal

**Files**: `src/App.tsx` line 64, `src/hooks/useAutoRefresh.ts` line 42

**Current code**:
```tsx
// App.tsx:64
if (projectStore.projects['proj_virtual_default']) {  // ❌ hardcoded

// useAutoRefresh.ts:42
if (activeProject.id === 'proj_virtual_default') {  // ❌ hardcoded
```

**Impact**: If `VIRTUAL_PROJECT_ID` constant changes, these hardcodes will break silently.

**Fix**: Import and use the constant:
```tsx
import { VIRTUAL_PROJECT_ID } from '../types/project';
// ...
if (projectStore.projects[VIRTUAL_PROJECT_ID]) {
// ...
if (activeProject.id === VIRTUAL_PROJECT_ID) {
```

---

#### BUG 10 — Dual-write on every keystroke (editorStore + projectStore)

**File**: `src/components/editor/CodeMirrorEditor.tsx` lines 68-71

**Current code**:
```tsx
const handleChange = (value: string) => {
  updateFileContent(activeFileId, value);         // editorStore
  updateProjectFileContent(activeFileId, value);  // projectStore
};
```

**Impact**: Two separate store updates on every keystroke. If one fails or is batched differently, the two stores desync. This also causes two re-renders per keystroke.

**Fix**: Make `updateFileContent` in editorStore automatically sync to projectStore (single source of truth), or derive project file content from editorStore only.

---

### 🟢 LOW — Minor Issues

---

#### BUG 11 — Test DB connection never closed (resource leak)

**File**: `src/utils/idb.ts` line 111

**Impact**: The test DB connection is opened but never properly closed. Minor resource leak.

**Fix**: Addressed as part of BUG 2 fix (close the DB before deleting it).

---

#### BUG 12 — `idbAvailable` cache never invalidated

**File**: `src/utils/idb.ts` line 95

**Impact**: If IDB becomes unavailable later (e.g., user enters private browsing), the cached `true` value means the app will keep trying to use IDB and silently failing.

**Fix**: Reset `idbAvailable = null` when operations fail, so the next call re-checks availability.

---

#### BUG 13 — `scheduleContentSave` captures stale `FileEntry` snapshot

**File**: `src/utils/idb.ts` lines 330-345

**Impact**: The function receives a `FileEntry` object and debounces the save. If the file content changes again before the debounce fires, the old snapshot is saved to IDB, overwriting newer data.

**Fix**: Inside the debounced callback, read the latest file state from the store getter instead of using the captured snapshot.

---

## Fix Implementation Plan

### Phase 1 — Critical Fixes (Must-do first)

| Step | Bug | File(s) | Change |
|------|-----|---------|--------|
| 1.1 | BUG 2 | `src/utils/idb.ts` | Fix `isIDBAvailable()` — close test DB and use `deleteDB()` |
| 1.2 | BUG 3 | `src/App.tsx` | Remove `activeProject` from `SingleFileRouteHandler` useEffect deps, run once on mount |
| 1.3 | BUG 1 | `ProjectLayout.tsx`, `AppLayout.tsx` | Fix all `onResize` callbacks to use correct setters |
| 1.4 | BUG 5 | `ConsoleToolbar.tsx`, `ConsolePanel.tsx`, both layouts | Use imperative panel handle for collapse/expand |

### Phase 2 — High-Priority Fixes

| Step | Bug | File(s) | Change |
|------|-----|---------|--------|
| 2.1 | BUG 6 | `ProjectFileTabs.tsx` | Sync `activeFileId` to projectStore on tab activate |
| 2.2 | BUG 4 | `editorStore.ts` | Fix `getActiveFileType()` to look up file type from projectStore |
| 2.3 | BUG 8 | `editorStore.ts` | Fix `resetAll()` to also reset project-mode state |

### Phase 3 — Code Quality Improvements

| Step | Bug | File(s) | Change |
|------|-----|---------|--------|
| 3.1 | BUG 7 | `editorStore.ts`, `projectStore.ts`, new `src/utils/defaults.ts` | Extract shared defaults |
| 3.2 | BUG 9 | `App.tsx`, `useAutoRefresh.ts` | Replace hardcoded strings with `VIRTUAL_PROJECT_ID` constant |
| 3.3 | BUG 10 | `CodeMirrorEditor.tsx` | Consolidate dual-write into single source of truth |
| 3.4 | BUG 13 | `src/utils/idb.ts` | Read latest state in debounced save callback |
| 3.5 | BUG 12 | `src/utils/idb.ts` | Reset `idbAvailable` cache on operation failure |

---

## Root Cause → User Symptom Mapping

| User Symptom | Root Cause Bug(s) |
|-------------|-------------------|
| "Project mode not working / not showing anything" | **BUG 3** — Route handler resets mode to 'single-file' on every activeProject change |
| "Console slider stops and can't expand freely" | **BUG 1** — Wrong setter in onResize + **BUG 5** — Toggle doesn't collapse panel |
| "Project tree slider stops and can't expand freely" | **BUG 1** — Wrong setter in onResize causes wrong defaultSize on remount |
| "Data doesn't persist after page refresh" | **BUG 2** — isIDBAvailable() always returns false |
| "Wrong syntax highlighting in project mode" | **BUG 4** — getActiveFileType() returns 'html' for all files (latent) |
| "Reset button doesn't fully reset in project mode" | **BUG 8** — resetAll() doesn't sync project-mode state |

---

## Expected Results After Fixes

- **Project mode**: Clicking "Project" in toolbar switches to project layout with file tree, project tabs, and stays in project mode without reverting.
- **Panel sliders**: All four sliders (file tree ↔ editor, editor ↔ preview, top ↔ console) resize freely within their min/max bounds. Stored sizes persist across remounts.
- **Console toggle**: Clicking the console toggle actually collapses/expands the panel, not just hiding the content.
- **Persistence**: Projects and files survive page refresh via IndexedDB.
- **Reset**: Reset button clears all state including project-mode file contents.
- **Syntax highlighting**: Correct CodeMirror language mode for each file type in project mode.

---

## Conventional Commit Message (for implementation)

```
fix(core): resolve project mode, panel resize, and persistence bugs

CRITICAL:
- Fix isIDBAvailable() — use deleteDB() instead of deleteObjectStore()
- Fix SingleFileRouteHandler — run setMode only on mount, not on every change
- Fix all onResize callbacks — use correct per-panel setters instead of setTopPanelSize
- Fix console toggle — use imperative panel handle for collapse/expand

HIGH:
- Sync activeFileId to projectStore on tab activation
- Fix getActiveFileType() to look up file type from projectStore
- Fix resetAll() to also reset project-mode state

MEDIUM:
- Extract DEFAULT_HTML/CSS/JS to shared defaults module
- Replace hardcoded VIRTUAL_PROJECT_ID strings with constant
- Consolidate dual-write in CodeMirrorEditor

Fixes: project mode not activating, panel sliders stuck, IDB persistence disabled
```

---

## Implementation Log

### Round 1 — Runtime Bug Fixes ✅

| Bug | Status | Implementation |
|-----|--------|----------------|
| BUG 1 — onResize wrong setters | ✅ Fixed | `ProjectLayout.tsx` + `AppLayout.tsx` — all 5 handlers now use correct setters |
| BUG 2 — isIDBAvailable() broken | ✅ Fixed | `idb.ts` — close() + deleteDatabase() + onblocked handler |
| BUG 9 — VIRTUAL_PROJECT_ID hardcoded | ✅ Fixed | `App.tsx` + `useAutoRefresh.ts` — now use named constant |
| BUG 13 — scheduleContentSave stale closure | ✅ Fixed | `idb.ts` — re-fetches from store at fire-time via lazy getter |
| BUG 10 — Dual-write in CodeMirrorEditor | ✅ Fixed | `editorStore.updateFileContent` auto-syncs to projectStore |
| ProjectList ignores newProjectName | ✅ Fixed | `onNewProject` now accepts `name: string`, `handleNewProject` in `App.tsx` uses it |
| useAutoRefresh stale closure | ✅ Fixed | `getPreviewContent` wrapped in `useCallback` with proper deps |

### Round 2 — Hardcoded Values & Duplicate Code ✅

| Issue | Status | Implementation |
|-------|--------|----------------|
| HARDCODE1 — DEFAULT_HTML/CSS/JS duplicated | ✅ Fixed | Extracted to `src/constants/defaultContent.ts`, imported in both stores |
| HARDCODE2 — 'proj_virtual_default' in useAutoRefresh.ts | ✅ Fixed | Uses `VIRTUAL_PROJECT_ID` constant |
| HARDCODE3 — 'proj_virtual_default' in App.tsx | ✅ Fixed | Uses `VIRTUAL_PROJECT_ID` constant |
| HARDCODE4 — IDB upgrade no migration strategy | ✅ Fixed | `upgrade(db, oldVersion)` now uses `if (oldVersion < 1)` blocks with future migration placeholders |
| DUPLICATE1 — src/types.ts dead file | ✅ Fixed | Deleted — all imports resolve to `src/types/index.ts` |
| DUPLICATE2 — External resource HTML building duplicated | ✅ Fixed | Extracted `buildExternalResourceTags()` helper in `previewBuilder.ts`, used by both builders |
| DUPLICATE3 — updateFileContent dual-write | ✅ Fixed | `editorStore.updateFileContent` is single write target, auto-syncs to `projectStore` via lazy getter; `CodeMirrorEditor` no longer calls both stores |
