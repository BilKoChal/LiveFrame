# Fixing Plan — Panel Resize Issues

> **Created**: 2026-05-29
> **Status**: Complete ✅
> **Affects**: File Tree panel, Console panel
> **Working**: Editor panel, Preview panel

---

## Problem Statement

The editor and preview panels resize freely via their slider (Separator + ResizeHandle), but the **File Tree** panel and **Console** panel hit a hard lower bound very quickly — the slider stops at an unexpectedly small size and the user cannot shrink these panels below a certain threshold, nor expand them freely. This makes the layout feel rigid on those two sides.

---

## Root Cause Analysis

### Issue 1 — File Tree Panel: `minSize={12}` + Content Intrinsic Size

**Location**: `src/components/project/ProjectLayout.tsx` line 40–45

```tsx
<Panel
  defaultSize={18}
  minSize={12}
  maxSize={35}
  className="flex flex-col h-full overflow-hidden"
>
  <FileTree />
</Panel>
```

**Problems**:

1. **`minSize={12}` is too restrictive** — 12% of a 1920px screen is ~230px, which seems OK, but the `react-resizable-panels` library computes size as a **percentage of the Group's total space**. Because the file tree shares the horizontal Group with the editor (defaultSize=50) and preview (defaultSize=50), the effective available space is already limited. When dragging the separator left (shrinking the tree), the editor panel tries to grow, but its `minSize={25}` prevents it from absorbing all the freed space — creating a dead zone.

2. **`maxSize={35}` caps expansion** — The tree cannot grow beyond 35%, which prevents the user from making it wide enough to read long file names. This is overly conservative.

3. **No `minSize` on the FileTree's inner content** — The `<FileTree>` component has a header bar (`px-3 py-2`) and tree rows with `text-xs font-medium`. These have an intrinsic minimum width (~140px for "Files" header + buttons). The `flex flex-col` layout doesn't enforce a CSS `min-width`, so the panel can visually collapse below the content's readable width before the `minSize` kicks in, creating a "stuck" feeling.

4. **Conditional rendering creates panel count mismatch** — The file tree panel + separator are wrapped in `{isFileTreeOpen && ...}`, which means when the tree is hidden, the horizontal Group only has 2 panels (editor + preview). When the tree appears, it suddenly has 3 panels. The `react-resizable-panels` library recalculates sizes, and the `defaultSize` values (18 + 50 + 50 = 118%) exceed 100%, causing the library to redistribute sizes in unexpected ways that clamp resize behavior.

### Issue 2 — Console Panel: `minSize={10}` + Inconsistent Group Size

**Location**: `src/components/project/ProjectLayout.tsx` line 86–93 and `src/components/layout/AppLayout.tsx` line 78–87

```tsx
<Panel defaultSize={25} minSize={10} maxSize={50} className="flex flex-col overflow-hidden shadow-inner ...">
  <ConsolePanel />
</Panel>
```

**Problems**:

1. **Same conditional rendering issue** — The console panel + separator are wrapped in `{isConsoleOpen && ...}`. When toggled on, the vertical Group goes from 1 panel (top) to 2 panels (top + console). The `defaultSize={75}` + `defaultSize={25}` = 100% works initially, but after any manual resize, toggling the console off and on again causes the library to reset to `defaultSize`, which may conflict with the current layout state.

2. **ConsolePanel has a fixed header + search input with `w-32 sm:w-44`** — The search input and toolbar buttons have intrinsic minimum heights. With `minSize={10}` (10% of a typical screen height of ~800px = 80px), the console header (~32px) + one log row (~24px) already consumes most of that 80px. The user can barely see any content, and the slider feels like it "stops" because there's no visible benefit to shrinking further.

3. **Collapsed console state renders outside the Group** — When `isConsoleOpen` is false, a `<div className="flex-shrink-0"><ConsolePanel /></div>` is rendered outside the `<Group>`, which creates a disconnected mini console bar. This breaks the resize mental model — the user expects the separator to still be there but collapsed, not a separate floating element.

