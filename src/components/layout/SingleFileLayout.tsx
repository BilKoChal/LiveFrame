/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SingleFileLayout is the layout for single-file mode (HTML/CSS/JS tabs).
 * Currently the layout logic lives in AppLayout. This component is a
 * placeholder for when project mode is added — it will render the
 * single-file-specific panel configuration.
 *
 * For now, the single-file layout is rendered directly by AppLayout.
 * When Phase 1 (Project Mode) is implemented, this component will:
 * - Render the horizontal split: editor panel (with tabs) | preview panel
 * - Handle single-file-specific panel resizing
 * - Integrate with layoutStore for panel visibility
 */

export default function SingleFileLayout() {
  // This component will be implemented in Phase 1 when we add
  // project mode and need to switch between layouts.
  // For now, all layout logic is in AppLayout.tsx
  return null;
}
