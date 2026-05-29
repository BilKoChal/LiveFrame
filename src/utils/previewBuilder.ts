/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExternalResource } from '../types/project';

export const CONSOLE_HOOK = `
<script>
(function() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  function stringifyArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, (key, value) => {
          if (typeof value === 'function') {
            return value.toString();
          }
          return value;
        }, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }

  function sendLog(type, args) {
    try {
      const message = args.map(arg => stringifyArg(arg)).join(' ');

      window.parent.postMessage({
        source: 'liveframe-preview',
        type: 'console',
        payload: {
          type: type,
          message: message
        }
      }, '*');
    } catch (e) {
      originalError.apply(console, ['Failed sending log message', e]);
    }
  }

  console.log = function(...args) {
    originalLog.apply(console, args);
    sendLog('log', args);
  };
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendLog('warn', args);
  };
  console.error = function(...args) {
    originalError.apply(console, args);
    sendLog('error', args);
  };
  console.info = function(...args) {
    originalInfo.apply(console, args);
    sendLog('info', args);
  };

  // Capture global uncaught runtime errors inside the iframe sandbox
  window.addEventListener('error', function(event) {
    // Prevent default browser output in certain situations to handle it ourselves
    window.parent.postMessage({
      source: 'liveframe-preview',
      type: 'error',
      payload: {
        message: event.message || 'Uncaught runtime error',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0
      }
    }, '*');
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    window.parent.postMessage({
      source: 'liveframe-preview',
      type: 'error',
      payload: {
        message: 'Unhandled Promise Rejection: ' + message,
        filename: '',
        lineno: 0,
        colno: 0
      }
    }, '*');
  });
})();
</script>
`;

/**
 * Combines user-written HTML, CSS, and JS code into a single, self-contained HTML page.
 * Includes console reporting and runtime exception trapping.
 * Supports external resources (CDN links) injection.
 */
export function assembleDocument(
  html: string,
  css: string,
  javascript: string,
  externalResources: ExternalResource[] = []
): string {
  // Build external resource links
  const externalHeadLinks = externalResources
    .filter((r) => r.type === 'css' && r.placement === 'head')
    .map((r) => `  <link rel="stylesheet" href="${r.url}">`)
    .join('\n');

  const externalHeadScripts = externalResources
    .filter((r) => r.type === 'javascript' && r.placement === 'head')
    .map((r) => `  <script src="${r.url}"><\/script>`)
    .join('\n');

  const externalBodyScripts = externalResources
    .filter((r) => r.type === 'javascript' && r.placement === 'body')
    .map((r) => `  <script src="${r.url}"><\/script>`)
    .join('\n');

  const externalBodyLinks = externalResources
    .filter((r) => r.type === 'css' && r.placement === 'body')
    .map((r) => `  <link rel="stylesheet" href="${r.url}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${externalHeadLinks}
${externalHeadScripts}
  <style>
    ${css}
  </style>
  ${CONSOLE_HOOK}
</head>
<body>
  ${html}
${externalBodyLinks}
${externalBodyScripts}
  <script>
    // Execute user JS in an isolated wrapper to catch immediate syntax/runtime compilation loads
    try {
      ${javascript}
    } catch (error) {
      // Fire error capture
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
