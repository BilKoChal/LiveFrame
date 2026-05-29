# Worklog 4 — Fix Panel Resize + Complete Phase 1

> **Task ID**: 4
> **Date**: 2026-05-29

---

## Work Log

- Fixed layoutStore.ts: added panel size persistence (fileTreeSize, editorSize, previewSize, consoleSize, topPanelSize) and isResourcesOpen state
- Fixed ProjectLayout.tsx: corrected defaultSize to sum to 100% (18/41/41), relaxed minSize/maxSize, added collapsible panels with onCollapse/onExpand callbacks, removed conditional rendering, removed floating console fallback
- Fixed AppLayout.tsx: same collapsible panel pattern for console, removed floating fallback, added ExternalResourcePanel slide-over
- Fixed FileTree.tsx: added min-w-[120px] for minimum readable width
- Fixed ConsolePanel.tsx: added min-h-[48px], refactored to use extracted ConsoleEntry and ConsoleToolbar
- Created ConsoleEntry.tsx: extracted entry rendering component with icon/line-style helpers
- Created ConsoleToolbar.tsx: extracted toolbar component with search, clear, collapse toggle
- Fixed PreviewFrame.tsx: added error count badge (!) next to "Live Preview" header
- Created ExternalResourcePanel.tsx: CDN resource manager with presets (Tailwind, Bootstrap, Three.js, jQuery, Alpine.js, Lodash, D3.js), custom URL input, add/remove/reorder
- Updated Toolbar.tsx: added CDN resources toggle button with Package icon
- Updated previewBuilder.ts: added external resources injection (head links, head scripts, body links, body scripts) to assembleDocument
- Updated useAutoRefresh.ts: passes externalResources from activeProject to assembleDocument
- Installed react-router-dom@^7.15.0
- Rewrote App.tsx: added BrowserRouter with routes /, /project, /project/:id with dynamic basename
- Updated ProjectList.tsx: added onOpenProject/onNewProject callback props, React.FC for ProjectCard
- Fixed all TypeScript errors: React namespace imports, PanelSize type casting, Omit<ExternalResource, 'id'> for addExternalResource

## Stage Summary

- All 6 fixes from fixing.md implemented and verified
- Phase 1.5 complete: ConsoleEntry.tsx and ConsoleToolbar.tsx extracted
- Phase 1.6 complete: error count badge on preview panel
- Phase 1.7 complete: collapsible panels handle mode switch resizing
- Phase 1.8 complete: ExternalResourcePanel with CDN presets + custom URL + preview injection
- Phase 1.9 complete: React Router with /, /project, /project/:id routes
- Build passes, zero TypeScript errors
- Phase 1 is now 100% complete
