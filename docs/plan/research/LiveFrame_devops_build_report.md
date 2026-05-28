# LiveFrame — DevOps & Build Pipeline Report

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor deploying to GitHub Pages  
> **Stack**: React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS v4  
> **Date**: 2026-03-04  
> **Author**: DevOps & Build Specialist  

---

## Table of Contents

1. [Vite Build Configuration](#1-vite-build-configuration)
2. [GitHub Actions Deep Dive](#2-github-actions-deep-dive)
3. [Package Scripts](#3-package-scripts)
4. [TypeScript Configuration](#4-typescript-configuration)
5. [Testing Setup](#5-testing-setup)
6. [Linting & Formatting](#6-linting--formatting)
7. [Production Optimizations](#7-production-optimizations)
8. [GitHub Pages Specifics](#8-github-pages-specifics)
9. [CI/CD Edge Cases](#9-cicd-edge-cases)
10. [Local Development Experience](#10-local-development-experience)

---

## 1. Vite Build Configuration

### Complete `vite.config.ts`

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Base path: auto-detect based on environment
    // - In production (GitHub Pages): use repo name from env or default
    // - In development: use root '/'
    base: mode === 'production' ? env.VITE_BASE_PATH || '/LiveFrame/' : '/',

    // Dev server configuration
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: true,
      // Proxy configuration if needed for external APIs
      // proxy: { '/api': 'http://localhost:8080' },
    },

    // Preview server (for `npm run preview` — tests production build locally)
    preview: {
      port: 4173,
      host: '0.0.0.0',
      strictPort: true,
    },

    plugins: [
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    css: {
      // Tailwind CSS v4 uses Lightning CSS under the hood via @tailwindcss/vite
      // No additional css configuration needed for v4
      devSourcemap: true,
    },

    build: {
      // Target modern browsers for smaller bundles
      target: 'es2022',

      // Output directory
      outDir: 'dist',

      // Clean output directory before build
      emptyOutDir: true,

      // Source maps: enabled for production debugging, can be disabled for smaller builds
      sourcemap: true,

      // Chunk size warning limit (in KB) — CodeMirror is large, so set higher
      chunkSizeWarningLimit: 1000,

      // CSS code splitting — split CSS per chunk for better caching
      cssCodeSplit: true,

      // Rollup options for advanced chunk splitting
      rollupOptions: {
        output: {
          // Custom chunk file naming with content hash for cache busting
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            // Organize assets by type
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            } else if (/woff2?|ttf|otf|eot/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            } else if (/css/i.test(ext)) {
              return `assets/css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },

          // Manual chunk splitting strategy
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // React core — changes rarely, excellent cache candidate
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
                return 'vendor-react';
              }

              // CodeMirror — very large (~500KB+), separate chunk for lazy loading
              if (id.includes('@codemirror/') || id.includes('@lezer/') || id.includes('codemirror') || id.includes('w3c-keyname') || id.includes('style-mod')) {
                return 'vendor-codemirror';
              }

              // All other vendor dependencies
              return 'vendor';
            }
          },
        },
      },

      // Minification
      minify: 'esbuild',

      // Rollup tree shaking
      rollupOptions: undefined, // defined above, this is just a note
    },

    // Optimization options
    optimizeDeps: {
      // Force pre-bundling of these packages for faster dev server
      include: [
        'react',
        'react-dom',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/lang-html',
        '@codemirror/lang-css',
        '@codemirror/lang-javascript',
      ],
    },
  };
});
```

### Tailwind CSS v4 Integration

Tailwind CSS v4 represents a fundamental shift from v3. The key changes:

1. **No `tailwind.config.js` needed** — Configuration lives directly in CSS via `@theme` directive
2. **Vite plugin replaces PostCSS** — `@tailwindcss/vite` handles everything
3. **Lightning CSS** replaces PostCSS as the underlying transformer
4. **Automatic content detection** — No `content: [...]` config needed; it auto-detects

**Entry CSS file** (`src/index.css`):
```css
@import "tailwindcss";

/* Tailwind v4 theme customization — replaces tailwind.config.js */
@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-surface: #1e1e2e;
  --color-surface-light: #2d2d3f;
  --color-text: #cdd6f4;
  --color-text-muted: #6c7086;
  --color-border: #45475a;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}
```

### CodeMirror Chunk Splitting Strategy

**Yes, CodeMirror absolutely deserves its own chunk.** Here's the rationale:

- **Size**: The full CodeMirror bundle (state + view + language packages + Lezer parsers) weighs approximately **400-600KB minified** (120-180KB gzipped). This is the single largest dependency in LiveFrame.
- **Lazy loading opportunity**: The editor is not needed on initial page load — the user must navigate to the editor view. By lazy-loading CodeMirror, we can serve a sub-100KB initial bundle.
- **Cache isolation**: CodeMirror rarely changes when app code changes. A separate chunk means users only re-download what changed.
- **Lezer parser isolation**: The `@lezer/*` packages are CodeMirror's tree-sitter-like parsers. They're substantial and change independently.

**Implementation via `React.lazy()`**:
```typescript
// src/components/Editor.tsx
import { lazy, Suspense } from 'react';

const CodeMirrorEditor = lazy(() => import('./CodeMirrorEditor'));

export function Editor() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <CodeMirrorEditor />
    </Suspense>
  );
}
```

### Base Path Auto-Detection

The base path is the most common source of bugs in GitHub Pages deployments. The strategy uses environment variables:

**`.env.production`**:
```env
VITE_BASE_PATH=/LiveFrame/
```

**`.env.development`**:
```env
VITE_BASE_PATH=/
```

**`.env.example`**:
```env
# The base path for the deployed application.
# For GitHub Pages: /<repo-name>/
# For local development: /
VITE_BASE_PATH=/
```

The `vite.config.ts` reads this via `loadEnv()` and sets `base` accordingly. In CI, we can dynamically set this:

```yaml
# In GitHub Actions
- run: echo "VITE_BASE_PATH=/${{ github.event.repository.name }}/" >> .env.production
```

---

## 2. GitHub Actions Deep Dive

### The Two-Workflow Pattern

LiveFrame uses a **decoupled CI/CD pattern** with two separate workflows:

```
┌─────────────────────────────────────────────┐
│  CI Workflow (.github/workflows/ci.yml)      │
│  Trigger: push/PR to main                    │
│  Jobs: typecheck → test → build              │
│  Result: ✅ success or ❌ failure             │
└──────────────────┬──────────────────────────┘
                   │ workflow_run trigger
                   │ (only if conclusion == 'success')
                   ▼
┌─────────────────────────────────────────────┐
│  Deploy Workflow (.github/workflows/deploy.yml)│
│  Trigger: workflow_run from CI               │
│  Jobs: build → deploy to gh-pages            │
└─────────────────────────────────────────────┘
```

### `workflow_run` Trigger Mechanism

The `workflow_run` trigger is GitHub's mechanism for workflow chaining. Key properties:

1. **It runs in the context of the default branch** (main), regardless of which branch triggered the upstream CI. This means the deploy always checks out `main`.
2. **It has access to `github.event.workflow_run`** which contains the full context of the completed CI run, including:
   - `conclusion`: `"success"`, `"failure"`, `"cancelled"`, `"skipped"`
   - `head_sha`: The commit SHA that was built
   - `head_branch`: The branch name
   - `event`: The event that triggered CI (push, pull_request)
3. **The deploy only fires if CI succeeded**, thanks to the `if: ${{ github.event.workflow_run.conclusion == 'success' }}` condition.

### Complete CI Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Upload build artifact
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1
```

### Complete Deploy Workflow

```yaml
name: Deploy to GitHub Pages

on:
  workflow_run:
    workflows: ["CI"]
    branches: [main]
    types: [completed]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Configure base path
        run: |
          REPO_NAME="${{ github.event.repository.name }}"
          echo "VITE_BASE_PATH=/${REPO_NAME}/" >> .env.production
          echo "Configured base path: /${REPO_NAME}/"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Add 404.html for SPA routing
        run: cp dist/index.html dist/404.html

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist
          branch: gh-pages
          clean: true
          clean-exclude: |
            CNAME
```

### Dynamic Base Path Per Repo Name

The deploy workflow dynamically configures `VITE_BASE_PATH` using `${{ github.event.repository.name }}`. This means:

- If the repo is named `LiveFrame`, the base path becomes `/LiveFrame/`
- If someone forks it as `my-editor`, it automatically becomes `/my-editor/`
- No manual configuration needed — it's zero-config for forks

**Important caveat**: The `workflow_run` event runs in the context of the default branch. The `github.event.repository.name` is always the repo where the workflow is defined, which is correct for our use case.

### Potential Issues with `workflow_run`

1. **Race condition on rapid pushes**: If you push twice quickly, two CI runs start. The first completes and triggers deploy. The second completes and triggers another deploy. The second deploy will overwrite the first with potentially different code. This is actually fine — the final state is the latest code.

2. **Skipped deploys on CI failure**: If CI fails, the deploy workflow never fires. This is correct behavior — we never want to deploy broken code. However, there's no notification of the failed deploy (because it was never attempted). You only see the CI failure.

3. **Workflow file naming matters**: The `workflow_run` trigger matches on the `name` field of the CI workflow, not the filename. If the CI workflow's `name:` field is `CI`, then `workflows: ["CI"]` must match exactly. Case-sensitive.

4. **No artifact sharing by default**: Our deploy workflow re-runs `npm ci` and `npm run build` instead of downloading the CI artifact. This is intentional:
   - It ensures the build is reproducible
   - It avoids artifact size limits (Vite builds can be large)
   - It eliminates a dependency on CI's artifact upload step
   - The trade-off is ~30-60s of extra build time

5. **PR deploys**: `workflow_run` only triggers on `main` branch CI completions. PRs to main trigger CI but never trigger deploy. This is the correct behavior.

---

## 3. Package Scripts

### Complete `package.json`

```json
{
  "name": "liveframe",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\"",
    "check-all": "npm run typecheck && npm run lint && npm run format:check && npm run test"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@codemirror/state": "^6.6.0",
    "@codemirror/view": "^6.36.0",
    "@codemirror/lang-html": "^6.4.9",
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-javascript": "^6.2.3",
    "@codemirror/theme-one-dark": "^6.1.2",
    "codemirror": "^6.0.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.4.1",
    "@tailwindcss/vite": "^4.3.0",
    "tailwindcss": "^4.3.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "@vitest/coverage-v8": "^3.2.1",
    "@vitest/ui": "^3.2.1",
    "eslint": "^9.28.0",
    "@typescript-eslint/parser": "^8.33.0",
    "@typescript-eslint/eslint-plugin": "^8.33.0",
    "typescript-eslint": "^8.33.0",
    "prettier": "^3.5.3",
    "prettier-plugin-tailwindcss": "^0.6.12"
  }
}
```

### Script Descriptions

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `dev` | Start Vite dev server with HMR on port 3000 | Local development |
| `build` | Type-check then build for production | CI, deployment, manual builds |
| `preview` | Serve production build locally on port 4173 | Verify production build before deploy |
| `typecheck` | Run TypeScript compiler in check-only mode | CI, pre-commit, editor integration |
| `test` | Run Vitest once (non-watch mode) | CI, manual verification |
| `test:watch` | Run Vitest in watch mode | Local development (TDD) |
| `test:coverage` | Run tests with V8 coverage reporting | CI coverage gates, manual review |
| `test:ui` | Open Vitest's browser-based test UI | Debugging test failures |
| `lint` | Check code quality with ESLint (zero warnings) | CI, pre-commit hooks |
| `lint:fix` | Auto-fix ESLint issues | Local development |
| `format` | Format code with Prettier | Pre-commit hooks, manual |
| `format:check` | Verify formatting without writing | CI |
| `check-all` | Run all checks sequentially | Pre-push, CI alternative |

### Why `tsc -b` in the Build Script

Using `tsc -b` (build mode) instead of `tsc --noEmit` in the build script enables **project references** support. If the project later splits into `tsconfig.json` + `tsconfig.node.json`, `tsc -b` correctly handles the dependency graph. It also ensures that declaration files are up-to-date.

The `typecheck` script uses `--noEmit` because we only want type checking without generating output files — it's faster and cleaner for CI.

---

## 4. TypeScript Configuration

### `tsconfig.json` (Root Config — Project References)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `tsconfig.app.json` (Application Code)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting / Strict mode */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,

    /* Path aliases — must match Vite resolve.alias */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### `tsconfig.node.json` (Vite/Config Files)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases for config files */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

### Why Separate Configs?

1. **Different runtime environments**: App code runs in the browser (`DOM` lib); Vite config runs in Node.js. Without separation, you'd either miss DOM types in config files or incorrectly have DOM globals in Node context.

2. **Different module targets**: App code is bundled by Vite (so `moduleResolution: "bundler"` with `noEmit`). Config files are also not directly emitted but the separation makes the intent clear.

3. **`tsc -b` builds the reference graph correctly**: When you run `tsc -b`, it builds each referenced project in dependency order. Changes to app code don't require re-checking config files and vice versa.

4. **Future-proofing**: If you add a shared `shared/` package or a `worker/` entry point, you add another reference without restructuring.

### Strict Mode Details

The `strict: true` flag enables:
- `strictNullChecks` — `null` and `undefined` are not assignable to other types
- `noImplicitAny` — Disallows implicit `any` types
- `strictFunctionTypes` — Function parameter types checked contravariantly
- `strictBindCallApply` — `bind`, `call`, `apply` are checked
- `strictPropertyInitialization` — Class properties must be initialized in constructor
- `noImplicitThis` — Disallows `this` with implicit `any` type
- `alwaysStrict` — Emits `"use strict"` in output

The additional flags beyond `strict`:
- `noUnusedLocals` / `noUnusedParameters` — Dead code elimination at the type level
- `noFallthroughCasesInSwitch` — Prevents accidental switch case fallthrough
- `noUncheckedIndexedAccess` — Array/object index access returns `T | undefined` — critical for preventing runtime errors
- `forceConsistentCasingInFileNames` — Prevents issues on case-insensitive filesystems (macOS/Windows)

---

## 5. Testing Setup

### `vitest.config.ts`

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Test environment
      environment: 'jsdom',

      // Global test APIs (describe, it, expect, etc.)
      globals: true,

      // Setup files
      setupFiles: ['./src/test/setup.ts'],

      // Include patterns
      include: ['src/**/*.{test,spec}.{ts,tsx}'],

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'lcov', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.d.ts',
          'src/**/*.type.ts',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
        // Coverage thresholds — enforce quality
        thresholds: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },

      // Performance
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true, // Better for CodeMirror DOM tests
        },
      },

      // Timeout
      testTimeout: 10000,

      // CSS modules — mock CSS in tests
      css: {
        modules: {
          classNameStrategy: 'non-scoped',
        },
      },
    },
  })
);
```

### Test Setup File (`src/test/setup.ts`)

```typescript
import '@testing-library/jest-dom/vitest';

// Mock window.matchMedia for CodeMirror tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver for CodeMirror
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver (may be needed by some UI components)
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
window.IntersectionObserver = MockIntersectionObserver as any;
```

### Test Strategy

#### Unit Tests (Priority: High)

| Module | What to Test | Approach |
|--------|-------------|----------|
| `useEditorState` hook | State transitions, document updates, cursor management | `renderHook` + `act` |
| `usePreview` hook | iframe communication, error handling, refresh logic | `renderHook` + mock iframe |
| `transformCSS()` | CSS autoprefixing, nesting, error recovery | Pure function tests |
| `transformJS()` | JS transpilation, import handling, error recovery | Pure function tests |
| `debounce()` | Timing behavior, cancellation | `vi.useFakeTimers()` |
| `parseHTML()` | HTML parsing, error detection, extraction | Pure function tests |

#### Integration Tests (Priority: Medium)

| Feature | What to Test | Approach |
|---------|-------------|----------|
| Editor ↔ Preview sync | Code changes appear in preview | `render` + `fireEvent` + assertions on iframe |
| Tab switching | HTML/CSS/JS tabs work, preserve state | `render` + `userEvent.click` |
| Layout resizing | Panel resizing works, persists | `render` + drag simulation |
| Theme toggle | Light/dark mode works | `render` + `userEvent.click` |
| localStorage | Settings persist across renders | Mock `localStorage` |

#### E2E Tests (Priority: Low — Consider Later)

For a tool like LiveFrame, E2E tests with **Playwright** are valuable but not critical for MVP. Consider adding them when:

- The editor has complex multi-step flows (share, save, load)
- You need to verify actual iframe rendering behavior
- You want to catch cross-browser issues

**Playwright setup** (if/when needed):

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Testing CodeMirror

CodeMirror 6 presents specific testing challenges because it relies heavily on DOM APIs (`contenteditable`, `ResizeObserver`, etc.). Strategy:

1. **Don't test CodeMirror itself** — it has its own comprehensive test suite
2. **Test your integration layer** — the hooks and components that wrap CodeMirror
3. **Mock CodeMirror where needed** — for component tests, mock the editor creation
4. **Use `@codemirror/toolkit` test helpers** if writing extension tests

Example test for an editor component:

```typescript
// src/components/Editor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from './Editor';

// Mock the lazy-loaded CodeMirror
vi.mock('./CodeMirrorEditor', () => ({
  default: () => <div data-testid="codemirror-mock" />,
}));

describe('Editor', () => {
  it('renders loading skeleton while CodeMirror loads', () => {
    render(<Editor />);
    // Skeleton should appear immediately
    expect(screen.getByTestId('editor-skeleton')).toBeInTheDocument();
  });
});
```

---

## 6. Linting & Formatting

### ESLint Flat Config (`eslint.config.js`)

ESLint 9+ uses the "flat config" format. No more `.eslintrc.*` files.

```javascript
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'coverage/**',
    ],
  },

  // Base TypeScript config
  ...tseslint.configs.strictTypeChecked,

  // React-specific config
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off', // TypeScript handles this

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // React Refresh — warn on non-component exports from component files
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript-specific overrides
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  }
);
```

### Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Prettier Ignore (`.prettierignore`)

```
dist
node_modules
coverage
*.min.js
*.min.css
```

### Tailwind CSS Class Sorting

The `prettier-plugin-tailwindcss` plugin automatically sorts Tailwind CSS classes in your JSX/HTML according to the recommended order. This eliminates merge conflicts and makes class strings readable.

**Before**:
```tsx
<div className="text-red-500 hover:bg-blue-200 p-4 flex items-center justify-center">
```

**After** (auto-sorted):
```tsx
<div className="flex items-center justify-center p-4 text-red-500 hover:bg-blue-200">
```

The sort order follows Tailwind's official recommendation: layout → spacing → sizing → typography → backgrounds → borders → effects → transitions → interactivity.

**Important for Tailwind v4**: The plugin `prettier-plugin-tailwindcss@0.6.x` supports Tailwind CSS v4. Make sure you're on at least version `0.6.0` for v4 compatibility.

### Pre-commit Hook (via `simple-git-hooks` + `lint-staged`)

Add to `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,json,md}": [
      "prettier --write"
    ]
  }
}
```

Install with: `npx simple-git-hooks`

---

## 7. Production Optimizations

### Code Splitting Strategy

The production bundle is split into carefully designed chunks for optimal caching and loading:

```
dist/
├── assets/
│   ├── js/
│   │   ├── index-[hash].js              # App entry (~5-10KB)
│   │   ├── vendor-react-[hash].js       # React + ReactDOM (~45KB gzip)
│   │   ├── vendor-codemirror-[hash].js  # CodeMirror + Lezer (~120-180KB gzip)
│   │   ├── vendor-[hash].js             # Other dependencies (~10-20KB gzip)
│   │   ├── Editor-[hash].js             # Editor page (lazy loaded, ~2-5KB gzip)
│   │   └── ...other route chunks
│   ├── css/
│   │   ├── index-[hash].css             # Main styles
│   │   └── vendor-codemirror-[hash].css # CodeMirror themes/styles
│   ├── images/
│   └── fonts/
├── index.html
├── 404.html  # SPA fallback
└── CNAME     # (if custom domain)
```

### Chunk Loading Strategy

```
Initial Load (page shell):
  ├── index-[hash].js        (entry point)
  ├── vendor-react-[hash].js (React runtime)
  ├── vendor-[hash].js       (other vendor)
  └── index-[hash].css       (critical CSS)
  Total: ~70-80KB gzip
  Time: <1s on 3G

After user navigates to editor:
  ├── vendor-codemirror-[hash].js  (lazy loaded)
  ├── Editor-[hash].js             (lazy loaded)
  └── vendor-codemirror-[hash].css (lazy loaded)
  Total additional: ~120-180KB gzip
  Time: ~1-2s on 3G
```

### Lazy Loading CodeMirror

```typescript
// src/components/CodeMirrorEditor.tsx
// This entire component (and all its CodeMirror imports) becomes a separate chunk
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEffect, useRef } from 'react';

interface CodeMirrorEditorProps {
  value: string;
  language: 'html' | 'css' | 'javascript';
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
}

export default function CodeMirrorEditor({
  value,
  language,
  onChange,
  theme = 'dark',
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (!editorRef.current) return;

    const langExtensions = {
      html: html(),
      css: css(),
      javascript: javascript(),
    };

    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        langExtensions[language],
        theme === 'dark' ? oneDark : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
      parent: editorRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
  }, [language, theme]); // Re-create on language/theme change

  // Update document when value changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={editorRef} className="h-full w-full" />;
}
```

### Gzip/Brotli Compression

GitHub Pages does **not** support pre-compressed files (it doesn't serve `.br` or `.gz` files even if they exist). However, GitHub Pages does perform **on-the-fly gzip compression** for text-based assets. So you don't need to worry about compression for GitHub Pages.

If you later move to a hosting provider that supports pre-compressed files (Netlify, Vercel, Cloudflare Pages), add:

```typescript
// vite.config.ts — optional compression plugin
import viteCompression from 'vite-plugin-compression';

// In plugins array (only for non-GitHub Pages deployments):
process.env.ENABLE_COMPRESSION && viteCompression({
  algorithm: 'brotliCompress',
  threshold: 1024, // Only compress files > 1KB
  deleteOriginFile: false,
}),
```

### Asset Hashing

Vite already handles content hashing by default. File names like `vendor-react-Cz4Vq8nK.js` contain an 8-character hash derived from the file content. This means:

- **Perfect cache busting**: When React updates, the hash changes → CDN/browser fetches the new file
- **Long cache lifetimes**: Set `Cache-Control: max-age=31536000, immutable` on hashed assets
- **GitHub Pages sets reasonable defaults**: It adds `Cache-Control: max-age=600` for HTML and longer for assets

### Source Maps in Production

**Recommendation: Enable source maps in production** via `sourcemap: true` in `vite.config.ts`.

Why:
- Source maps are only downloaded when DevTools is open
- They don't affect performance for end users
- They're invaluable for debugging production issues
- GitHub Pages doesn't expose source maps to search engines (they're `.map` files)

If you're concerned about proprietary code, add this to `.gitignore`:
```
dist/**/*.map
```

And add a deploy step to strip source maps:
```yaml
- name: Remove source maps
  run: find dist -name '*.map' -delete
```

---

## 8. GitHub Pages Specifics

### The SPA Routing Problem

**The core issue**: GitHub Pages serves static files. When a user navigates to `/LiveFrame/editor` and refreshes, GitHub Pages looks for `/LiveFrame/editor/index.html` or `/LiveFrame/editor.html`. Neither exists → **404 error**.

Since LiveFrame is a single-page application, all routes should serve `index.html` and let the client-side router handle routing.

### Solution 1: The `404.html` Trick (Recommended)

GitHub Pages has a special behavior: when a 404 occurs, it serves `404.html` from the root if it exists. By making `404.html` identical to `index.html`, we effectively serve the SPA for all routes.

**Deploy step**:
```yaml
- name: Add 404.html for SPA routing
  run: cp dist/index.html dist/404.html
```

This is the simplest and most reliable solution. It works for all GitHub Pages configurations (username.github.io or username.github.io/repo-name).

### Solution 2: Script-Based Path Redirect

For extra robustness, add this script to `index.html` (and `404.html`):

```html
<!-- Single Page Apps for GitHub Pages — MIT License -->
<!-- https://github.com/rafrex/spa-github-pages -->
<script>
  // Single Page Apps for GitHub Pages
  // MIT License — https://github.com/rafrex/spa-github-pages
  // This script takes the current URL and converts the path and query
  // string into just a query string, and then redirects the browser
  // to the new URL with only a query string and hash fragment.
  // For example: https://www.example.com/foo/bar?baz=qux#quux
  // Becomes: https://www.example.com/?/foo/bar&baz=qux#quux
  (function() {
    var redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect != location.href) {
      history.replaceState(null, null, redirect);
    }
  })();
</script>
```

**For LiveFrame, Solution 1 alone is sufficient** since the app likely has minimal routing (it's a single editor page). If you add multiple routes in the future, consider Solution 2 as a fallback.

### CNAME Setup

If you want a custom domain (e.g., `liveframe.dev`):

1. **Create `public/CNAME`**:
```
liveframe.dev
```

2. **Configure DNS** with your domain registrar:
   - Add a CNAME record pointing `liveframe.dev` → `<username>.github.io`
   - Or add A records pointing to GitHub's IP addresses:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`

3. **Update base path**: With a custom domain, the base path becomes `/`:
   ```env
   # .env.production
   VITE_BASE_PATH=/
   ```

4. **Enable HTTPS** in GitHub repo settings → Pages → Enforce HTTPS

5. **Protect CNAME in deploy workflow**:
   ```yaml
   - name: Deploy to GitHub Pages
     uses: JamesIves/github-pages-deploy-action@v4
     with:
       folder: dist
       branch: gh-pages
       clean: true
       clean-exclude: |
         CNAME
   ```

### Base Path Configuration Summary

| Scenario | `VITE_BASE_PATH` | How to Set |
|----------|-------------------|------------|
| Local dev | `/` | `.env.development` |
| GitHub Pages (default) | `/LiveFrame/` | `.env.production` or CI dynamic |
| GitHub Pages (custom domain) | `/` | `.env.production` |
| Fork with different repo name | `/<repo-name>/` | CI dynamic via `${{ github.event.repository.name }}` |

### Environment-Based Base Path in Code

For runtime assets or links that need the base path:

```typescript
// src/lib/basePath.ts
export function getBasePath(): string {
  // Vite replaces import.meta.env.BASE_URL at build time
  return import.meta.env.BASE_URL;
}

export function withBasePath(path: string): string {
  const base = getBasePath();
  // Ensure no double slashes
  return `${base}${path}`.replace(/\/+/g, '/');
}
```

Usage:
```typescript
// For image assets in public/
<img src={withBasePath('favicon.ico')} />

// For programmatic navigation
window.location.href = withBasePath('some-path');
```

**Note**: For static imports and Vite-processed assets, you don't need `withBasePath`. Vite automatically handles the `base` config for:
- `<script>` tags in `index.html`
- `import` statements for JS/CSS
- `url()` references in CSS
- Assets imported via `?url` or `?raw`

---

## 9. CI/CD Edge Cases

### PR Workflow Behavior

```
Feature Branch PR → main
    │
    ├── CI Workflow fires ✅
    │   ├── Type checking
    │   ├── Linting
    │   ├── Tests
    │   └── Build verification
    │
    └── Deploy Workflow does NOT fire ❌ (correct)
        (workflow_run only triggers on main branch CI)
```

This is exactly the right behavior. PRs should validate code quality without deploying.

### Failed CI → No Deploy

```
Push to main
    │
    ├── CI Workflow fires
    │   ├── Type checking ✅
    │   ├── Linting ✅
    │   └── Tests FAIL ❌
    │       conclusion: "failure"
    │
    └── Deploy Workflow
        condition: conclusion == 'success'
        Result: SKIPPED ✅ (correct — broken code is not deployed)
```

### Caching Strategies

#### npm Cache (via `actions/setup-node`)

The `cache: 'npm'` parameter in `actions/setup-node@v4` caches the `~/.npm` directory, which stores the npm cache. This means `npm ci` can resolve packages from cache instead of the registry.

**Expected speedup**: 10-30 seconds per CI run.

#### Vite Build Cache

Vite uses Rollup's cache directory (default: `node_modules/.vite`). However, in CI, we intentionally don't cache this because:

1. `npm ci` deletes `node_modules` and reinstalls from scratch
2. The Vite cache would be invalidated by `npm ci` anyway
3. Build reproducibility is more important than speed in CI
4. The build is already fast (~10-20s for a project this size)

If you want to cache the Vite build output for faster deploys:

```yaml
# In deploy workflow — cache dist/ between deploys (optional)
- name: Cache build output
  uses: actions/cache@v4
  with:
    path: dist
    key: build-${{ github.sha }}
    restore-keys: |
      build-
```

This is generally **not recommended** — the build is fast, and caching adds complexity.

#### Vitest Cache

Vitest can cache test results for faster re-runs:

```yaml
- name: Cache vitest
  uses: actions/cache@v4
  with:
    path: node_modules/.vitest
    key: vitest-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

Again, for a project this size, the speedup is minimal.

### Full Optimized CI Workflow with Caching

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-node-modules
        with:
          path: node_modules
          key: node-modules-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies
        if: steps.cache-node-modules.outputs.cache-hit != 'true'
        run: npm ci

      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build

      - name: Upload build artifact
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 1
```

### Handling Flaky Tests

If tests become flaky, add retry logic:

```yaml
- name: Run tests
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 5
    max_attempts: 3
    command: npm test
```

### Concurrency Control

Prevent duplicate CI runs on the same branch:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

This cancels in-progress CI runs when a new push arrives. For the deploy workflow:

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false  # Never cancel a deploy in progress
```

### Complete CI/CD Workflows (Final Version)

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build
```

#### `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  workflow_run:
    workflows: ["CI"]
    branches: [main]
    types: [completed]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Configure base path
        run: |
          REPO_NAME="${{ github.event.repository.name }}"
          echo "VITE_BASE_PATH=/${REPO_NAME}/" >> .env.production
          echo "Configured VITE_BASE_PATH=/${REPO_NAME}/"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Add 404.html for SPA routing
        run: cp dist/index.html dist/404.html

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist
          branch: gh-pages
          clean: true
          clean-exclude: |
            CNAME
```

---

## 10. Local Development Experience

### Dev Server Configuration

The Vite dev server is configured in `vite.config.ts`:

```typescript
server: {
  port: 3000,
  host: '0.0.0.0',  // Accessible on LAN (for mobile testing)
  open: true,        // Auto-open browser on start
  // HMR is enabled by default in dev mode
  hmr: {
    overlay: true,   // Show error overlay in browser
  },
  // File system restrictions
  fs: {
    strict: true,
    allow: ['.'],     // Only serve files from project root
  },
},
```

### HMR (Hot Module Replacement)

Vite's HMR works out of the box for React via `@vitejs/plugin-react`. It supports:

- **React Fast Refresh**: Component state is preserved when editing component files
- **CSS HMR**: Style changes appear instantly without page reload
- **Preserved state**: Local component state survives HMR updates

For CodeMirror, HMR has a known limitation: the editor instance must be recreated when its module changes. The `useEffect` cleanup in `CodeMirrorEditor.tsx` handles this by calling `view.destroy()` on unmount.

### VS Code Configuration

#### `.vscode/settings.json`

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,

  // ESLint
  "eslint.validate": ["typescript", "typescriptreact"],
  "eslint.useFlatConfig": true,

  // Prettier
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnPaste": false,

  // Tailwind CSS
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },

  // File associations
  "files.associations": {
    "*.css": "tailwindcss"
  },

  // Emmet
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },

  // Search exclusions
  "search.exclude": {
    "dist": true,
    "node_modules": true,
    "coverage": true
  },

  // File nesting
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.patterns": {
    "*.ts": "${capture}.test.ts, ${capture}.spec.ts",
    "*.tsx": "${capture}.test.tsx, ${capture}.spec.tsx",
    "package.json": ".env*, package-lock.json, .prettierrc, .eslintrc"
  }
}
```

#### `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug in Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug in Firefox",
      "type": "firefox",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src",
      "pathMappings": [
        {
          "url": "webpack:///./src/",
          "path": "${webRoot}/"
        }
      ]
    }
  ]
}
```

#### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer",
    "ms-vscode.js-debug",
    "usernamehw.errorlens",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Recommended VS Code Extensions

| Extension | Purpose | Required |
|-----------|---------|----------|
| ESLint (`dbaeumer.vscode-eslint`) | Real-time linting | Yes |
| Prettier (`esbenp.prettier-vscode`) | Auto-formatting on save | Yes |
| Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`) | Class autocomplete, linting | Yes |
| Vitest (`vitest.explorer`) | Test explorer in sidebar | Recommended |
| Error Lens (`usernamehw.errorlens`) | Inline error display | Recommended |
| Code Spell Checker (`streetsidesoftware.code-spell-checker`) | Spell check in code | Optional |

### Debugging Tips

1. **React DevTools**: Install the React Developer Tools browser extension. It works with Vite's dev server out of the box.

2. **Source Maps**: Vite generates source maps by default in dev mode. Set `"sourceMaps": true` in `launch.json` and breakpoints will map correctly.

3. **Console Logging**: Use `console.log` freely in dev — Vite's HMR preserves logs. For production, consider a logging library like `loglevel` that can be disabled.

4. **Network Tab**: Vite serves files as native ESM. In the browser DevTools Network tab, you'll see individual module requests in dev and bundled files in production.

5. **Performance Profiling**: Use the Performance tab in React DevTools to identify unnecessary re-renders. For CodeMirror, profile the `dispatch` calls to ensure document updates aren't triggering excessive re-renders.

### `.gitignore`

```
# Dependencies
node_modules/

# Build output
dist/

# Environment files
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/launch.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.log
npm-debug.log*
```

---

## Appendix: Quick-Start Commands

```bash
# Create the project from scratch
npm create vite@latest liveframe -- --template react-ts
cd liveframe

# Install dependencies
npm install

# Install CodeMirror
npm install codemirror @codemirror/lang-html @codemirror/lang-css @codemirror/lang-javascript @codemirror/theme-one-dark

# Install Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Install dev dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 @vitest/ui
npm install -D eslint typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
npm install -D prettier prettier-plugin-tailwindcss
npm install -D simple-git-hooks lint-staged

# Start development
npm run dev

# Run all checks
npm run check-all
```

---

## Appendix: Architecture Decision Records

### ADR-001: Use `workflow_run` for CI/CD Decoupling

**Status**: Accepted

**Context**: We need CI on all PRs and pushes, but deployment only on main branch pushes after CI passes.

**Decision**: Use a two-workflow pattern with `workflow_run` trigger.

**Consequences**:
- ✅ Clean separation of concerns (CI validates, Deploy ships)
- ✅ Deploy only runs after CI succeeds (impossible to deploy broken code)
- ✅ PRs never trigger deploys
- ❌ Deploy workflow re-runs build (30-60s overhead)
- ❌ No artifact sharing between workflows (intentional — for reproducibility)
- ❌ `workflow_run` has no UI indication in the PR that deploy will happen

### ADR-002: Lazy-Load CodeMirror

**Status**: Accepted

**Context**: CodeMirror is ~500KB minified. Loading it eagerly blocks the initial page render.

**Decision**: Use `React.lazy()` + `Suspense` to load CodeMirror only when the editor component mounts.

**Consequences**:
- ✅ Initial bundle is ~70-80KB gzip (without CodeMirror)
- ✅ Faster Time to Interactive (TTI)
- ✅ Users who don't use the editor (unlikely but possible) never download CodeMirror
- ❌ Brief loading state when editor first renders
- ❌ Slightly more complex component architecture

### ADR-003: Separate CodeMirror into its Own Chunk

**Status**: Accepted

**Context**: CodeMirror + Lezer parsers weigh ~120-180KB gzip. Including them in `vendor` would bloat the generic vendor chunk.

**Decision**: Use `manualChunks` to split CodeMirror into `vendor-codemirror` chunk.

**Consequences**:
- ✅ Cache isolation: app code changes don't invalidate CodeMirror cache
- ✅ Can be lazy-loaded independently
- ✅ Clearer bundle analysis
- ❌ One extra HTTP request when loading the editor
- ❌ Must ensure all `@codemirror/*` and `@lezer/*` packages are in the same chunk

### ADR-004: Dynamic Base Path via Environment Variable

**Status**: Accepted

**Context**: GitHub Pages serves at `/<repo-name>/` by default. The base path must be configured correctly for assets to load.

**Decision**: Use `VITE_BASE_PATH` environment variable, dynamically set in CI.

**Consequences**:
- ✅ Zero-config for forks (auto-detects repo name)
- ✅ Custom domain support (set to `/`)
- ✅ Local dev always uses `/`
- ❌ Must remember to set `VITE_BASE_PATH` when building manually
- ❌ `.env.production` must be correct or assets will 404

---

*End of Report*
