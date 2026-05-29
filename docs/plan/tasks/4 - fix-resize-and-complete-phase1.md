# Task Plan 4 — Fix Panel Resize + Complete Phase 1

> **Created**: 2026-05-29
> **Task ID**: 4
> **Status**: Complete

---

## Scope

1. Fix all 6 items from `docs/plan/fixing.md`
2. Complete remaining Phase 1 tasks (1.5–1.9)

---

## Breakdown

### Part A: Fix Panel Resize Issues (fixing.md)

| # | Fix | Files Changed |
|---|-----|--------------|
| A1 | Correct defaultSize to sum to 100% | `ProjectLayout.tsx` |
| A2 | Relax minSize/maxSize (file tree 5–45%, console 8–60%) | `ProjectLayout.tsx`, `AppLayout.tsx` |
| A3 | Add min-width/min-height to content | `FileTree.tsx`, `ConsolePanel.tsx` |
| A4 | Switch to collapsible panels | `ProjectLayout.tsx`, `AppLayout.tsx` |
| A5 | Persist panel sizes in layoutStore | `layoutStore.ts` |
| A6 | Remove floating console fallback | `AppLayout.tsx`, `ProjectLayout.tsx` |

### Part B: Phase 1 Remaining Tasks

| # | Task | Files Created/Modified |
|---|------|----------------------|
| B1 | 1.5 Extract ConsoleEntry.tsx + ConsoleToolbar.tsx | `ConsoleEntry.tsx` (new), `ConsoleToolbar.tsx` (new), `ConsolePanel.tsx` (refactored) |
| B2 | 1.6 Add error count badge on preview panel | `PreviewFrame.tsx` (modified) |
| B3 | 1.7 Handle panel resizing on mode switch | Covered by A4 (collapsible panels) |
| B4 | 1.8 External Resources panel | `ExternalResourcePanel.tsx` (new), `Toolbar.tsx` (modified), `layoutStore.ts` (modified), `previewBuilder.ts` (modified), `useAutoRefresh.ts` (modified) |
| B5 | 1.9 React Router setup | `App.tsx` (rewritten), `ProjectList.tsx` (updated), `react-router-dom` installed |
