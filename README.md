# LiveFrame

**Instant Browser Editor** — Write HTML, CSS, and JavaScript and see the results in real-time.

## Features

- **Real-time code editor** with CodeMirror 6 (syntax highlighting, Emmet, autocomplete)
- **Live preview** via sandboxed iframe with srcdoc assembly
- **Single-file mode** — HTML/CSS/JS tabs, like CodePen
- **Console capture** — Display `console.log/warn/error/info` from preview
- **Error overlay** — Show runtime JavaScript errors on the preview
- **Dark/Light/System theme** — Full theme toggle for both UI and editor
- **Resizable split panes** — Drag to resize vertically and horizontally
- **Responsive device frames** — Preview in simulated phone/tablet/desktop viewports
- **Auto-refresh with debounce** — Preview updates as you type (400ms debounce) or manual refresh

## Tech Stack

| Category | Technology |
|----------|-----------|
| UI Framework | React 19 |
| Build Tool | Vite 6 |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Code Editor | CodeMirror 6 |
| State Management | Zustand 5 |
| Icons | lucide-react |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── layout/       # App layout, single-file layout, resize handle
│   ├── editor/       # CodeMirror editor, tabs, skeleton
│   ├── preview/      # Preview iframe, device frames, error overlay
│   ├── console/      # Console panel with entries
│   └── toolbar/      # Toolbar, refresh controls, theme toggle
├── stores/           # Zustand stores (editor, UI, layout)
├── hooks/            # Custom hooks (theme, auto-refresh)
├── utils/            # Utility functions (preview builder)
└── types.ts          # Shared TypeScript types
```

## Deployment

LiveFrame deploys to GitHub Pages via GitHub Actions. Push to `main` to trigger auto-deployment.

The app will be available at: `https://bilkochal.github.io/LiveFrame/`

## License

Apache-2.0
