# LiveFrame — UI/UX & Layout Architecture Report

> **Project**: LiveFrame — Browser-based HTML/CSS/JS code editor with live preview  
> **Stack**: React + Vite + TypeScript + Tailwind CSS 4 + CodeMirror 6 + Zustand + shadcn/ui  
> **Author**: UI/UX & Layout Architect Sub-Agent  
> **Date**: 2025-03-04

---

## Table of Contents

1. [Layout Architecture](#1-layout-architecture)
2. [Main Layout Compositions](#2-main-layout-compositions)
3. [Tab Navigation](#3-tab-navigation)
4. [Dark/Light Theme System](#4-darklight-theme-system)
5. [Console Panel](#5-console-panel)
6. [Toolbar Design](#6-toolbar-design)
7. [Responsive Device Frames](#7-responsive-device-frames)
8. [shadcn/ui Component Selection](#8-shadcnui-component-selection)
9. [Mobile/Responsive Considerations](#9-mobileresponsive-considerations)
10. [Accessibility](#10-accessibility)

---

## 1. Layout Architecture

### 1.1 Library Recommendation: `react-resizable-panels`

After evaluating `react-resizable-panels` (by Brian Vaughn) and `allotment` (by John Walley), **`react-resizable-panels` is the recommended choice** for LiveFrame. Here's the rationale:

| Criterion | react-resizable-panels | allotment |
|---|---|---|
| Bundle size | ~8 kB gzipped | ~18 kB gzipped |
| Persistence | Built-in `autoSaveId` | Manual `onVisibleChange` + localStorage |
| Collapse/Expand | Imperative API (`ref.collapse()`, `ref.expand()`) | `visible` prop but less ergonomic |
| Keyboard support | Arrow keys for resizing | Arrow keys for resizing |
| Touch support | Built-in | Built-in |
| Nested groups | Fully supported (flex-based) | Supported but less battle-tested |
| Active maintenance | Very active (v3.x) | Moderate |
| API simplicity | Declarative, minimal | Slightly more verbose |

**Key advantages of `react-resizable-panels` for LiveFrame:**
- **`autoSaveId`**: Automatically persists panel sizes to `localStorage` — critical for remembering user layout preferences across sessions.
- **Imperative API**: `PanelAPI` exposes `collapse()`, `expand()`, `resize()`, `getSize()`, `isCollapsed()` — essential for programmatic panel toggling (e.g., hiding the console with a keyboard shortcut).
- **Conditional panels**: Panels can be conditionally rendered without breaking the layout system, which is necessary for switching between single-file and project modes.
- **`onResize` callback**: Enables reacting to size changes in real-time (e.g., resizing the CodeMirror editor when the panel resizes).

### 1.2 Core Panel Components

```tsx
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
```

**Three component primitives:**

1. **`PanelGroup`** — Container that wraps a set of resizable `Panel` components. Direction can be `"horizontal"` or `"vertical"`. Supports `autoSaveId` for persistence.

2. **`Panel`** — Individual panel within a group. Key props: `defaultSize`, `minSize`, `maxSize`, `collapsible`, `collapsedSize`, `onCollapse`, `onExpand`, `order`, `ref` (for imperative API).

3. **`PanelResizeHandle`** — The draggable divider between panels. Supports `disabled`, `hitAreaMargins`, custom styling, and `onDragging` callback.

### 1.3 Layout Architecture Design

The overall layout is a nested `PanelGroup` structure:

```
┌─────────────────────── LiveFrame Root ───────────────────────┐
│  PanelGroup direction="vertical" autoSaveId="liveframe-root" │
│                                                               │
│  ┌─────────────────── TOP AREA (75%) ────────────────────┐   │
│  │  PanelGroup direction="horizontal"                     │   │
│  │  autoSaveId="liveframe-top"                            │   │
│  │                                                        │   │
│  │  ┌──────────┐ ║ ┌──────────┐ ║ ┌──────────┐         │   │
│  │  │ File Tree │ ║ │  Editor  │ ║ │ Preview  │         │   │
│  │  │  Panel   │ ║ │  Panel   │ ║ │  Panel   │         │   │
│  │  │ (0-25%)  │ ║ │ (25-60%) │ ║ │ (25-75%) │         │   │
│  │  └──────────┘ ║ └──────────┘ ║ └──────────┘         │   │
│  │                  ResizeHandles (║)                      │   │
│  └────────────────────────────────────────────────────────┘   │
│  ══════════════════ ResizeHandle (═) ═══════════════════════  │
│  ┌─────────────────── BOTTOM AREA (25%) ─────────────────┐   │
│  │  Console Panel (collapsible)                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 1.4 Default Layout Proportions

```typescript
// stores/layoutStore.ts
interface LayoutDefaults {
  // Single-file mode (no file tree)
  singleFile: {
    editor: 50;      // 50% of horizontal space
    preview: 50;     // 50% of horizontal space
    topArea: 72;     // 72% of vertical space
    console: 28;     // 28% of vertical space
  };
  // Project mode (with file tree)
  project: {
    fileTree: 18;    // 18% of horizontal space
    editor: 41;      // 41% of horizontal space
    preview: 41;     // 41% of horizontal space
    topArea: 72;     // 72% of vertical space
    console: 28;     // 28% of vertical space
  };
}
```

### 1.5 Panel Collapse/Expand Behavior

Each panel supports collapse with these configurations:

```tsx
<Panel
  ref={consolePanelRef}
  defaultSize={28}
  minSize={5}
  maxSize={50}
  collapsible={true}
  collapsedSize={0}
  onCollapse={() => setConsoleVisible(false)}
  onExpand={() => setConsoleVisible(true)}
>
  <ConsolePanel />
</Panel>
```

**Keyboard shortcuts for panel control:**

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + J` | Toggle console panel |
| `Ctrl/Cmd + B` | Toggle file tree (project mode) |
| `Ctrl/Cmd + Shift + E` | Focus editor panel |
| `Ctrl/Cmd + Shift + P` | Focus preview panel |

### 1.6 Layout Persistence

`react-resizable-panels` provides built-in persistence via `autoSaveId`:

```tsx
<PanelGroup
  direction="vertical"
  autoSaveId="liveframe-root"
  // This automatically saves/restores panel sizes to localStorage
  // Key format: "react-resizable-panels:liveframe-root"
>
```

**Additional persistence with Zustand:**

```typescript
// stores/layoutStore.ts
interface LayoutState {
  mode: 'single' | 'project';
  consoleVisible: boolean;
  fileTreeVisible: boolean;
  previewDevice: string;
  // Panel sizes are handled by react-resizable-panels autoSaveId,
  // but we store visibility toggles and mode in Zustand
  setMode: (mode: 'single' | 'project') => void;
  toggleConsole: () => void;
  toggleFileTree: () => void;
}

const useLayoutStore = create<LayoutState>((set) => ({
  mode: 'single',
  consoleVisible: true,
  fileTreeVisible: true,
  previewDevice: 'responsive',
  setMode: (mode) => set({ mode }),
  toggleConsole: () => set((s) => ({ consoleVisible: !s.consoleVisible })),
  toggleFileTree: () => set((s) => ({ fileTreeVisible: !s.fileTreeVisible })),
}));
```

The `autoSaveId` approach is used for exact pixel/percentage persistence, while Zustand stores logical state (visibility, mode). When switching modes, we use the imperative `PanelAPI.resize()` method to apply the appropriate default sizes.

### 1.7 Resize Handle Design

Custom resize handles provide visual affordance and hover/active states:

```tsx
function ResizeHandle({
  direction = "horizontal",
  id,
}: {
  direction?: "horizontal" | "vertical";
  id: string;
}) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative flex items-center justify-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        direction === "horizontal"
          ? "w-px bg-border hover:w-1.5 hover:bg-primary/30 active:bg-primary/50 transition-all"
          : "h-px bg-border hover:h-1.5 hover:bg-primary/30 active:bg-primary/50 transition-all"
      )}
      id={id}
    >
      <div
        className={cn(
          "rounded-full bg-transparent group-hover:bg-muted-foreground/40",
          "transition-colors",
          direction === "horizontal"
            ? "h-8 w-1"
            : "h-1 w-8"
        )}
      />
    </PanelResizeHandle>
  );
}
```

The resize handle has three visual states:
- **Default**: 1px line using `bg-border` — nearly invisible, doesn't distract
- **Hover**: Widens to 6px with `bg-primary/30` — clear interactive affordance
- **Active/Dragging**: `bg-primary/50` with slight opacity increase — feedback during drag

---

## 2. Main Layout Compositions

### 2.1 Single-File Mode

In single-file mode, the user edits HTML, CSS, and JS in a tabbed editor (not separate panels) alongside a live preview panel. The console sits below.

```
┌─────────────────────────────────────────────────────────────────┐
│ ● LiveFrame    [Single ▾]  [↻ Auto] [🔄] [📱 Responsive ▾]   │
│                                    [🌙] [⚙️]                    │
├─────────────────────────────────┬───────────────────────────────┤
│  [HTML] [CSS] [JS]    ×    +   │                               │
│ ┌─────────────────────────────┐ │                               │
│ │ <!DOCTYPE html>             │ │     Live Preview              │
│ │ <html>                      │ │     (iframe)                  │
│ │   <head>                    │ │                               │
│ │     <style>                 │ │                               │
│ │       body { ... }          │ │                               │
│ │     </style>                │ │                               │
│ │   </head>                   │ │                               │
│ │   <body>                    │ │                               │
│ │     <h1>Hello!</h1>         │ │                               │
│ │   </body>                   │ │                               │
│ │ </html>                     │ │                               │
│ │                             │ │                               │
│ │                             │ │                               │
│ └─────────────────────────────┘ │                               │
│                    ║             │                               │
├═══════════════════╩═════════════╧═══════════════════════════════┤
│ Console  [Clear] [Filter ▾] [🔍 Search]              [▲] [▼]  │
│ > "Hello!"                    12:34:05 PM                       │
│ > Uncaught TypeError: ...     12:34:06 PM    (red)              │
│ ⚠ Warning: ...               12:34:07 PM    (yellow)           │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
function SingleFileLayout() {
  const consoleRef = useRef<ImperativePanelHandle>(null);

  return (
    <PanelGroup direction="vertical" autoSaveId="liveframe-single-root">
      <Panel defaultSize={72} minSize={40} order={1}>
        <PanelGroup direction="horizontal" autoSaveId="liveframe-single-top">
          <Panel defaultSize={50} minSize={25} order={1}>
            <EditorPanel />
          </Panel>
          <ResizeHandle direction="horizontal" id="editor-preview-handle" />
          <Panel defaultSize={50} minSize={25} order={2}>
            <PreviewPanel />
          </Panel>
        </PanelGroup>
      </Panel>
      <ResizeHandle direction="vertical" id="top-console-handle" />
      <Panel
        ref={consoleRef}
        defaultSize={28}
        minSize={5}
        maxSize={50}
        collapsible
        collapsedSize={0}
        order={2}
      >
        <ConsolePanel />
      </Panel>
    </PanelGroup>
  );
}
```

### 2.2 Project Mode

In project mode, a file tree is added on the left side, and the editor shows file tabs instead of language tabs.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ● LiveFrame    [Project ▾]  [↻ Auto] [🔄] [📱 Responsive ▾]      │
│   my-project/                               [🌙] [⚙️] [📤 Export] │
├────────────┬────────────────────────┬───────────────────────────────┤
│ EXPLORER   │  [index.html] [style] │                               │
│            │  [css] [×] [+]        │                               │
│ 📁 src/    │ ┌────────────────────┐│     Live Preview              │
│   📄 index │ │ <!DOCTYPE html>    ││     (iframe)                  │
│   📄 style │ │ <html>             ││                               │
│   📄 app.js│ │   <head>           ││                               │
│ 📁 assets/ │ │     <link .../>    ││                               │
│   🖼 img1  │ │   </head>          ││                               │
│ 📄 data.js │ │   <body>           ││                               │
│            │ │     ...            ││                               │
│            │ │   </body>          ││                               │
│            │ │ </html>            ││                               │
│            │ └────────────────────┘│                               │
│     ║      │          ║            │                               │
├─────╨──────┴──────────╨────────────┴───────────────────────────────┤
│ Console  [Clear] [Filter ▾] [🔍 Search]                  [▲] [▼]  │
│ > App initialized              12:34:05 PM                        │
│ > Data loaded: 42 items        12:34:06 PM                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```tsx
function ProjectLayout() {
  const consoleRef = useRef<ImperativePanelHandle>(null);
  const fileTreeRef = useRef<ImperativePanelHandle>(null);

  return (
    <PanelGroup direction="vertical" autoSaveId="liveframe-project-root">
      <Panel defaultSize={72} minSize={40} order={1}>
        <PanelGroup direction="horizontal" autoSaveId="liveframe-project-top">
          <Panel
            ref={fileTreeRef}
            defaultSize={18}
            minSize={12}
            maxSize={30}
            collapsible
            collapsedSize={0}
            order={1}
          >
            <FileTreePanel />
          </Panel>
          <ResizeHandle direction="horizontal" id="tree-editor-handle" />
          <Panel defaultSize={41} minSize={25} order={2}>
            <EditorPanel />
          </Panel>
          <ResizeHandle direction="horizontal" id="editor-preview-handle" />
          <Panel defaultSize={41} minSize={25} order={3}>
            <PreviewPanel />
          </Panel>
        </PanelGroup>
      </Panel>
      <ResizeHandle direction="vertical" id="top-console-handle" />
      <Panel
        ref={consoleRef}
        defaultSize={28}
        minSize={5}
        maxSize={50}
        collapsible
        collapsedSize={0}
        order={2}
      >
        <ConsolePanel />
      </Panel>
    </PanelGroup>
  );
}
```

### 2.3 Mode Switching Strategy

Switching between single-file and project mode requires careful handling:

1. **Save current panel sizes** — Before switching, capture current sizes using `PanelAPI.getSize()` on each panel.
2. **Unmount and remount** — Because `autoSaveId` differs between modes, changing the `autoSaveId` causes the `PanelGroup` to remount and read new stored sizes.
3. **Conditional rendering** — The file tree panel is conditionally rendered based on mode.

```tsx
function LiveFrameLayout() {
  const { mode } = useLayoutStore();

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <div className="flex-1 overflow-hidden">
        {mode === 'single' ? <SingleFileLayout /> : <ProjectLayout />}
      </div>
    </div>
  );
}
```

**Alternative approach — Single layout with conditional panel:**

```tsx
function UnifiedLayout() {
  const { mode, fileTreeVisible } = useLayoutStore();

  return (
    <PanelGroup direction="vertical" autoSaveId="liveframe-root">
      <Panel defaultSize={72} minSize={40} order={1}>
        <PanelGroup direction="horizontal" autoSaveId="liveframe-top">
          {/* File tree - only in project mode */}
          {mode === 'project' && (
            <>
              <Panel
                defaultSize={18}
                minSize={12}
                maxSize={30}
                collapsible
                collapsedSize={0}
                order={1}
              >
                <FileTreePanel />
              </Panel>
              <ResizeHandle direction="horizontal" id="tree-editor" />
            </>
          )}
          <Panel defaultSize={50} minSize={25} order={2}>
            <EditorPanel />
          </Panel>
          <ResizeHandle direction="horizontal" id="editor-preview" />
          <Panel defaultSize={50} minSize={25} order={3}>
            <PreviewPanel />
          </Panel>
        </PanelGroup>
      </Panel>
      <ResizeHandle direction="vertical" id="top-console" />
      <Panel defaultSize={28} minSize={5} maxSize={50} collapsible collapsedSize={0} order={2}>
        <ConsolePanel />
      </Panel>
    </PanelGroup>
  );
}
```

The key challenge with conditional panels is that `react-resizable-panels` automatically redistributes sizes when a panel is removed/added. To preserve sensible proportions, use the `onLayout` callback to set explicit sizes after mode switches:

```tsx
const handleModeSwitch = useCallback(() => {
  // After switching mode, resize panels to desired defaults
  setTimeout(() => {
    if (mode === 'project') {
      editorPanelRef.current?.resize(41);
      previewPanelRef.current?.resize(41);
      fileTreePanelRef.current?.resize(18);
    } else {
      editorPanelRef.current?.resize(50);
      previewPanelRef.current?.resize(50);
    }
  }, 0); // setTimeout ensures DOM is updated
}, [mode]);
```

### 2.4 Root Layout Shell

```tsx
function App() {
  return (
    <ThemeProvider>
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
        {/* Toolbar - fixed height */}
        <Toolbar className="h-12 shrink-0 border-b" />

        {/* Main resizable area - fills remaining space */}
        <main className="flex-1 overflow-hidden">
          <LiveFrameLayout />
        </main>

        {/* Status bar (optional) - fixed height */}
        <StatusBar className="h-6 shrink-0 border-t text-xs" />
      </div>
    </ThemeProvider>
  );
}
```

---

## 3. Tab Navigation

### 3.1 Tab Bar Design

The editor tab bar is inspired by VS Code's tab interface, adapted for both single-file and project modes.

**Single-file mode tabs** — Fixed HTML/CSS/JS language tabs that cannot be closed:

```
┌────────┬────────┬────────┐
│ HTML   │  CSS   │   JS   │
│  ●     │        │        │
└────────┴────────┴────────┘
```

**Project mode tabs** — Dynamic file tabs with close buttons, reordering, and dirty indicators:

```
┌─────────────┬─────────────┬──────────────┬────┐
│ 📄 index.●  │ 📄 style.css│ 📄 app.js ●  │ +  │
│  html       │             │              │    │
│         ×   │         ×   │          ×   │    │
└─────────────┴─────────────┴──────────────┴────┘
```

Where `●` = dirty indicator (unsaved changes), `×` = close button, `+` = new tab button.

### 3.2 Tab Component Architecture

```tsx
// components/EditorTabBar.tsx
function EditorTabBar() {
  const { mode } = useLayoutStore();
  const { tabs, activeTab, setActiveTab, closeTab, reorderTabs } = useEditorStore();

  if (mode === 'single') {
    return <SingleFileTabBar />;
  }
  return <ProjectTabBar />;
}
```

**Single-file tab bar:**

```tsx
function SingleFileTabBar() {
  const { activeLanguageTab, setActiveLanguageTab } = useEditorStore();

  const tabs = [
    { id: 'html', label: 'HTML', icon: <FileCode2 className="h-3.5 w-3.5" /> },
    { id: 'css', label: 'CSS', icon: <Palette className="h-3.5 w-3.5" /> },
    { id: 'javascript', label: 'JS', icon: <Braces className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex items-center h-9 bg-muted/50 border-b px-1 gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveLanguageTab(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium",
            "transition-colors",
            activeLanguageTab === tab.id
              ? "bg-background text-foreground border-t-2 border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

**Project tab bar with drag reordering:**

For drag-to-reorder, we recommend `@dnd-kit/core` + `@dnd-kit/sortable` as it integrates well with React and supports keyboard accessibility:

```tsx
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableTab({ tab, isActive, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm font-medium",
        "cursor-grab active:cursor-grabbing select-none",
        "transition-colors min-w-[100px] max-w-[200px]",
        isActive
          ? "bg-background text-foreground border-t-2 border-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={() => setActiveTab(tab.id)}
    >
      <FileIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{tab.name}</span>
      {tab.dirty && (
        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={cn(
          "ml-auto shrink-0 rounded-sm p-0.5",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-muted-foreground/20"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
```

### 3.3 Tab State Management (Zustand)

```typescript
// stores/editorStore.ts
interface Tab {
  id: string;
  name: string;
  path: string;
  language: 'html' | 'css' | 'javascript' | 'json' | 'markdown';
  dirty: boolean;
  pinned: boolean;
  scrollPosition?: number;
  cursorPosition?: { line: number; col: number };
}

interface EditorState {
  // Single-file mode
  activeLanguageTab: 'html' | 'css' | 'javascript';
  setActiveLanguageTab: (tab: 'html' | 'css' | 'javascript') => void;

  // Project mode
  tabs: Tab[];
  activeTabId: string | null;
  setActiveTab: (id: string) => void;
  openTab: (tab: Omit<Tab, 'dirty' | 'pinned'>) => void;
  closeTab: (id: string) => void;
  reorderTabs: (activeId: string, overId: string) => void;
  markDirty: (id: string) => void;
  markClean: (id: string) => void;
  togglePin: (id: string) => void;

  // Content
  files: Record<string, string>; // path -> content
  updateFile: (path: string, content: string) => void;
}
```

### 3.4 Tab Close Behavior

When closing a tab:

1. **If the tab is dirty**, show a confirmation dialog using shadcn `AlertDialog`.
2. **If the tab is pinned**, require double-click to close (or unpin first).
3. **After closing**, activate the tab to the right, or the left if no right tab exists.
4. **If it's the last tab**, the editor shows an empty state with "Open a file to start editing".

```typescript
closeTab: (id) => set((state) => {
  const tabIndex = state.tabs.findIndex((t) => t.id === id);
  const tab = state.tabs[tabIndex];

  // Don't close pinned tabs without unpinning
  if (tab.pinned) return state;

  const newTabs = state.tabs.filter((t) => t.id !== id);

  // Determine next active tab
  let newActiveId = state.activeTabId;
  if (state.activeTabId === id) {
    if (newTabs.length === 0) {
      newActiveId = null;
    } else if (tabIndex < newTabs.length) {
      newActiveId = newTabs[tabIndex].id;
    } else {
      newActiveId = newTabs[newTabs.length - 1].id;
    }
  }

  return { tabs: newTabs, activeTabId: newActiveId };
});
```

### 3.5 Pinned Tabs

Pinned tabs are visually distinct and locked:

```
┌──────┬──────┬─────────────┬──────────────┬────┐
│ 📌 H │ 📌 C │ 📄 app.js ● │ 📄 utils.js  │ +  │
│ TML  │ SS   │         ×   │          ×   │    │
└──────┴──────┴─────────────┴──────────────┴────┘
```

Pinned tabs are narrower (icon-only or abbreviated), cannot be closed with a single click, and always stay at the left side of the tab bar. The `order` property in `@dnd-kit` sorting ensures pinned tabs maintain their position.

### 3.6 Tab Overflow

When too many tabs are open, the tab bar scrolls horizontally using shadcn `ScrollArea`:

```tsx
<ScrollArea className="flex-1" orientation="horizontal">
  <div className="flex items-center h-full gap-0.5 px-1">
    <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
      {tabs.map((tab) => (
        <SortableTab key={tab.id} tab={tab} ... />
      ))}
    </SortableContext>
  </div>
  <ScrollBar orientation="horizontal" className="h-1.5" />
</ScrollArea>
```

---

## 4. Dark/Light Theme System

### 4.1 Architecture Overview

The theme system uses a CSS variable approach where Tailwind 4's `@theme` directive maps design tokens to CSS custom properties. shadcn/ui components consume these CSS variables. A `.dark` class on the `<html>` element switches between palettes.

**Data flow:**

```
Zustand ThemeStore → <html class="dark|light"> → CSS Variables → Tailwind + shadcn + CodeMirror
```

### 4.2 CSS Variable Definitions (Tailwind 4 + shadcn)

```css
/* index.css — Tailwind v4 + shadcn theming */

@import "tailwindcss";

@theme inline {
  /* Map CSS variables to Tailwind utilities */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;

  /* Custom LiveFrame tokens */
  --editor-bg: oklch(0.985 0 0);
  --editor-gutter: oklch(0.955 0 0);
  --editor-active-line: oklch(0.965 0 0);
  --editor-selection: oklch(0.85 0.05 250);
  --console-bg: oklch(0.97 0 0);
  --preview-bg: oklch(1 0 0);
  --resize-handle: oklch(0.85 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.556 0 0);

  /* Custom LiveFrame dark tokens */
  --editor-bg: oklch(0.165 0 0);
  --editor-gutter: oklch(0.195 0 0);
  --editor-active-line: oklch(0.19 0 0);
  --editor-selection: oklch(0.35 0.08 250);
  --console-bg: oklch(0.155 0 0);
  --preview-bg: oklch(0.145 0 0);
  --resize-handle: oklch(0.3 0 0);
}
```

### 4.3 Theme Store

```typescript
// stores/themeStore.ts
type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const useThemeStore = create<ThemeState>((set) => {
  // Detect system preference
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const systemTheme = mediaQuery.matches ? 'dark' : 'light';

  // Read stored preference
  const storedTheme = localStorage.getItem('liveframe-theme') as Theme | null;
  const initialTheme = storedTheme || 'system';
  const resolved = initialTheme === 'system' ? systemTheme : initialTheme;

  // Apply immediately
  document.documentElement.classList.toggle('dark', resolved === 'dark');

  return {
    theme: initialTheme,
    resolvedTheme: resolved,
    setTheme: (theme) => {
      const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

      document.documentElement.classList.toggle('dark', resolved === 'dark');
      localStorage.setItem('liveframe-theme', theme);
      set({ theme, resolvedTheme: resolved });
    },
  };
});

// Listen for system preference changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const store = useThemeStore.getState();
    if (store.theme === 'system') {
      const resolved = e.matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}
```

### 4.4 CodeMirror 6 Theme Switching

CodeMirror 6 uses a `ThemeExtension` that is completely separate from DOM-based CSS theming. We create two theme extensions and swap them via `EditorView.theme()` + `@codemirror/lang-*` syntax highlighting.

```typescript
// lib/codemirror/themes.ts
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";

// Dark theme (inspired by One Dark Pro)
export const darkTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--foreground)",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--editor-selection) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "var(--accent)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "var(--accent)",
    outline: "1px solid var(--border)",
  },
}, { dark: true });

// Light theme
export const lightTheme = EditorView.theme({
  // Same CSS variable references — they resolve differently based on .dark class
  "&": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--foreground)",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--editor-selection) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
}, { dark: false });
```

**Key insight**: By using CSS custom properties (`var(--editor-bg)`, etc.) inside CodeMirror themes, we avoid having to reconfigure the editor when the theme changes. The CSS variables automatically update when the `.dark` class is toggled on `<html>`, and CodeMirror picks up the new values.

For syntax highlighting, we use `@codemirror/language`'s `highlightStyle` with CSS variable-aware tokens:

```typescript
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const liveframeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
  { tag: tags.typeName, color: "var(--syntax-type)" },
  { tag: tags.operator, color: "var(--syntax-operator)" },
  { tag: tags.tagName, color: "var(--syntax-tag)" },
  { tag: tags.attributeName, color: "var(--syntax-attribute)" },
  { tag: tags.propertyName, color: "var(--syntax-property)" },
]);
```

With corresponding CSS variables for syntax colors in both `:root` and `.dark`:

```css
:root {
  --syntax-keyword: oklch(0.55 0.2 280);
  --syntax-string: oklch(0.5 0.15 150);
  --syntax-number: oklch(0.55 0.2 50);
  --syntax-comment: oklch(0.55 0.02 250);
  --syntax-function: oklch(0.55 0.18 300);
  --syntax-type: oklch(0.55 0.15 200);
  --syntax-operator: oklch(0.5 0.1 30);
  --syntax-tag: oklch(0.5 0.18 20);
  --syntax-attribute: oklch(0.5 0.15 300);
  --syntax-property: oklch(0.5 0.12 250);
}

.dark {
  --syntax-keyword: oklch(0.75 0.18 280);
  --syntax-string: oklch(0.7 0.15 150);
  --syntax-number: oklch(0.75 0.18 50);
  --syntax-comment: oklch(0.55 0.02 250);
  --syntax-function: oklch(0.75 0.15 300);
  --syntax-type: oklch(0.7 0.15 200);
  --syntax-operator: oklch(0.7 0.1 30);
  --syntax-tag: oklch(0.75 0.15 20);
  --syntax-attribute: oklch(0.7 0.12 300);
  --syntax-property: oklch(0.7 0.1 250);
}
```

### 4.5 Theme Toggle Component

```tsx
import { Moon, Sun, Monitor } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const icons = {
    light: <Sun className="h-4 w-4" />,
    dark: <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {icons[theme]}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 5. Console Panel

### 5.1 Panel Layout

The console is a bottom panel within the vertical `PanelGroup`. It contains a header bar with controls and a scrollable message list.

```
┌─────────────────────────────────────────────────────────────────┐
│ Console  [⚠ 3] [✕ 12]  │ [Clear] [Filter ▾] [🔍]  [⏱]  [▼] │
├─────────────────────────────────────────────────────────────────┤
│  ▸ "Hello, World!"                         12:34:05.123 PM     │
│  ▸ Array(3) [1, 2, 3]                     12:34:05.456 PM     │
│  ▸ { name: "LiveFrame", version: "1.0" }   12:34:05.789 PM     │
│  ⚠ Warning: Each child in a list should... 12:34:06.001 PM     │
│  ✕ Uncaught TypeError: Cannot read...      12:34:06.234 PM     │
│  ⓘ Info: Build completed in 245ms          12:34:06.567 PM     │
│  ▸ <div class="container">                 12:34:06.890 PM     │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Console Header Component

```tsx
function ConsoleHeader() {
  const [filter, setFilter] = useState<ConsoleFilter>('all');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex items-center justify-between h-8 px-3 bg-muted/50 border-b text-xs">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">Console</span>
        <Badge variant="destructive" className="h-4 px-1 text-[10px]">
          {errorCount}
        </Badge>
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          {warnCount}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={clearConsole}
        >
          <Ban className="h-3 w-3" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              Filter <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilter('all')}>All</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('log')}>Logs</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('warn')}>Warnings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('error')}>Errors</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('info')}>Info</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 w-32 pl-6 pr-2 rounded bg-background border text-xs"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6", showTimestamps && "bg-accent")}
              onClick={() => setShowTimestamps(!showTimestamps)}
            >
              <Clock className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle timestamps</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
```

### 5.3 Message Types and Styling

Each console message has a type that determines its visual treatment:

| Type | Icon | Color (Light) | Color (Dark) | Prefix |
|---|---|---|---|---|
| `log` | `▸` | Default text | Default text | None |
| `warn` | `⚠` | Amber/yellow bg | Amber/yellow bg | `Warning:` |
| `error` | `✕` | Red text + light red bg | Red text + dark red bg | `Uncaught` |
| `info` | `ⓘ` | Blue text | Blue text | `Info:` |

```tsx
function ConsoleMessage({ message }: { message: ConsoleMessage }) {
  const styles: Record<ConsoleMessageType, string> = {
    log: "text-foreground",
    warn: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30",
    error: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30",
    info: "text-blue-700 dark:text-blue-300",
  };

  return (
    <div className={cn("flex items-start gap-2 px-3 py-1 text-xs font-mono border-b border-border/50", styles[message.type])}>
      <span className="shrink-0 mt-0.5">{getIcon(message.type)}</span>
      <div className="flex-1 min-w-0">
        <ConsoleValue value={message.value} />
      </div>
      {showTimestamps && (
        <span className="shrink-0 text-muted-foreground text-[10px]">
          {formatTimestamp(message.timestamp)}
        </span>
      )}
    </div>
  );
}
```

### 5.4 Value Formatting

Complex JavaScript values need special formatting:

```tsx
function ConsoleValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (value === undefined) return <span className="text-muted-foreground">undefined</span>;
  if (typeof value === 'string') return <span className="text-green-600 dark:text-green-400">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>;

  if (Array.isArray(value)) {
    return (
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 hover:bg-muted px-1 rounded">
          <ChevronRight className="h-3 w-3" />
          <span className="text-muted-foreground">Array({value.length})</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 border-l-2 border-muted pl-2">
          {value.map((item, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground">{i}:</span>
              <ConsoleValue value={item} />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (typeof value === 'object') {
    // Check if it's a DOM element
    if (value instanceof HTMLElement) {
      return (
        <span className="text-purple-600 dark:text-purple-400">
          &lt;{value.tagName.toLowerCase()}&gt;
        </span>
      );
    }

    // Regular object
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 hover:bg-muted px-1 rounded">
          <ChevronRight className="h-3 w-3" />
          <span className="text-muted-foreground">
            {'{'} {entries.length > 2 ? `${entries.length} keys` : entries.map(([k]) => k).join(', ')} {'}'}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 border-l-2 border-muted pl-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="text-blue-600 dark:text-blue-400">{key}:</span>
              <ConsoleValue value={val} />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return <span>{String(value)}</span>;
}
```

### 5.5 Console Store

```typescript
// stores/consoleStore.ts
interface ConsoleMessage {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  value: unknown;
  timestamp: number;
  count: number; // for grouping identical consecutive messages
}

interface ConsoleState {
  messages: ConsoleMessage[];
  filter: 'all' | 'log' | 'warn' | 'error' | 'info';
  searchQuery: string;
  showTimestamps: boolean;
  addMessage: (type: ConsoleMessage['type'], value: unknown) => void;
  clearMessages: () => void;
  setFilter: (filter: ConsoleState['filter']) => void;
  setSearchQuery: (query: string) => void;
  toggleTimestamps: () => void;
  filteredMessages: () => ConsoleMessage[];
}
```

### 5.6 Message Grouping

Identical consecutive messages are grouped to reduce noise (similar to Chrome DevTools):

```typescript
addMessage: (type, value) => set((state) => {
  const lastMsg = state.messages[state.messages.length - 1];
  const valueStr = JSON.stringify(value);

  // If same type and value as last message, increment count
  if (lastMsg && lastMsg.type === type && JSON.stringify(lastMsg.value) === valueStr) {
    const updated = [...state.messages];
    updated[updated.length - 1] = {
      ...lastMsg,
      count: lastMsg.count + 1,
    };
    return { messages: updated };
  }

  return {
    messages: [...state.messages, {
      id: crypto.randomUUID(),
      type,
      value,
      timestamp: Date.now(),
      count: 1,
    }],
  };
});
```

---

## 6. Toolbar Design

### 6.1 Toolbar Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◆ LiveFrame │ [Single ▾] │ [↻ Auto] [🔄] │ [📱 Responsive ▾] │ [🌙] [⚙️] │
└──────────────────────────────────────────────────────────────────────────┘
```

Expanded with all controls:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ◆ LiveFrame  │ [Single-file ▾] │ ↻ Auto │ 🔄 │ [📱 iPhone 14 ▾] │ 🌙 │ [📤 ▾] │ ⚙️ │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Toolbar Component

```tsx
function Toolbar() {
  return (
    <header className="h-12 flex items-center justify-between px-3 border-b bg-background shrink-0">
      {/* Left section: Brand + Mode */}
      <div className="flex items-center gap-3">
        <BrandLogo className="h-6 w-6 text-primary" />
        <span className="font-bold text-sm tracking-tight">LiveFrame</span>
        <Separator orientation="vertical" className="h-5" />
        <ModeSwitcher />
      </div>

      {/* Center section: Refresh controls */}
      <div className="flex items-center gap-2">
        <AutoRefreshToggle />
        <ManualRefreshButton />
        <Separator orientation="vertical" className="h-5" />
        <DeviceSelector />
      </div>

      {/* Right section: Theme + Actions */}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <ExportButton />
        <SettingsButton />
      </div>
    </header>
  );
}
```

### 6.3 Toolbar Components Detail

**Mode Switcher:**

```tsx
function ModeSwitcher() {
  const { mode, setMode } = useLayoutStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          {mode === 'single' ? <FileCode2 className="h-3.5 w-3.5" /> : <FolderTree className="h-3.5 w-3.5" />}
          {mode === 'single' ? 'Single-file' : 'Project'}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setMode('single')}>
          <FileCode2 className="mr-2 h-4 w-4" /> Single-file mode
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode('project')}>
          <FolderTree className="mr-2 h-4 w-4" /> Project mode
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Auto-refresh Toggle:**

```tsx
function AutoRefreshToggle() {
  const { autoRefresh, toggleAutoRefresh } = useEditorStore();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={autoRefresh ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", autoRefresh && "bg-primary/10 text-primary")}
          onClick={toggleAutoRefresh}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", autoRefresh && "animate-spin")} />
          Auto
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF (click to enable)'}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Device Selector:**

```tsx
function DeviceSelector() {
  const { previewDevice, setPreviewDevice } = useLayoutStore();

  const devices = [
    { id: 'responsive', label: 'Responsive', icon: <Maximize2 className="h-3.5 w-3.5" />, width: '100%', height: '100%' },
    { id: 'iphone-se', label: 'iPhone SE', icon: <Smartphone className="h-3.5 w-3.5" />, width: 375, height: 667 },
    { id: 'iphone-14', label: 'iPhone 14', icon: <Smartphone className="h-3.5 w-3.5" />, width: 390, height: 844 },
    { id: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', icon: <Smartphone className="h-3.5 w-3.5" />, width: 430, height: 932 },
    { id: 'ipad', label: 'iPad', icon: <Tablet className="h-3.5 w-3.5" />, width: 768, height: 1024 },
    { id: 'ipad-pro', label: 'iPad Pro 11"', icon: <Tablet className="h-3.5 w-3.5" />, width: 834, height: 1194 },
    { id: 'laptop', label: 'Laptop', icon: <Laptop className="h-3.5 w-3.5" />, width: 1280, height: 800 },
    { id: 'desktop', label: 'Desktop', icon: <Monitor className="h-3.5 w-3.5" />, width: 1920, height: 1080 },
  ];

  const currentDevice = devices.find(d => d.id === previewDevice) || devices[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          {currentDevice.icon}
          {currentDevice.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        {devices.map((device) => (
          <DropdownMenuItem
            key={device.id}
            onClick={() => setPreviewDevice(device.id)}
            className={cn(previewDevice === device.id && "bg-accent")}
          >
            {device.icon}
            <span className="ml-2 flex-1">{device.label}</span>
            <span className="text-muted-foreground text-xs">
              {device.width}×{device.height}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {/* Open custom size dialog */}}>
          <Settings2 className="mr-2 h-4 w-4" /> Custom size...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Export Button:**

```tsx
function ExportButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <FileCode className="mr-2 h-4 w-4" /> Export HTML
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FileArchive className="mr-2 h-4 w-4" /> Export as ZIP
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Share2 className="mr-2 h-4 w-4" /> Copy shareable link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 6.4 Toolbar Responsive Behavior

On narrower screens, the toolbar collapses secondary actions into a "More" menu:

```tsx
function Toolbar() {
  const isCompact = useMediaQuery('(max-width: 768px)');

  return (
    <header className="h-12 flex items-center justify-between px-3 border-b bg-background shrink-0">
      <div className="flex items-center gap-2">
        <BrandLogo className="h-5 w-5 text-primary" />
        {!isCompact && <span className="font-bold text-sm">LiveFrame</span>}
        <ModeSwitcher />
      </div>

      {!isCompact && (
        <div className="flex items-center gap-2">
          <AutoRefreshToggle />
          <ManualRefreshButton />
          <Separator orientation="vertical" className="h-5" />
          <DeviceSelector />
        </div>
      )}

      <div className="flex items-center gap-1">
        {isCompact && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Auto-refresh</DropdownMenuItem>
              <DropdownMenuItem>Refresh</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Device</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {/* Device options */}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Export</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeToggle />
        {!isCompact && <ExportButton />}
        <SettingsButton />
      </div>
    </header>
  );
}
```

---

## 7. Responsive Device Frames

### 7.1 Device Frame Preview

The preview panel contains an iframe that can optionally be sized to match specific device dimensions, with an optional visual device frame overlay.

```
Preview Panel (with iPhone frame):
┌─────────────────────────────────────────────┐
│                                             │
│        ┌─────────────────────┐              │
│        │    ╔═════════════╗  │              │
│        │    ║             ║  │              │
│        │    ║   iframe    ║  │              │
│        │    ║  390 × 844  ║  │              │
│        │    ║             ║  │              │
│        │    ║             ║  │              │
│        │    ╚═════════════╝  │              │
│        │    ○               │              │
│        └─────────────────────┘              │
│                                             │
└─────────────────────────────────────────────┘
```

### 7.2 Device Frame Component

```tsx
interface DeviceFrameProps {
  device: DevicePreset;
  children: React.ReactNode; // The iframe
  showFrame: boolean;
}

function DeviceFrame({ device, children, showFrame }: DeviceFrameProps) {
  if (!showFrame || device.id === 'responsive') {
    return <div className="w-full h-full">{children}</div>;
  }

  const { width, height, type } = device;

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/30 overflow-auto p-4">
      <div
        className={cn(
          "relative flex flex-col",
          type === 'phone' && "rounded-[40px] border-[8px] border-foreground/80 shadow-2xl",
          type === 'tablet' && "rounded-[20px] border-[6px] border-foreground/80 shadow-2xl",
          type === 'laptop' && "rounded-t-[8px] border-[4px] border-foreground/80 border-b-0 shadow-2xl",
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Status bar (optional) */}
        {type === 'phone' && (
          <div className="h-8 bg-foreground/5 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
            9:41
          </div>
        )}

        {/* The iframe */}
        <div className="flex-1 overflow-hidden bg-white">
          {children}
        </div>

        {/* Home indicator for phones */}
        {type === 'phone' && (
          <div className="h-6 flex items-center justify-center shrink-0">
            <div className="w-24 h-1 rounded-full bg-foreground/30" />
          </div>
        )}
      </div>

      {/* Laptop base */}
      {type === 'laptop' && (
        <div className="w-[calc(100%+40px)] h-3 bg-foreground/80 rounded-b-lg mx-auto">
          <div className="w-16 h-1 bg-foreground/60 rounded-full mx-auto mt-1" />
        </div>
      )}
    </div>
  );
}
```

### 7.3 Preview Iframe Implementation

```tsx
function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { previewDevice, showDeviceFrame } = useLayoutStore();
  const { files, autoRefresh } = useEditorStore();

  const device = DEVICE_PRESETS.find(d => d.id === previewDevice) || DEVICE_PRESETS[0];

  // Build the preview HTML from current file contents
  const previewHtml = useMemo(() => buildPreviewHtml(files), [files]);

  // Write to iframe using srcdoc or blob URL
  useEffect(() => {
    if (!iframeRef.current || !autoRefresh) return;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [previewHtml, autoRefresh]);

  // Intercept console messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'liveframe-console') {
        useConsoleStore.getState().addMessage(event.data.level, event.data.args);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PreviewHeader device={device} />
      <div className="flex-1 overflow-hidden">
        <DeviceFrame device={device} showFrame={showDeviceFrame}>
          <iframe
            ref={iframeRef}
            title="Live Preview"
            sandbox="allow-scripts allow-modals"
            className={cn(
              "bg-white",
              device.id === 'responsive'
                ? "w-full h-full"
                : `w-[${device.width}px] h-[${device.height}px]`
            )}
          />
        </DeviceFrame>
      </div>
    </div>
  );
}
```

### 7.4 Console Interception in iframe

To capture `console.log` etc. from the preview iframe, inject a script that overrides console methods and posts messages to the parent:

```typescript
function buildPreviewHtml(files: Record<string, string>): string {
  const consoleInterceptor = `
    <script>
      (function() {
        const originalConsole = { ...console };
        ['log', 'warn', 'error', 'info'].forEach(method => {
          console[method] = function(...args) {
            originalConsole[method](...args);
            window.parent.postMessage({
              type: 'liveframe-console',
              level: method,
              args: args.map(a => {
                try { return typeof a === 'object' ? JSON.parse(JSON.stringify(a)) : a; }
                catch { return String(a); }
              })
            }, '*');
          };
        });
        window.onerror = function(msg, url, line, col, error) {
          window.parent.postMessage({
            type: 'liveframe-console',
            level: 'error',
            args: [error?.toString() || msg + ' (line ' + line + ')']
          }, '*');
        };
      })();
    </script>
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    ${consoleInterceptor}
    <style>${files['style.css'] || ''}</style>
  </head>
  <body>
    ${files['index.html'] || ''}
    <script>${files['script.js'] || ''}</script>
  </body>
</html>`;
}
```

### 7.5 Device Dimension Presets

```typescript
// lib/devices.ts
export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  type: 'phone' | 'tablet' | 'laptop' | 'desktop';
  pixelRatio: number;
  userAgent?: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  // Phones
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, type: 'phone', pixelRatio: 2 },
  { id: 'iphone-14', label: 'iPhone 14', width: 390, height: 844, type: 'phone', pixelRatio: 3 },
  { id: 'iphone-14-pro-max', label: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'phone', pixelRatio: 3 },
  { id: 'pixel-7', label: 'Pixel 7', width: 412, height: 915, type: 'phone', pixelRatio: 2.625 },
  { id: 'samsung-galaxy-s23', label: 'Galaxy S23', width: 360, height: 780, type: 'phone', pixelRatio: 3 },
  // Tablets
  { id: 'ipad-mini', label: 'iPad Mini', width: 744, height: 1133, type: 'tablet', pixelRatio: 2 },
  { id: 'ipad', label: 'iPad', width: 810, height: 1080, type: 'tablet', pixelRatio: 2 },
  { id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, height: 1194, type: 'tablet', pixelRatio: 2 },
  { id: 'ipad-pro-129', label: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet', pixelRatio: 2 },
  // Laptops
  { id: 'macbook-air', label: 'MacBook Air', width: 1280, height: 800, type: 'laptop', pixelRatio: 2 },
  { id: 'macbook-pro-14', label: 'MacBook Pro 14"', width: 1512, height: 982, type: 'laptop', pixelRatio: 2 },
  // Desktops
  { id: 'desktop-1080', label: 'Desktop 1080p', width: 1920, height: 1080, type: 'desktop', pixelRatio: 1 },
  { id: 'desktop-1440', label: 'Desktop 1440p', width: 2560, height: 1440, type: 'desktop', pixelRatio: 1 },
];

export const DEFAULT_DEVICE: DevicePreset = {
  id: 'responsive',
  label: 'Responsive',
  width: 0, // 0 means fill container
  height: 0,
  type: 'desktop',
  pixelRatio: 1,
};
```

### 7.6 Custom Device Size Dialog

```tsx
function CustomDeviceDialog({ open, onOpenChange }: DialogProps) {
  const [width, setWidth] = useState(375);
  const [height, setHeight] = useState(812);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Custom Device Size</DialogTitle>
          <DialogDescription>
            Enter custom dimensions for the preview device.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="width">Width (px)</Label>
            <Input
              id="width"
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={200}
              max={3840}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Height (px)</Label>
            <Input
              id="height"
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              min={200}
              max={2160}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => {
            addCustomDevice({ width, height });
            onOpenChange(false);
          }}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 8. shadcn/ui Component Selection

### 8.1 Components Used

| Component | Usage Location | Rationale |
|---|---|---|
| **Button** | Toolbar, console, tabs, modals | Core interactive element; variants for primary/ghost/destructive |
| **DropdownMenu** | Mode switcher, device selector, export, theme, settings | Contextual menus without leaving the current view |
| **Dialog** | Custom device size, settings, unsaved changes confirmation | Modal overlays for focused interactions |
| **AlertDialog** | Unsaved tab close confirmation, destructive actions | Forced confirmation for irreversible operations |
| **Tabs** | Console filter tabs, settings sections | Segmented content areas |
| **Tooltip** | Toolbar buttons, panel toggle shortcuts | Progressive disclosure of labels |
| **ScrollArea** | File tree, console messages, tab bar overflow | Custom scrollbar styling consistent with theme |
| **Separator** | Toolbar sections, panel headers | Visual grouping |
| **ContextMenu** | File tree items (rename, delete, new file), editor tabs (close, close others, pin) | Right-click context actions |
| **Sheet** | Settings panel on mobile, file tree on mobile | Slide-in panels for smaller screens |
| **Select** | Font size, tab size, theme selection in settings | Simple value selection |
| **Badge** | Console error/warning counts, dirty indicators | Small status indicators |
| **Collapsible** | Console object/array expansion | Tree-view expansion of complex values |
| **Input** | Search in console, custom device size | Text input fields |
| **Label** | Settings form fields | Accessible form labels |
| **Switch** | Auto-refresh, word wrap, line numbers toggles | Binary toggle settings |
| **Slider** | Font size (continuous range) | Continuous value selection |
| **Toast** | Copy success, export complete, errors | Non-blocking notifications |
| **Popover** | Color picker, emoji picker (if needed) | Floating content anchored to trigger |
| **Accordion** | Settings categories | Collapsible settings sections |
| **Command** | Command palette (`Ctrl/Cmd + K`) | Quick file/action search |
| **Resizable** (custom) | Panel resizing | Based on `react-resizable-panels`, styled consistently |

### 8.2 Component Usage Patterns

**Context Menu for File Tree:**

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <FileTreeItem file={file} />
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => renameFile(file.path)}>
      <Pencil className="mr-2 h-4 w-4" /> Rename
    </ContextMenuItem>
    <ContextMenuItem onClick={() => duplicateFile(file.path)}>
      <Copy className="mr-2 h-4 w-4" /> Duplicate
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => deleteFile(file.path)} className="text-destructive">
      <Trash2 className="mr-2 h-4 w-4" /> Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Command Palette:**

```tsx
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";

function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setMode('single'); setOpen(false); }}>
            <FileCode2 className="mr-2 h-4 w-4" /> Switch to Single-file mode
          </CommandItem>
          <CommandItem onSelect={() => { setMode('project'); setOpen(false); }}>
            <FolderTree className="mr-2 h-4 w-4" /> Switch to Project mode
          </CommandItem>
          <CommandItem onSelect={() => { toggleConsole(); setOpen(false); }}>
            <Terminal className="mr-2 h-4 w-4" /> Toggle Console
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Files">
          {files.map((file) => (
            <CommandItem key={file.path} onSelect={() => { openTab(file); setOpen(false); }}>
              <File className="mr-2 h-4 w-4" /> {file.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### 8.3 Installation Commands

```bash
# Core shadcn components
npx shadcn@latest add button dropdown-menu dialog alert-dialog tabs tooltip scroll-area separator context-menu sheet select badge collapsible input label switch slider toast popover accordion command

# Additional utilities
npx shadcn@latest add sonner  # For toast notifications (alternative to default toast)
```

---

## 9. Mobile/Responsive Considerations

### 9.1 Breakpoint Strategy

LiveFrame uses Tailwind's default breakpoints, but with specific layout adaptations:

| Breakpoint | Width | Layout Strategy |
|---|---|---|
| `xs` (custom) | < 640px | Stacked layout: Editor only, Preview in sheet |
| `sm` | ≥ 640px | Compact split: Editor/Preview stacked with tab toggle |
| `md` | ≥ 768px | Side-by-side: Editor + Preview horizontal split |
| `lg` | ≥ 1024px | Full layout: File tree + Editor + Preview |
| `xl` | ≥ 1280px | Full layout with comfortable proportions |

### 9.2 Mobile Layout (< 640px)

On very small screens, panels stack vertically and the user switches between Editor and Preview via tabs:

```
┌──────────────────────┐
│ ◆ LiveFrame  [🌙][⚙️]│
├──────────────────────┤
│ [Editor] [Preview]   │ ← Tab toggle
├──────────────────────┤
│                      │
│   Active panel       │
│   fills viewport     │
│                      │
│   (Either Editor     │
│    or Preview,       │
│    never both)       │
│                      │
│                      │
├──────────────────────┤
│ Console [▼]          │ ← Slide-up sheet
└──────────────────────┘
```

**Implementation:**

```tsx
function MobileLayout() {
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div className="h-full flex flex-col md:hidden">
      {/* Panel toggle */}
      <div className="flex border-b bg-muted/50">
        <button
          onClick={() => setActivePanel('editor')}
          className={cn("flex-1 py-2 text-sm font-medium text-center", activePanel === 'editor' ? "border-b-2 border-primary" : "text-muted-foreground")}
        >
          <Code2 className="h-4 w-4 mx-auto mb-0.5" /> Editor
        </button>
        <button
          onClick={() => setActivePanel('preview')}
          className={cn("flex-1 py-2 text-sm font-medium text-center", activePanel === 'preview' ? "border-b-2 border-primary" : "text-muted-foreground")}
        >
          <Eye className="h-4 w-4 mx-auto mb-0.5" /> Preview
        </button>
      </div>

      {/* Active panel */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'editor' ? <EditorPanel /> : <PreviewPanel />}
      </div>

      {/* Console as bottom sheet */}
      <Sheet open={consoleOpen} onOpenChange={setConsoleOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="absolute bottom-4 right-4 md:hidden">
            <Terminal className="h-4 w-4 mr-1" /> Console
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[50vh]">
          <ConsolePanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

### 9.3 Responsive Layout Selector

```tsx
function ResponsiveLayout() {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  if (isMobile) return <MobileLayout />;
  if (isTablet) return <TabletLayout />;
  return <DesktopLayout />;
}
```

### 9.4 Tablet Layout (640–1023px)

On tablets, the file tree is hidden by default (accessible via slide-out sheet), and the editor/preview use a horizontal split:

```tsx
function TabletLayout() {
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const { mode } = useLayoutStore();

  return (
    <div className="h-full flex flex-col">
      {/* File tree as sheet */}
      {mode === 'project' && (
        <Sheet open={fileTreeOpen} onOpenChange={setFileTreeOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <FileTreePanel />
          </SheetContent>
        </Sheet>
      )}

      <PanelGroup direction="vertical" autoSaveId="liveframe-tablet">
        <Panel defaultSize={72} minSize={40} order={1}>
          <PanelGroup direction="horizontal" autoSaveId="liveframe-tablet-top">
            <Panel defaultSize={50} minSize={30} order={1}>
              <EditorPanel />
            </Panel>
            <ResizeHandle direction="horizontal" id="tablet-editor-preview" />
            <Panel defaultSize={50} minSize={30} order={2}>
              <PreviewPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <ResizeHandle direction="vertical" id="tablet-top-console" />
        <Panel defaultSize={28} minSize={5} maxSize={50} collapsible collapsedSize={0} order={2}>
          <ConsolePanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

### 9.5 Touch Support for Resizing

`react-resizable-panels` has built-in touch support. However, we add additional touch affordances:

1. **Larger hit areas** on mobile: `hitAreaMargins={{ coarse: 10, fine: 5 }}`
2. **Visual feedback** during drag: The resize handle gets a prominent highlight
3. **Double-tap to collapse**: Tapping a resize handle twice collapses the adjacent panel

```tsx
<PanelResizeHandle
  className={cn(
    "group relative flex items-center justify-center",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    direction === "horizontal"
      ? "w-px md:w-px touch:w-2 bg-border hover:bg-primary/30 active:bg-primary/50"
      : "h-px md:h-px touch:h-2 bg-border hover:bg-primary/30 active:bg-primary/50"
  )}
  hitAreaMargins={{ coarse: 10, fine: 5 }}
  onDoubleClick={() => {
    // Toggle collapse of adjacent panel
    if (adjacentPanelRef.current) {
      adjacentPanelRef.current.isCollapsed()
        ? adjacentPanelRef.current.expand()
        : adjacentPanelRef.current.collapse();
    }
  }}
/>
```

### 9.6 Swipe Gestures (Mobile)

For mobile, we integrate `use-gesture` for swipe-to-switch between editor and preview:

```tsx
import { useDrag } from "@use-gesture/react";

function MobilePanelSwitcher() {
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');
  const x = useMotionValue(0);

  const bind = useDrag(({ movement: [mx], direction: [dx], velocity: [vx], cancel }) => {
    // Swipe threshold: 50px or velocity > 0.5
    if (Math.abs(mx) > 50 || vx > 0.5) {
      if (dx > 0 && activePanel === 'preview') {
        setActivePanel('editor');
      } else if (dx < 0 && activePanel === 'editor') {
        setActivePanel('preview');
      }
      cancel();
    }
  });

  return (
    <div {...bind()} className="flex-1 overflow-hidden touch-pan-y">
      <AnimatePresence mode="wait">
        {activePanel === 'editor' ? (
          <motion.div key="editor" initial={{ x: -20 }} animate={{ x: 0 }} exit={{ x: -20 }}>
            <EditorPanel />
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ x: 20 }} animate={{ x: 0 }} exit={{ x: 20 }}>
            <PreviewPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## 10. Accessibility

### 10.1 Keyboard Navigation

**Global keyboard shortcuts:**

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + J` | Toggle console panel |
| `Ctrl/Cmd + B` | Toggle file tree |
| `Ctrl/Cmd + S` | Save (prevent default, trigger our save logic) |
| `Ctrl/Cmd + Shift + E` | Focus editor |
| `Ctrl/Cmd + Shift + P` | Focus preview |
| `Ctrl/Cmd + \` | Toggle theme |
| `Ctrl/Cmd + 1/2/3` | Switch to HTML/CSS/JS tab (single-file mode) |
| `Alt + ←/→` | Navigate between open tabs |
| `Ctrl/Cmd + W` | Close current tab |
| `Ctrl/Cmd + Shift + W` | Close all tabs |
| `Escape` | Close any open modal/dialog |

**Panel keyboard resize:**

`react-resizable-panels` supports keyboard resize via arrow keys when a `PanelResizeHandle` is focused. We ensure handles are focusable with `tabIndex={0}` and have visible focus indicators.

### 10.2 Focus Management

```tsx
// Focus trap in dialogs — shadcn Dialog handles this automatically via Radix UI
// Focus management for panel switching
function focusPanel(panelId: string) {
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.focus();
    // Announce to screen readers
    announceToScreenReader(`Switched to ${panelId} panel`);
  }
}

// Screen reader announcements
function announceToScreenReader(message: string) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.className = 'sr-only';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => document.body.removeChild(el), 1000);
}
```

### 10.3 ARIA Labels for Panels

Each panel receives descriptive ARIA labels:

```tsx
<Panel
  id="editor-panel"
  role="region"
  aria-label="Code editor panel"
>
  <div
    id="editor-content"
    role="textbox"
    aria-label="Code editor"
    aria-multiline="true"
    aria-readonly="false"
  >
    {/* CodeMirror mounts here — it manages its own ARIA attributes */}
  </div>
</Panel>

<Panel
  id="preview-panel"
  role="region"
  aria-label="Live preview panel"
>
  <iframe
    title="Live preview of your HTML, CSS, and JavaScript code"
    aria-label="Live preview iframe"
  />
</Panel>

<Panel
  id="console-panel"
  role="log"
  aria-label="Console output panel"
  aria-live="polite"
  aria-atomic="false"
>
  {/* Console messages are announced as they appear */}
</Panel>

<Panel
  id="file-tree-panel"
  role="tree"
  aria-label="File explorer"
>
  {/* File tree items use role="treeitem" */}
</Panel>
```

### 10.4 Resize Handle Accessibility

```tsx
<PanelResizeHandle
  id="editor-preview-handle"
  role="separator"
  aria-orientation="horizontal"
  aria-label="Resize editor and preview panels"
  aria-valuenow={currentEditorSize}
  aria-valuemin={25}
  aria-valuemax={75}
  tabIndex={0}
  className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
/>
```

### 10.5 Screen Reader Announcements for Preview Updates

When the preview refreshes, announce the update to screen reader users:

```tsx
// In the preview refresh logic
function refreshPreview() {
  // ... refresh iframe ...

  // Announce to screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = 'Preview updated';
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}
```

### 10.6 Console Accessibility

Console messages should be announced based on their type:

```tsx
function ConsoleMessage({ message }: { message: ConsoleMessage }) {
  const ariaLabels: Record<ConsoleMessageType, string> = {
    log: 'Console log',
    warn: 'Console warning',
    error: 'Console error',
    info: 'Console info',
  };

  return (
    <div
      role="listitem"
      aria-label={`${ariaLabels[message.type]}: ${truncate(String(message.value), 100)}`}
      className={cn("...")}
    >
      {/* ... */}
    </div>
  );
}

// Console container
<div
  role="log"
  aria-label="Console output"
  aria-live="polite"
  aria-relevant="additions"
>
  {messages.map(msg => <ConsoleMessage key={msg.id} message={msg} />)}
</div>
```

### 10.7 High Contrast Mode

For users who prefer high contrast, we add a `@media (prefers-contrast: high)` override:

```css
@media (prefers-contrast: high) {
  :root {
    --border: oklch(0.4 0 0);
    --muted-foreground: oklch(0.4 0 0);
    --resize-handle: oklch(0.5 0 0);
  }

  .dark {
    --border: oklch(0.7 0 0);
    --muted-foreground: oklch(0.7 0 0);
    --resize-handle: oklch(0.6 0 0);
  }

  .panel-resize-handle {
    border: 2px solid var(--border) !important;
  }
}
```

### 10.8 Reduced Motion

Respect the user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

And in React components:

```tsx
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

// Disable auto-refresh spinner animation
<RefreshCw
  className={cn(
    "h-3.5 w-3.5",
    autoRefresh && !prefersReducedMotion && "animate-spin"
  )}
/>
```

### 10.9 Skip Navigation Link

A skip link allows keyboard users to jump past the toolbar directly to the main content:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
>
  Skip to main content
</a>
```

---

## Appendix A: Full Layout Component Tree

```
<App>
  <ThemeProvider>
    <TooltipProvider>
      <CommandPalette />
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only ...">
          Skip to main content
        </a>
        <Toolbar /> ← h-12, fixed
        <main id="main-content" className="flex-1 overflow-hidden">
          <ResponsiveLayout>
            <MobileLayout />     ← xs, sm
            <TabletLayout />     ← md
            <DesktopLayout />    ← lg+
          </ResponsiveLayout>
        </main>
        <StatusBar /> ← h-6, optional
      </div>
    </TooltipProvider>
  </ThemeProvider>
</App>

DesktopLayout:
  <PanelGroup direction="vertical" autoSaveId="liveframe-root">
    <Panel> ← Top area (72%)
      <PanelGroup direction="horizontal" autoSaveId="liveframe-top">
        <Panel> ← File tree (18%, project mode only)
          <FileTreePanel>
            <FileTreeHeader />
            <ScrollArea>
              <FileTreeItem /> × N
            </ScrollArea>
          </FileTreePanel>
        </Panel>
        <ResizeHandle />
        <Panel> ← Editor (41%)
          <EditorPanel>
            <EditorTabBar>
              <SingleFileTabBar /> or <ProjectTabBar />
            </EditorTabBar>
            <CodeMirrorEditor />
          </EditorPanel>
        </Panel>
        <ResizeHandle />
        <Panel> ← Preview (41%)
          <PreviewPanel>
            <PreviewHeader />
            <DeviceFrame>
              <iframe />
            </DeviceFrame>
          </PreviewPanel>
        </Panel>
      </PanelGroup>
    </Panel>
    <ResizeHandle />
    <Panel collapsible> ← Console (28%)
      <ConsolePanel>
        <ConsoleHeader />
        <ScrollArea>
          <ConsoleMessage /> × N
        </ScrollArea>
      </ConsolePanel>
    </Panel>
  </PanelGroup>
```

## Appendix B: Zustand Store Summary

```
stores/
├── themeStore.ts      ← Theme (light/dark/system), resolvedTheme
├── layoutStore.ts     ← Mode (single/project), panel visibility, device preset
├── editorStore.ts     ← Tabs, active file, dirty state, file contents, auto-refresh
├── consoleStore.ts    ← Messages, filter, search, timestamps
└── settingsStore.ts   ← Font size, tab size, word wrap, line numbers, key bindings
```

## Appendix C: Key Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-resizable-panels": "^3.0.0",
    "@codemirror/state": "^6.5.0",
    "@codemirror/view": "^6.36.0",
    "@codemirror/lang-html": "^6.4.9",
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-javascript": "^6.2.2",
    "@dnd-kit/core": "^6.3.0",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "zustand": "^5.0.0",
    "lucide-react": "^0.474.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "@use-gesture/react": "^10.3.0",
    "framer-motion": "^12.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

---

*End of report. This document serves as the comprehensive UI/UX and layout blueprint for the LiveFrame project. Each section should be referenced during implementation to ensure consistency across the codebase.*