4. **`minSize={10}` is too small to be useful, `maxSize={50}` is fine** — The practical minimum for the console to be usable is ~15% (enough to see the header + 2–3 log rows). Below that, it's essentially invisible, so the slider feels broken.

### Issue 3 — `defaultSize` Values Don't Sum to 100% When File Tree is Visible

In `ProjectLayout.tsx`, the horizontal Group contains:
- File Tree: `defaultSize={18}`
- Editor: `defaultSize={50}`
- Preview: `defaultSize={50}`

**Total = 118%** — This exceeds 100%. `react-resizable-panels` handles this by proportionally rescaling, but it means the initial visual split is not 18/50/50 — it's approximately 16/43/43. This mismatch between declared and actual sizes makes the resize constraints (minSize/maxSize) behave unexpectedly relative to what the user sees.

The same issue exists in `AppLayout.tsx` for the single-file mode: editor `defaultSize={50}` + preview `defaultSize={50}` = 100%, which is correct. But the vertical split: top `defaultSize={75}` + console `defaultSize={25}` = 100%, which is fine.

---

## Fix Plan

### Fix 1 — Correct `defaultSize` Values to Sum to 100%

**File**: `src/components/project/ProjectLayout.tsx`

| Panel | Current | Fixed |
|-------|---------|-------|
| File Tree | 18 | 18 |
| Editor | 50 | 41 |
| Preview | 50 | 41 |
| **Total** | **118** | **100** |

For single-file mode (`AppLayout.tsx`), the editor/preview split already sums to 100% — no change needed.

### Fix 2 — Relax `minSize` / `maxSize` on File Tree Panel

**File**: `src/components/project/ProjectLayout.tsx`

| Constraint | Current | Fixed | Reason |
|------------|---------|-------|--------|
| `minSize` | 12 | 5 | Allow shrinking to ~96px on 1920px screen — enough for icon-only tree |
| `maxSize` | 35 | 45 | Allow wider tree for long file names / deep nesting |

### Fix 3 — Adjust Console `minSize` for Practical Usability

**Files**: `src/components/project/ProjectLayout.tsx`, `src/components/layout/AppLayout.tsx`

| Constraint | Current | Fixed | Reason |
|------------|---------|-------|--------|
| `minSize` | 10 | 8 | Allow smaller but not useless; 8% of ~800px = 64px — just the header + 1 row |
| `maxSize` | 50 | 60 | Allow console to take up more screen when debugging heavily |

### Fix 4 — Add CSS `min-width` / `min-height` on Inner Panel Content

**File**: `src/components/project/FileTree.tsx`

Add to the root `<div>`:
```tsx
<div className="flex flex-col h-full min-w-[120px] bg-slate-50 dark:bg-slate-900/40 ...">
```

This ensures the tree content has a minimum readable width, and the panel library will respect it as a floor when resizing.

**File**: `src/components/console/ConsolePanel.tsx`

Add to the root `<div>`:
```tsx
<div className="flex flex-col h-full min-h-[48px] bg-slate-50 dark:bg-slate-900 ...">
```

This ensures the console header is always fully visible at minimum size.

### Fix 5 — Replace Conditional Panel Rendering with `collapsible` + `collapsedSize`

Instead of conditionally rendering/removing panels from the Group (which causes resize recalculations), use `react-resizable-panels`' built-in `collapsible` and `collapsedSize` props. This keeps the panel in the DOM but collapsed to a minimal size, maintaining consistent Group composition.

**File**: `src/components/project/ProjectLayout.tsx`

```tsx
{/* File Tree Panel — always in DOM, collapsible */}
<Panel
  defaultSize={18}
  minSize={5}
  maxSize={45}
  collapsible
  collapsedSize={0}
  onCollapse={() => useLayoutStore.getState().setIsFileTreeOpen(false)}
  onExpand={() => useLayoutStore.getState().setIsFileTreeOpen(true)}
  className="flex flex-col h-full overflow-hidden"
>
  <FileTree />
</Panel>
<Separator className="outline-none focus:ring-0">
  <ResizeHandle direction="horizontal" />
</Separator>
```

