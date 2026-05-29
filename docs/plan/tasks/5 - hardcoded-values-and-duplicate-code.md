# Task 5 — Hardcoded Values & Duplicate Code Cleanup

> **Created**: 2026-05-29  
> **Status**: Completed  
> **Type**: Code Quality Refactor

---

## Objective

Eliminate hardcoded values, duplicated code, and dead files identified during codebase analysis. This task focuses on DRY principle improvements and maintainability, not runtime bug fixes.

## Changes Implemented

### Hardcoded Values

| ID | Issue | File(s) | Fix |
|----|-------|---------|-----|
| HARDCODE1 | DEFAULT_HTML/CSS/JS duplicated across editorStore + projectStore (~80 lines each) | `src/stores/editorStore.ts`, `src/stores/projectStore.ts` | Extracted to `src/constants/defaultContent.ts`, imported in both stores |
| HARDCODE2 | Magic string `'proj_virtual_default'` instead of `VIRTUAL_PROJECT_ID` | `src/hooks/useAutoRefresh.ts` | Import and use `VIRTUAL_PROJECT_ID` constant |
| HARDCODE3 | Magic string `'proj_virtual_default'` instead of `VIRTUAL_PROJECT_ID` | `src/App.tsx` | Import and use `VIRTUAL_PROJECT_ID` constant |
| HARDCODE4 | `DB_VERSION = 1` with no migration strategy | `src/utils/idb.ts` | Restructured `upgrade(db, oldVersion)` with `if (oldVersion < N)` blocks and future migration placeholders |

### Duplicate / Mergeable Code

| ID | Issue | File(s) | Fix |
|----|-------|---------|-----|
| DUPLICATE1 | `src/types.ts` is a subset of `src/types/index.ts` — dead file | `src/types.ts` | Deleted dead file; all imports resolve to `src/types/index.ts` |
| DUPLICATE2 | External resource HTML-building duplicated across previewBuilder.ts and projectPreviewBuilder.ts | Both builder files | Extracted `buildExternalResourceTags()` helper in `previewBuilder.ts`, used by both builders |
| DUPLICATE3 | `updateFileContent` dual-write in CodeMirrorEditor (editorStore + projectStore called in tandem) | `CodeMirrorEditor.tsx`, `editorStore.ts` | `editorStore.updateFileContent` is now single write target, auto-syncs to projectStore via lazy getter |

## Files Modified

- `src/constants/defaultContent.ts` — **NEW** — single source of truth for default boilerplate
- `src/stores/editorStore.ts` — removed duplicated defaults, added lazy projectStore sync
- `src/stores/projectStore.ts` — removed duplicated defaults, import from constants
- `src/hooks/useAutoRefresh.ts` — uses `VIRTUAL_PROJECT_ID` constant
- `src/App.tsx` — uses `VIRTUAL_PROJECT_ID` constant
- `src/utils/idb.ts` — versioned migration guards in upgrade callback
- `src/types.ts` — **DELETED** (dead file)
- `src/utils/previewBuilder.ts` — added `buildExternalResourceTags()` shared helper
- `src/utils/projectPreviewBuilder.ts` — uses shared helper instead of duplicated code
- `src/components/editor/CodeMirrorEditor.tsx` — single write target (no dual-write)
- `docs/plan/fixing.md` — updated implementation log
- `docs/plan/structure.md` — updated directory tree and key file table

## Verification

- `npm run build` passes with no errors
- All imports resolve correctly after removing `src/types.ts`
- `buildExternalResourceTags()` produces identical output to the previous inline code
