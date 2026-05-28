# Task Plan 1 — Update Plan & Add GitHub Pages Auto-Deploy

**Type**: Batch (3 sub-tasks)  
**Created**: 2026-05-29

## Objective

1. Update `LiveFrame_plan.md` to accurately reflect what has been implemented based on actual source code review
2. Add GitHub Actions workflow for auto-deployment to `gh-pages` branch for https://github.com/BilKoChal/LiveFrame
3. Update `structure.md` to reflect the current project state

## Sub-Task A: Update LiveFrame_plan.md

### Analysis of Current Code vs Plan

Based on reading all source files:

**Phase 0 — Completed items:**
- [x] 0.1 Project Scaffolding — Vite + React + TS + Tailwind CSS v4 is set up; path alias `@/` exists; `.env.example` exists
- [x] 0.2 Basic Layout — Resizable panels with `react-resizable-panels`; vertical/horizontal splits; `ResizeHandle.tsx` exists
- [x] 0.3 CodeMirror Integration — `@uiw/react-codemirror` with HTML/CSS/JS language packages; `SingleFileTabs.tsx`; basic extensions (bracket matching, auto-close, autocompletion)
- [x] 0.4 Zustand Stores (Minimal) — `editorStore.ts` (html, css, javascript, activeTab); `uiStore.ts` (theme, autoRefresh, consoleEntries, errorOverlay)
- [x] 0.5 Live Preview — `previewBuilder.ts` with `assembleDocument()`; `PreviewFrame.tsx` with iframe+srcdoc; `useAutoRefresh.ts` with 400ms debounce; manual refresh button
- [x] 0.6 Dark/Light Theme — `useTheme.ts` with system preference detection; `ThemeToggle.tsx` (light/dark/system); CodeMirror reads theme
- [x] 0.7 Basic Toolbar — `Toolbar.tsx` with logo, auto-refresh toggle, manual refresh, theme toggle

**Phase 0 — Partially done:**
- [~] 0.2 Layout — No `layoutStore.ts`; no `AppLayout.tsx` separate component (layout is in `App.tsx`)
- [~] 0.3 Editor — No lazy-loading of CodeMirror; no `EditorSkeleton.tsx`; no Emmet plugin

**Phase 0 — Not done:**
- [ ] No `RefreshControls.tsx` separate component
- [ ] No `EditorSkeleton.tsx`
- [ ] No `layoutStore.ts`

**Phase 2 — Partially done (device frames):**
- [~] 2.1 Device Frames — Basic device modes exist in `PreviewFrame.tsx` (fluid/tablet/phone), but no `DeviceFrame.tsx`, no `DevicePresets.ts`, no zoom-to-fit, no custom size dialog

### Steps
1. Open `LiveFrame_plan.md`
2. Mark completed items with `[x]` and add completion notes
3. Mark partially done items with `[~]` and note what's missing
4. Add a "Current Progress" section at the top

## Sub-Task B: Add GitHub Actions Workflow for gh-pages Deployment

### Requirements
- Workflow auto-deploys to `gh-pages` branch on push to `main`
- Uses Vite build with correct `base` path for GitHub Pages (`/LiveFrame/`)
- Handles SPA routing with `404.html` trick
- Uses `actions/deploy-pages` with GitHub Pages new experience
- Includes concurrency control

### Steps
1. Create `.github/workflows/deploy.yml`
2. Update `vite.config.ts` to use dynamic base path from env
3. Create `public/404.html` that redirects to `index.html` for SPA routing
4. Add `.env.production` with `VITE_BASE_PATH=/LiveFrame/`
5. Add `.env.development` with `VITE_BASE_PATH=/`

## Sub-Task C: Update structure.md

### Steps
1. Update directory tree to reflect actual current file layout
2. Add newly created files (workflows, env files, 404.html)
3. Keep the target structure as reference but show current state

## Prerequisites
- Access to the repository at /home/z/my-project/LiveFrame
- Understanding of GitHub Actions and Pages deployment

## Files to Create/Modify
- `docs/plan/LiveFrame_plan.md` (modify)
- `.github/workflows/deploy.yml` (create)
- `vite.config.ts` (modify)
- `public/404.html` (create)
- `.env.production` (create)
- `.env.development` (create)
- `docs/plan/structure.md` (modify)
- `index.html` (modify title)

## Acceptance Criteria
- Plan accurately reflects what's done vs not done
- GitHub Actions workflow is valid and will deploy to gh-pages on push to main
- Vite config supports dynamic base path
- SPA routing works on GitHub Pages via 404.html
- structure.md reflects actual project state