```tsx
{/* Console Panel — always in DOM, collapsible */}
<Panel
  defaultSize={25}
  minSize={8}
  maxSize={60}
  collapsible
  collapsedSize={0}
  onCollapse={() => useLayoutStore.getState().setIsConsoleOpen(false)}
  onExpand={() => useLayoutStore.getState().setIsConsoleOpen(true)}
  className="flex flex-col overflow-hidden shadow-inner font-sans antialiased"
>
  <ConsolePanel />
</Panel>
```

**File**: `src/components/layout/AppLayout.tsx`

Apply the same `collapsible` + `collapsedSize` pattern to the console panel in single-file mode.

Remove the floating `<div className="flex-shrink-0"><ConsolePanel /></div>` fallback that renders outside the Group when the console is closed.

### Fix 6 — Store Panel Sizes in layoutStore for Persistence

**File**: `src/stores/layoutStore.ts`

Add persisted panel sizes so that user resize preferences survive mode switches and page reloads:

```typescript
interface LayoutState {
  // ... existing fields ...
  /** Persisted panel sizes (percentages) */
  fileTreeSize: number;
  editorSize: number;
  previewSize: number;
  consoleSize: number;
  topPanelSize: number;
  /** Setters for panel sizes */
  setFileTreeSize: (size: number) => void;
  setEditorSize: (size: number) => void;
  setPreviewSize: (size: number) => void;
  setConsoleSize: (size: number) => void;
  setTopPanelSize: (size: number) => void;
}
```

Wire `<Panel onResize={(size) => ...} />` to update these values, and use them as `defaultSize` on next render.

---

## Implementation Order

| Step | Fix | Files | Priority |
|------|-----|-------|----------|
| 1 | Fix defaultSize to sum to 100% | `ProjectLayout.tsx` | **Critical** — this is the primary cause |
| 2 | Relax minSize/maxSize | `ProjectLayout.tsx`, `AppLayout.tsx` | **High** — directly enables freer resizing |
| 3 | Add min-width/min-height to content | `FileTree.tsx`, `ConsolePanel.tsx` | **Medium** — prevents content overflow |
| 4 | Switch to collapsible panels | `ProjectLayout.tsx`, `AppLayout.tsx` | **High** — eliminates panel count mismatch |
| 5 | Persist panel sizes | `layoutStore.ts`, both layouts | **Low** — nice-to-have for UX |
| 6 | Remove floating console fallback | `AppLayout.tsx`, `ProjectLayout.tsx` | **Medium** — cleanup after step 4 |

---

## Expected Result After Fixes

- **File Tree**: User can freely drag the separator from icon-only width (~5%) up to a wide view (~45%). The tree header and rows remain readable at all sizes. Collapsing to 0% hides the tree cleanly without removing it from the DOM.
- **Console**: User can freely drag the separator from header-only height (~8%) up to a large console view (~60%). The search bar and log rows remain usable at all sizes. Collapsing to 0% hides the console cleanly.
- **Editor / Preview**: Continue working as before — no regression.
- **Mode switching**: Panel sizes persist and don't jump unexpectedly when toggling file tree or console visibility.

---

## Conventional Commit (for when fix is implemented)

```
fix(layout): correct panel resize constraints for file tree and console

- Fix defaultSize values in ProjectLayout to sum to 100% (was 118%)
- Relax minSize/maxSize on file tree (5–45%) and console (8–60%)
- Add min-width/min-height to FileTree and ConsolePanel content
- Switch from conditional rendering to collapsible panels
- Remove floating console fallback outside Group
- Persist panel sizes in layoutStore

Fixes: file tree and console panels unable to resize freely
```
