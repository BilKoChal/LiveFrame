# Task Plan 2 — Complete Remaining Phase 0 Tasks

**Type**: Batch (all remaining Phase 0 items)
**Created**: 2026-05-29

## Objective

Complete all remaining Phase 0 tasks to bring the MVP prototype to 100%.

## Remaining Items

### 0.1 Project Scaffolding (remaining)
- [ ] Set up shadcn/ui — Initialize with `npx shadcn@latest init` and add core components (button, separator, tabs, tooltip)
- [ ] Create `README.md`
- [ ] Create `src/vite-env.d.ts` type declarations
- [ ] Clean up `package.json` (remove unused deps: @google/genai, dotenv, express, motion)

### 0.2 Basic Layout (remaining)
- [ ] Create `src/stores/layoutStore.ts` — panel visibility, mode
- [ ] Create `src/components/layout/AppLayout.tsx` — extract toolbar + main area from App.tsx
- [ ] Create `src/components/layout/SingleFileLayout.tsx` — extract editor/preview/console panel layout

### 0.3 CodeMirror Integration (remaining)
- [ ] Create `src/components/editor/EditorSkeleton.tsx` — loading skeleton for lazy CodeMirror
- [ ] Create `src/components/editor/CodeMirrorEditor.tsx` — move and enhance with Emmet, lazy-loading wrapper
- [ ] Add `@emmetio/codemirror-plugin` dependency

### 0.7 Basic Toolbar (remaining)
- [ ] Create `src/components/toolbar/RefreshControls.tsx` — extract auto-run + manual run buttons from Toolbar
- [ ] Create `src/components/toolbar/Toolbar.tsx` — move Toolbar and use RefreshControls

## Implementation Strategy

1. **Reorganize components into subdirectories** — Move existing components into `layout/`, `editor/`, `toolbar/`, `preview/`, `console/`
2. **Create new files** — layoutStore, EditorSkeleton, RefreshControls, README, vite-env.d.ts
3. **Update imports** — All import paths must reflect new subdirectory structure
4. **Install dependencies** — @emmetio/codemirror-plugin, shadcn/ui components
5. **Wire up lazy loading** — CodeMirror loaded via React.lazy() + Suspense with EditorSkeleton fallback
6. **Clean up package.json** — Remove unused AI Studio dependencies

## Files to Create
- `src/vite-env.d.ts`
- `src/stores/layoutStore.ts`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/SingleFileLayout.tsx`
- `src/components/editor/EditorSkeleton.tsx`
- `src/components/editor/CodeMirrorEditor.tsx` (move + enhance)
- `src/components/toolbar/RefreshControls.tsx`
- `src/components/toolbar/Toolbar.tsx` (move)
- `src/components/toolbar/ThemeToggle.tsx` (move)
- `src/components/preview/PreviewFrame.tsx` (move)
- `src/components/console/ConsolePanel.tsx` (move)
- `src/components/editor/SingleFileTabs.tsx` (move)
- `src/components/layout/ResizeHandle.tsx` (move)
- `README.md`

## Files to Modify
- `src/App.tsx` — Simplify to use AppLayout
- `package.json` — Add Emmet, clean unused deps
- `src/components/CodeMirrorEditor.tsx` — Delete (moved to editor/)

## Acceptance Criteria
- All Phase 0 checklist items are [x]
- App still works: type HTML/CSS/JS → see live preview
- CodeMirror is lazy-loaded with skeleton fallback
- Emmet works in HTML mode
- Components are organized in subdirectories per plan
- layoutStore manages panel visibility
- README.md exists
