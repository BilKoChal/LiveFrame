/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Project, FileEntry, FileId } from '../types/project';
import { CONSOLE_HOOK, buildExternalResourceTags } from './previewBuilder';

/**
 * Assemble a complete HTML document from a project's files.
 *
 * Strategy:
 * 1. Find the main HTML file (index.html, or first .html file)
 * 2. Collect all CSS files and inject as <style> blocks in <head>
 * 3. Collect all JS files and inject as <script> blocks at end of <body>
 * 4. Inject console capture hook
 * 5. Add external resources (CDN links)
 *
 * This "full inline" strategy works without a dev server — everything
 * is embedded into a single srcdoc string.
 */
export function assembleProjectDocument(
  project: Project,
  files: Record<FileId, FileEntry>,
  fileContents: Record<FileId, string>
): string {
  const projectFiles = project.fileIds
    .map((id) => files[id])
    .filter(Boolean);

  // Separate files by type
  const htmlFiles = projectFiles.filter((f) => f.type === 'html');
  const cssFiles = projectFiles.filter((f) => f.type === 'css');
  const jsFiles = projectFiles.filter((f) => f.type === 'javascript');

  // Find the main HTML file
  const mainHtml =
    htmlFiles.find((f) => f.path === 'index.html') ?? htmlFiles[0];

  // Collect CSS content from all CSS files
  const allCss = cssFiles
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => {
      const content = fileContents[f.id] ?? f.content ?? '';
      return `/* ${f.path} */\n${content}`;
    })
    .join('\n\n');

  // Collect JS content from all JS files
  const allJs = jsFiles
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => {
      const content = fileContents[f.id] ?? f.content ?? '';
      return `// ${f.path}\n${content}`;
    })
    .join('\n\n');

  // Use the main HTML content (or fall back to a wrapper)
  const htmlContent = mainHtml
    ? (fileContents[mainHtml.id] ?? mainHtml.content ?? '')
    : '<div id="app"></div>';

  // Build external resource links using shared helper
  const head = buildExternalResourceTags(project.externalResources, 'head');
  const body = buildExternalResourceTags(project.externalResources, 'body');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${head.links}
${head.scripts}
  <style>
    ${allCss}
  </style>
  ${CONSOLE_HOOK}
</head>
<body>
  ${htmlContent}
${body.links}
${body.scripts}
  <script>
    try {
      ${allJs}
    } catch (error) {
      console.error(error.message || String(error));
      window.parent.postMessage({
        source: 'liveframe-preview',
        type: 'error',
        payload: {
          message: error.message || String(error),
          filename: '',
          lineno: 0,
          colno: 0
        }
      }, '*');
    }
  </script>
</body>
</html>`;
}
