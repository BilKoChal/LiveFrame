# LiveFrame — Phase 1.2/1.3: File Tree UI & File Tabs Research

> **Date**: 2026-03-05  
> **Scope**: File Tree UI (Phase 1.2) + File Tabs with drag-and-drop (Phase 1.3)  
> **Stack**: React 19, Vite 6, TypeScript 5.8, Zustand 5, Tailwind CSS v4, lucide-react  
> **Key Libraries**: `@tanstack/react-virtual@3.13`, `@dnd-kit/core@6.3`, `@dnd-kit/sortable@10.0`

---

## Table of Contents

1. [Tree Rendering from Flat Data](#1-tree-rendering-from-flat-data)
2. [Virtualization with @tanstack/react-virtual](#2-virtualization-with-tanstackreact-virtual)
3. [File Icons with lucide-react](#3-file-icons-with-lucide-react)
4. [Context Menu Patterns](#4-context-menu-patterns)
5. [Inline Rename](#5-inline-rename)
6. [Tab Bar with @dnd-kit/sortable](#6-tab-bar-with-dnd-kitsortable)
7. [Tab Overflow Handling](#7-tab-overflow-handling)
8. [Tab State Management with Zustand](#8-tab-state-management-with-zustand)
9. [Middle-Click to Close Tabs](#9-middle-click-to-close-tabs)
10. [Implementation Recommendations](#10-implementation-recommendations)

---

## 1. Tree Rendering from Flat Data

### 1.1 The Flat-to-Tree Derivation Problem

LiveFrame's data model stores files as `Record<FileId, FileEntry>` where each `FileEntry` has a `path` like `"src/components/App.tsx"`. The file tree UI needs a hierarchical structure. The approach: **derive a tree on demand from the flat map**.

### 1.2 Flat-to-Tree Algorithm

The key insight is to walk each file's path parts and build a nested structure where directories are implicit (not stored as separate entities — they are derived from file paths).

```typescript
// ─── Tree Node Types ────────────────────────────────────────

interface TreeNode {
  id: string;           // FileId for files, "dir:path" for directories
  name: string;         // Display name (e.g., "components" or "App.tsx")
  type: 'file' | 'directory';
  depth: number;        // Nesting level for indentation (0 = root)
  path: string;         // Full path (e.g., "src/components")
  fileType?: FileType;  // Only for files
  isDirty?: boolean;    // Only for files
  isExpanded?: boolean; // Only for directories
  children: TreeNode[];
}

// ─── Build Tree from Flat Map ────────────────────────────────

function buildTree(files: Record<FileId, FileEntry>): TreeNode {
  const root: TreeNode = {
    id: 'root',
    name: 'root',
    type: 'directory',
    depth: 0,
    path: '',
    isExpanded: true,
    children: [],
  };

  const fileEntries = Object.values(files);

  for (const file of fileEntries) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isFile) {
        current.children.push({
          id: file.id,
          name: part,
          type: 'file',
          depth: i,
          path: file.path,
          fileType: file.type,
          isDirty: file.isDirty,
          children: [],
        });
      } else {
        let dir = current.children.find(
          (c) => c.type === 'directory' && c.name === part
        );
        if (!dir) {
          dir = {
            id: `dir:${currentPath}`,
            name: part,
            type: 'directory',
            depth: i,
            path: currentPath,
            isExpanded: false, // Default collapsed; restored from expandedDirs
            children: [],
          };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort: directories first, then files, alphabetical within groups
  sortTree(root);

  return root;
}

function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}
```

### 1.3 Flattening for Virtualization

For virtualized rendering, we need a **flat list** from the tree (only visible nodes — collapsed directories' children are hidden):

```typescript
interface FlatTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  depth: number;
  path: string;
  fileType?: FileType;
  isDirty?: boolean;
  isExpanded?: boolean;
  fileId?: FileId;     // Only for files — used to look up FileEntry
  parentId: string;    // For keyboard navigation
}

function flattenTree(
  root: TreeNode,
  expandedDirs: Set<string>
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  function walk(nodes: TreeNode[], parentId: string) {
    for (const node of nodes) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        depth: node.depth,
        path: node.path,
        fileType: node.fileType,
        isDirty: node.isDirty,
        isExpanded: node.type === 'directory' ? expandedDirs.has(node.path) : undefined,
        fileId: node.type === 'file' ? node.id as FileId : undefined,
        parentId,
      });

      if (node.type === 'directory' && expandedDirs.has(node.path)) {
        walk(node.children, node.id);
      }
    }
  }

  walk(root.children, 'root');
  return result;
}
```

### 1.4 Expand/Collapse State Management

Expand/collapse state should be stored **separately** from the tree data, because it's a UI concern:

```typescript
// In projectStore or a dedicated UI state slice
expandedDirs: Set<string>;

// Toggle action
toggleDir: (dirPath: string) => void;
```

When building the virtualized list, pass `expandedDirs` to `flattenTree()`. Collapsed directories simply don't include their children in the flat list, so the virtualizer only renders visible nodes.

### 1.5 Why Not Recursive Components?

Recursive `<TreeNode>` components are simpler to write but **incompatible with virtualization** — `@tanstack/react-virtual` requires a flat list of items with known indices. The flatten-then-virtualize approach is the standard pattern used by VS Code, IntelliJ, and other editors.

---

## 2. Virtualization with @tanstack/react-virtual

### 2.1 Basic Setup

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function FileTree({ flatNodes }: { flatNodes: FlatTreeNode[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => 28, // Default row height in px
    overscan: 5,                 // Render 5 extra items above/below viewport
  });

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto h-full"
      style={{ contain: 'strict' }} // Performance hint
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const node = flatNodes[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: '100%',
              }}
            >
              <FileTreeRow node={node} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 2.2 Key Challenge: Dynamic Row Heights

All rows in the file tree are typically the same height (28px), but inline rename mode makes a row taller (adds a text input). This is where dynamic measurement matters.

**Approach: Use `measureElement` for dynamic heights**

`@tanstack/react-virtual` v3 provides `measureElement` — a ref callback that uses `ResizeObserver` to track actual rendered heights:

```typescript
// In the virtual item render:
<div
  key={virtualItem.key}
  ref={virtualizer.measureElement} // ← Auto-measures actual height
  data-index={virtualItem.index}   // ← Required for measurement tracking
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translateY(${virtualItem.start}px)`,
  }}
>
  <FileTreeRow node={node} isRenaming={renamingId === node.id} />
</div>
```

When a row enters rename mode and grows taller, `ResizeObserver` fires, the virtualizer re-measures, and the layout adjusts automatically. The `estimateSize` function provides the initial guess (28px), but `measureElement` overrides it with the actual size.

**Important**: Always use `measureElement` with `data-index` for proper index-to-element mapping.

### 2.3 Scroll Position Preservation

When expanding/collapsing directories, the scroll position can jump unexpectedly. The fix:

```typescript
// Before expanding/collapsing, save scroll offset
const scrollOffset = virtualizer.scrollOffset;

// After state update, restore scroll position
// React will re-render, virtualizer recalculates
// Use requestAnimationFrame to ensure DOM is updated
requestAnimationFrame(() => {
  if (parentRef.current) {
    parentRef.current.scrollTop = scrollOffset ?? 0;
  }
});
```

For `@tanstack/react-virtual` v3, there's a simpler approach using `scrollToOffset`:

```typescript
const handleToggle = (dirPath: string) => {
  const currentOffset = virtualizer.scrollOffset ?? 0;
  toggleDir(dirPath);
  // After React re-render, the virtualizer will recalculate
  // Use onChange callback or useEffect to restore
};

// Alternative: use the anchorTo option
const virtualizer = useVirtualizer({
  // ...
  anchorTo: 'start', // Keeps the start of the viewport anchored on resize
});
```

### 2.4 When NOT to Virtualize

For projects with < 100 files, virtualization adds complexity without measurable benefit. Consider a conditional:

```typescript
const shouldVirtualize = flatNodes.length > 50;

// If not virtualizing, render all nodes directly
if (!shouldVirtualize) {
  return (
    <div ref={parentRef} className="overflow-y-auto h-full">
      {flatNodes.map((node) => (
        <FileTreeRow key={node.id} node={node} />
      ))}
    </div>
  );
}
```

### 2.5 Performance Tips

1. **Memoize `flatNodes`**: Use `useMemo` with `[files, expandedDirs]` deps so the list is only recalculated when files or expansion state changes.
2. **Stable keys**: Use `node.id` (FileId or directory path) as keys — never use array indices.
3. **`contain: strict`**: Add CSS containment on the scroll container for browser rendering optimization.
4. **Overscan tuning**: `overscan: 5` is good for file trees (small items, fast scrolling). Reduce to 3 if rows are heavy.

---

## 3. File Icons with lucide-react

### 3.1 Icon Mapping Strategy

Use a function that maps file extensions and directory state to lucide-react icon components:

```typescript
import {
  FileCode2,   // .html, .htm
  Braces,      // .js, .jsx, .ts, .tsx, .mjs
  FileJson,    // .json
  FileText,    // .txt, .md, .mdx
  Palette,     // .css, .scss, .less
  Image,       // .png, .jpg, .svg, .gif, .webp
  File,        // .other (fallback)
  Folder,      // Directory (collapsed)
  FolderOpen,  // Directory (expanded)
  FileCode,    // .xml, .svg (alternative)
  Terminal,    // .sh, .bash
  Coffee,      // (optional fun icon)
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Extension → Icon Map ────────────────────────────────────

const FILE_ICON_MAP: Record<string, LucideIcon> = {
  // HTML
  '.html': FileCode2,
  '.htm': FileCode2,

  // JavaScript / TypeScript
  '.js': Braces,
  '.jsx': Braces,
  '.ts': Braces,
  '.tsx': Braces,
  '.mjs': Braces,

  // CSS
  '.css': Palette,
  '.scss': Palette,
  '.less': Palette,

  // Data
  '.json': FileJson,

  // Text
  '.txt': FileText,
  '.md': FileText,
  '.mdx': FileText,

  // Image
  '.svg': Image,
  '.png': Image,
  '.jpg': Image,
  '.gif': Image,
  '.webp': Image,

  // Shell
  '.sh': Terminal,
  '.bash': Terminal,

  // XML
  '.xml': FileCode,
};

// ─── Icon Color Map ──────────────────────────────────────────

const FILE_COLOR_MAP: Record<string, string> = {
  '.html': 'text-orange-500',
  '.htm': 'text-orange-500',
  '.css': 'text-sky-500',
  '.scss': 'text-pink-500',
  '.less': 'text-pink-500',
  '.js': 'text-yellow-500',
  '.jsx': 'text-yellow-500',
  '.ts': 'text-blue-500',
  '.tsx': 'text-blue-500',
  '.mjs': 'text-yellow-500',
  '.json': 'text-yellow-600',
  '.md': 'text-slate-400',
  '.svg': 'text-green-500',
  '.png': 'text-green-500',
};

// ─── Get File Icon ───────────────────────────────────────────

function getFileIcon(fileName: string): { icon: LucideIcon; color: string } {
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  return {
    icon: FILE_ICON_MAP[ext] ?? File,
    color: FILE_COLOR_MAP[ext] ?? 'text-slate-400',
  };
}

// ─── Get Directory Icon ──────────────────────────────────────

function getDirectoryIcon(isExpanded: boolean): { icon: LucideIcon; color: string } {
  return {
    icon: isExpanded ? FolderOpen : Folder,
    color: 'text-sky-400',
  };
}
```

### 3.2 Usage in Tree Row Component

```typescript
function FileTreeRow({ node }: { node: FlatTreeNode }) {
  const { icon: Icon, color } = node.type === 'directory'
    ? getDirectoryIcon(node.isExpanded ?? false)
    : getFileIcon(node.name);

  return (
    <div
      className="flex items-center gap-1.5 h-7 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
    >
      {node.type === 'directory' && (
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            node.isExpanded ? 'rotate-90' : ''
          }`}
        />
      )}
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <span className="truncate text-sm">{node.name}</span>
      {node.isDirty && (
        <span className="ml-auto h-2 w-2 rounded-full bg-sky-400 shrink-0" />
      )}
    </div>
  );
}
```

### 3.3 Tree-Shaking Consideration

Lucide-react supports tree-shaking, but only named imports work. **Never** use `import * as Icons from 'lucide-react'`. Each icon is a separate module, so named imports ensure only used icons are bundled.

---

## 4. Context Menu Patterns

### 4.1 Approach: Custom Implementation (No Heavy Dependencies)

The project plan mentions `@radix-ui/react-context-menu`, which is a good option if already using Radix. However, a lightweight custom implementation is viable and avoids adding ~10KB of Radix dependencies for just one component.

### 4.2 Custom Context Menu Implementation

```typescript
// ─── ContextMenu State ───────────────────────────────────────

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string | null;
  nodeType: 'file' | 'directory' | 'root' | null;
  nodePath: string | null;
}

const INITIAL_CONTEXT_MENU: ContextMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  nodeId: null,
  nodeType: null,
  nodePath: null,
};

// ─── Hook ────────────────────────────────────────────────────

function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>(INITIAL_CONTEXT_MENU);

  const openMenu = useCallback(
    (e: React.MouseEvent, node: FlatTreeNode) => {
      e.preventDefault();
      e.stopPropagation();

      // Adjust position to stay within viewport
      const x = Math.min(e.clientX, window.innerWidth - 200);
      const y = Math.min(e.clientY, window.innerHeight - 200);

      setMenu({
        isOpen: true,
        x,
        y,
        nodeId: node.id,
        nodeType: node.type,
        nodePath: node.path,
      });
    },
    []
  );

  const closeMenu = useCallback(() => {
    setMenu(INITIAL_CONTEXT_MENU);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu.isOpen) return;

    const handleClick = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu.isOpen, closeMenu]);

  return { menu, openMenu, closeMenu };
}
```

### 4.3 Context Menu Component

```typescript
interface MenuItem {
  label: string;
  icon: LucideIcon;
  action: () => void;
  separator?: boolean;   // Draw separator before this item
  danger?: boolean;      // Destructive action (red text)
  disabled?: boolean;
}

function FileTreeContextMenu({
  menu,
  closeMenu,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  menu: ContextMenuState;
  closeMenu: () => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (nodeId: string, nodePath: string) => void;
  onDelete: (nodeId: string, nodePath: string, nodeType: 'file' | 'directory') => void;
}) {
  if (!menu.isOpen) return null;

  const items: MenuItem[] = [];

  if (menu.nodeType === 'directory' || menu.nodeType === 'root') {
    items.push(
      { label: 'New File', icon: FilePlus, action: () => { onNewFile(menu.nodePath ?? ''); closeMenu(); } },
      { label: 'New Folder', icon: FolderPlus, action: () => { onNewFolder(menu.nodePath ?? ''); closeMenu(); } },
    );
  }

  if (menu.nodeType === 'file' || menu.nodeType === 'directory') {
    items.push(
      { label: 'Rename', icon: Pencil, action: () => { onRename(menu.nodeId!, menu.nodePath!); closeMenu(); }, separator: true },
      { label: 'Delete', icon: Trash2, action: () => { onDelete(menu.nodeId!, menu.nodePath!, menu.nodeType!); closeMenu(); }, danger: true },
    );
  }

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()} // Prevent immediate close
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />}
          <button
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm ${
              item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            } ${item.disabled ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={item.action}
            disabled={item.disabled}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
```

### 4.4 Radix Context Menu Alternative

If the project already depends on Radix UI (the plan lists 11+ Radix packages), using `@radix-ui/react-context-menu` is the better choice — it handles:

- Portal rendering (escapes overflow containers)
- Focus management
- Keyboard navigation (arrow keys, Enter, Escape)
- Sub-menus
- Accessibility (ARIA roles)

```typescript
import * as ContextMenu from '@radix-ui/react-context-menu';

// Usage:
<ContextMenu.Root>
  <ContextMenu.Trigger asChild>
    <FileTreeRow node={node} />
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content className="...styling...">
      <ContextMenu.Item onSelect={() => onNewFile(node.path)}>
        New File
      </ContextMenu.Item>
      {/* ... */}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

**Recommendation**: Use Radix Context Menu since the plan already includes Radix dependencies. The custom approach is documented as a fallback if Radix is deferred.

---

## 5. Inline Rename

### 5.1 Pattern: Double-Click → Edit Mode → Enter/Escape

```typescript
function FileTreeRow({ node, onRename }: FileTreeRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enter rename mode on double-click
  const handleDoubleClick = useCallback(() => {
    setRenameValue(node.name);
    setIsRenaming(true);
  }, [node.name]);

  // Confirm rename
  const handleConfirm = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name) {
      // Compute new path: replace last segment of path with new name
      const parentPath = node.path.includes('/')
        ? node.path.substring(0, node.path.lastIndexOf('/'))
        : '';
      const newPath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
      onRename(node.id, newPath);
    }
    setIsRenaming(false);
  }, [renameValue, node, onRename]);

  // Cancel rename
  const handleCancel = useCallback(() => {
    setIsRenaming(false);
    setRenameValue(node.name);
  }, [node.name]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension
      const dotIndex = renameValue.lastIndexOf('.');
      inputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : renameValue.length);
    }
  }, [isRenaming, renameValue]);

  if (isRenaming) {
    return (
      <div
        className="flex items-center gap-1.5 h-7 px-2"
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      >
        {/* Icon remains visible during rename */}
        <RenameIcon className="h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={handleConfirm}
          className="h-5 flex-1 bg-slate-100 dark:bg-slate-700 border border-sky-500 rounded px-1 text-sm outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 h-7 px-2 cursor-pointer"
      onDoubleClick={handleDoubleClick}
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
    >
      {/* ...normal rendering... */}
    </div>
  );
}
```

### 5.2 Rename State: Local vs Global

**Recommendation**: Store rename state **locally in the component**, not in Zustand. Reasons:

- Rename is a transient UI interaction (like a tooltip or dropdown)
- Only one node is ever being renamed at a time
- No other component needs to know about the rename input value
- Keeping it local avoids unnecessary store updates and re-renders

However, the **trigger to start renaming** may come from the context menu (which is in a different component tree). Use a simple state in the store:

```typescript
// In projectStore or a dedicated UI state:
renamingNodeId: string | null;
startRenaming: (nodeId: string) => void;
stopRenaming: () => void;
```

The row component reads `renamingNodeId` from the store to know if it should show the input, but the input's value and onChange handlers are local state.

### 5.3 Rename for Directories

When renaming a directory, all child file paths must be updated:

```typescript
renameFile: (fileId: FileId, newPath: string) => void; // Single file
renameDirectory: (dirPath: string, newDirPath: string) => void; // Updates all children
```

The `renameDirectory` action iterates all files whose path starts with `dirPath + '/'` and replaces the prefix.

---

## 6. Tab Bar with @dnd-kit/sortable

### 6.1 Minimal Setup

```typescript
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Sortable Tab Component ──────────────────────────────────

interface TabItem {
  id: string;        // FileId
  name: string;      // Display name
  fileType: FileType;
  isDirty: boolean;
  isActive: boolean;
}

function SortableTab({ tab, onClose, onActivate }: {
  tab: TabItem;
  onClose: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  const { icon: Icon, color } = getFileIcon(tab.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group flex items-center gap-1.5 px-3 py-2 text-xs font-medium
        border-r border-slate-200 dark:border-slate-700 cursor-pointer
        select-none shrink-0
        ${tab.isActive
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-b-2 border-b-sky-500'
          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
        }
      `}
      onClick={() => onActivate(tab.id)}
      onMouseDown={(e) => {
        // Middle-click to close
        if (e.button === 1) {
          e.preventDefault();
          onClose(tab.id);
        }
      }}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
      <span className="truncate max-w-[120px]">{tab.name}</span>
      {tab.isDirty && (
        <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
      )}
      <button
        className="ml-1 h-4 w-4 rounded hover:bg-slate-200 dark:hover:bg-slate-600
                   opacity-0 group-hover:opacity-100 flex items-center justify-center
                   shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag on close button
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Tab Bar Component ───────────────────────────────────────

function ProjectFileTabs() {
  const openTabs = useProjectStore((s) => s.openTabs);       // TabItem[]
  const activeTabId = useProjectStore((s) => s.activeTabId); // string | null
  const reorderTabs = useProjectStore((s) => s.reorderTabs);
  const closeTab = useProjectStore((s) => s.closeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = openTabs.findIndex((t) => t.id === active.id);
      const newIndex = openTabs.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(openTabs, oldIndex, newIndex);
      reorderTabs(reordered.map((t) => t.id));
    }
  }, [openTabs, reorderTabs]);

  return (
    <div className="flex items-center w-full border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 select-none overflow-x-auto">
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={openTabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          {openTabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={{
                ...tab,
                isActive: tab.id === activeTabId,
              }}
              onClose={closeTab}
              onActivate={setActiveTab}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

### 6.2 Key @dnd-kit/sortable Concepts

| Concept | Purpose | Notes |
|---------|---------|-------|
| `DndContext` | Wraps the drag-and-drop area | Handles sensors, collision detection, events |
| `SortableContext` | Manages sortable items | Requires `items` array of IDs + `strategy` |
| `useSortable` | Hook for individual items | Returns `transform`, `transition`, `listeners`, `setNodeRef` |
| `horizontalListSortingStrategy` | Optimized for horizontal lists | Use for tab bars (vs. `verticalListSortingStrategy` for lists) |
| `arrayMove` | Utility to reorder arrays | Returns new array with item moved from oldIndex to newIndex |
| `CSS.Transform.toString()` | Converts transform object to CSS string | Handles translate3d for smooth animations |

### 6.3 Drag Constraints

To prevent tabs from being dragged outside the tab bar:

```typescript
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

<DndContext
  modifiers={[restrictToHorizontalAxis]}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
```

**Note**: `@dnd-kit/modifiers` is a separate package. If not installed, a custom modifier is trivial:

```typescript
import type { Modifier } from '@dnd-kit/core';

const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});
```

### 6.4 Drag Overlay (Optional Enhancement)

For a visual drag preview that lifts the tab out of the flow:

```typescript
import { DragOverlay } from '@dnd-kit/core';

const [activeId, setActiveId] = useState<string | null>(null);

<DndContext
  onDragStart={({ active }) => setActiveId(active.id as string)}
  onDragEnd={(event) => { /* ... */ setActiveId(null); }}
  onDragCancel={() => setActiveId(null)}
>
  <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
    {openTabs.map((tab) => (
      <SortableTab key={tab.id} tab={tab} /* ... */ />
    ))}
  </SortableContext>

  <DragOverlay>
    {activeId ? (
      <div className="...tab-styles-with-shadow...">
        {/* Render a preview of the dragged tab */}
      </div>
    ) : null}
  </DragOverlay>
</DndContext>
```

**Recommendation**: Skip `DragOverlay` for v1. The default behavior (transform on the original element) is sufficient and simpler.

---

## 7. Tab Overflow Handling

### 7.1 The Problem

When many files are open, tabs overflow the tab bar width. The user needs:
1. Horizontal scrolling to access off-screen tabs
2. The active tab should scroll into view automatically
3. Optional: scroll buttons (left/right arrows) at the edges

### 7.2 Solution: Scrollable Tab Bar with Auto-Scroll

```typescript
function ProjectFileTabs() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabId = useProjectStore((s) => s.activeTabId);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;

    const activeTab = scrollRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement | null;

    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTabId]);

  // Scroll button state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });

    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      observer.disconnect();
    };
  }, [updateScrollButtons]);

  const scrollBy = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -150 : 150,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex items-center w-full border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 select-none">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          className="h-full px-1 hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={() => scrollBy('left')}
        >
          <ChevronLeft className="h-4 w-4 text-slate-400" />
        </button>
      )}

      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }} // Hide scrollbar (Firefox)
      >
        {/* DndContext + SortableContext + tabs here */}
        <DndContext /* ... */>
          <SortableContext /* ... */>
            {openTabs.map((tab) => (
              <SortableTab key={tab.id} tab={tab} data-tab-id={tab.id} /* ... */ />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          className="h-full px-1 hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={() => scrollBy('right')}
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      )}
    </div>
  );
}
```

### 7.3 Hide Scrollbar CSS

For Webkit browsers, add to `index.css`:

```css
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### 7.4 Mouse Wheel Horizontal Scroll

Allow mouse wheel to scroll tabs horizontally:

```typescript
<div
  ref={scrollRef}
  className="flex overflow-x-auto scrollbar-none"
  onWheel={(e) => {
    if (e.deltaY !== 0 && scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }}
>
```

---

## 8. Tab State Management with Zustand

### 8.1 Tab State Design

Tab state is a **UI concern** separate from the project/file data model. It tracks which files are open as tabs and their display order.

```typescript
// ─── Tab State (in projectStore or a dedicated tabsStore) ───

interface TabState {
  /** Ordered list of open tab file IDs */
  openTabIds: FileId[];
  /** Currently active tab file ID */
  activeTabId: FileId | null;
}

// ─── Tab Actions ─────────────────────────────────────────────

interface TabActions {
  /** Open a file as a tab (if not already open) and activate it */
  openTab: (fileId: FileId) => void;

  /** Close a tab and activate the next appropriate tab */
  closeTab: (fileId: FileId) => void;

  /** Reorder tabs after drag-and-drop */
  reorderTabs: (tabIds: FileId[]) => void;

  /** Set the active tab */
  setActiveTab: (fileId: FileId | null) => void;

  /** Close all tabs */
  closeAllTabs: () => void;

  /** Close all tabs except one */
  closeOtherTabs: (keepFileId: FileId) => void;
}
```

### 8.2 Implementation

```typescript
// Inside projectStore (or dedicated tabStore)

openTab: (fileId) => {
  set((state) => {
    // If tab is already open, just activate it
    if (state.openTabIds.includes(fileId)) {
      state.activeTabId = fileId;
      return;
    }

    // Insert after the currently active tab, or at the end
    const activeIndex = state.openTabIds.indexOf(state.activeTabId!);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : state.openTabIds.length;

    state.openTabIds.splice(insertIndex, 0, fileId);
    state.activeTabId = fileId;
  });
},

closeTab: (fileId) => {
  set((state) => {
    const index = state.openTabIds.indexOf(fileId);
    if (index === -1) return;

    state.openTabIds.splice(index, 1);

    // If closing the active tab, activate an adjacent tab
    if (state.activeTabId === fileId) {
      // Prefer the tab to the right, then left
      const nextIndex = Math.min(index, state.openTabIds.length - 1);
      state.activeTabId = state.openTabIds[nextIndex] ?? null;
    }
  });
},

reorderTabs: (tabIds) => {
  set((state) => {
    state.openTabIds = tabIds;
  });
},

setActiveTab: (fileId) => {
  set((state) => {
    state.activeTabId = fileId;
  });
},

closeAllTabs: () => {
  set((state) => {
    state.openTabIds = [];
    state.activeTabId = null;
  });
},

closeOtherTabs: (keepFileId) => {
  set((state) => {
    state.openTabIds = [keepFileId];
    state.activeTabId = keepFileId;
  });
},
```

### 8.3 Dirty Indicator Dots

Dirty state is already tracked per-file in `editorStore.dirtyMap`. Tab components derive the dirty indicator from the store:

```typescript
function SortableTab({ tab }: { tab: TabItem }) {
  const isDirty = useEditorStore(
    (s) => s.dirtyMap[tab.id as FileId] ?? false
  );

  return (
    <div className="group flex items-center ...">
      {/* ... */}
      {isDirty && (
        <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
      )}
      {/* ... */}
    </div>
  );
}
```

**Optimization**: Subscribe to `dirtyMap` with a selector to minimize re-renders:

```typescript
const isDirty = useEditorStore(
  useCallback((s) => s.dirtyMap[fileId] ?? false, [fileId])
);
```

### 8.4 Tab State Persistence

Tab state (which files are open, which is active, tab order) should persist with the project in IndexedDB so the user returns to the same state. Include `openTabIds` and `activeTabId` in the `Project` record.

---

## 9. Middle-Click to Close Tabs

### 9.1 Implementation

Middle-click (mouse button 1) is a standard browser pattern for closing tabs (used by Chrome, Firefox, VS Code). The `mousedown` event fires for all buttons; check `e.button`:

```typescript
<div
  onMouseDown={(e) => {
    // button === 1 is the middle mouse button
    if (e.button === 1) {
      e.preventDefault(); // Prevent autoscroll
      onClose(tab.id);
    }
  }}
  onClick={() => onActivate(tab.id)} // Left click (button === 0) still activates
>
```

### 9.2 Why `onMouseDown` Not `onClick`

- `click` events don't fire for middle mouse button in most browsers
- `auxclick` fires for non-primary buttons but has inconsistent support
- `mousedown` fires for all buttons and is the most reliable

### 9.3 Preventing Drag on Middle-Click

When using `@dnd-kit`, the `listeners` from `useSortable` attach to `onPointerDown`. Middle-click shouldn't trigger a drag. Solution: conditionally apply listeners:

```typescript
const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
  id: tab.id,
});

// Filter out middle-click from drag listeners
const dragListeners = {
  ...listeners,
  onPointerDown: listeners?.onPointerDown
    ? (e: React.PointerEvent) => {
        if (e.button === 1) return; // Skip middle button
        listeners.onPointerDown(e);
      }
    : undefined,
};
```

---

## 10. Implementation Recommendations

### 10.1 Component File Structure

```
src/components/file-tree/
├── FileTree.tsx              # Main file tree container (virtualized)
├── FileTreeRow.tsx           # Individual row (file or directory)
├── FileTreeContextMenu.tsx   # Right-click context menu
├── useFileTree.ts            # Hook: builds tree, manages expandedDirs
└── fileIcons.ts              # Icon mapping utilities

src/components/editor/
├── ProjectFileTabs.tsx       # Tab bar with DnD (replaces SingleFileTabs in project mode)
├── SortableTab.tsx           # Individual sortable tab
└── SingleFileTabs.tsx        # Existing — kept for single-file mode
```

### 10.2 New Dependencies to Install

```bash
npm install @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

| Package | Version | Gzipped Size | Purpose |
|---------|---------|-------------|---------|
| `@tanstack/react-virtual` | ^3.13 | ~5KB | Virtualized file tree rendering |
| `@dnd-kit/core` | ^6.3 | ~12KB | Drag-and-drop engine |
| `@dnd-kit/sortable` | ^10.0 | ~5KB | Sortable utility on top of core |
| `@dnd-kit/utilities` | ^3.2 | ~1KB | CSS transform utilities |

Total added: ~23KB gzipped (only loaded in project mode — can be lazy-loaded).

### 10.3 Implementation Order

1. **fileIcons.ts** — Pure utility, no dependencies
2. **useFileTree.ts** — Tree building + flattening logic, testable independently
3. **FileTreeRow.tsx** — Visual component, can be developed with static data
4. **FileTree.tsx** — Integrate virtualizer + expand/collapse + row rendering
5. **FileTreeContextMenu.tsx** — Context menu on top of working tree
6. **Inline rename** — Add to FileTreeRow
7. **SortableTab.tsx** — Individual tab with useSortable
8. **ProjectFileTabs.tsx** — Tab bar with DndContext + SortableContext
9. **Tab overflow** — Scroll handling + auto-scroll to active tab

### 10.4 Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Tree rebuild on every file change | Memoize with `useMemo([files, expandedDirs])` |
| Virtualizer re-render on scroll | `@tanstack/react-virtual` only renders visible items |
| Tab drag performance | `@dnd-kit` uses CSS transforms (GPU-accelerated) |
| Zustand re-renders on content change | Fine-grained selectors (`s.dirtyMap[fileId]`) |
| Context menu portal rendering | Use Radix Portal or `createPortal` to avoid z-index issues |

### 10.5 Accessibility

- File tree: `role="tree"`, `role="treeitem"`, `aria-expanded` on directories, arrow key navigation
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`, Ctrl+Tab/Ctrl+Shift+Tab for switching
- Context menu: `role="menu"`, `role="menuitem"`, arrow key navigation, Escape to close
- Inline rename: Focus the input, announce via `aria-label="Rename file"`

### 10.6 Testing Strategy

- **Unit tests**: `buildTree()`, `flattenTree()`, `getFileIcon()`, tab state actions
- **Component tests**: FileTreeRow rendering, expand/collapse, rename flow, tab close/reorder
- **Integration tests**: Click file in tree → tab opens → content loads; drag tab → order updates

---

## Appendix A: Complete useFileTree Hook

```typescript
import { useMemo, useCallback, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { FileId, FileType } from '@/types';

// ─── Types ───────────────────────────────────────────────────

export interface FlatTreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  depth: number;
  path: string;
  fileType?: FileType;
  isDirty?: boolean;
  isExpanded?: boolean;
  fileId?: FileId;
  parentId: string;
}

// ─── Hook ────────────────────────────────────────────────────

export function useFileTree(projectId: string | undefined) {
  const files = useProjectStore((s) => s.files);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Build the tree from flat file map
  const flatNodes = useMemo(() => {
    if (!projectId) return [];

    const projectFiles = Object.values(files).filter(
      (f) => f.projectId === projectId
    );

    // Build hierarchical tree
    const root: TreeNode = { id: 'root', children: [] };

    for (const file of projectFiles) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          current.children.push({
            id: file.id,
            name: parts[i],
            type: 'file',
            depth: i,
            path: file.path,
            fileType: file.type,
            isDirty: file.isDirty,
            children: [],
          });
        } else {
          let dir = current.children.find(
            (c) => c.type === 'directory' && c.name === parts[i]
          );
          if (!dir) {
            dir = {
              id: `dir:${currentPath}`,
              name: parts[i],
              type: 'directory',
              depth: i,
              path: currentPath,
              children: [],
            };
            current.children.push(dir);
          }
          current = dir;
        }
      }
    }

    // Sort: directories first, then files, alphabetical
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((n) => sortChildren(n.children));
    };
    sortChildren(root.children);

    // Flatten for virtualization (respecting expanded state)
    const result: FlatTreeNode[] = [];
    const walk = (nodes: TreeNode[], parentId: string) => {
      for (const node of nodes) {
        result.push({
          id: node.id,
          name: node.name,
          type: node.type,
          depth: node.depth,
          path: node.path,
          fileType: node.fileType,
          isDirty: node.isDirty,
          isExpanded: node.type === 'directory' ? expandedDirs.has(node.path) : undefined,
          fileId: node.type === 'file' ? node.id as FileId : undefined,
          parentId,
        });
        if (node.type === 'directory' && expandedDirs.has(node.path)) {
          walk(node.children, node.id);
        }
      }
    };
    walk(root.children, 'root');

    return result;
  }, [files, projectId, expandedDirs]);

  // Toggle directory expansion
  const toggleDir = useCallback((dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  }, []);

  // Expand all directories
  const expandAll = useCallback(() => {
    const allDirs = flatNodes
      .filter((n) => n.type === 'directory')
      .map((n) => n.path);
    setExpandedDirs(new Set(allDirs));
  }, [flatNodes]);

  // Collapse all directories
  const collapseAll = useCallback(() => {
    setExpandedDirs(new Set());
  }, []);

  return {
    flatNodes,
    expandedDirs,
    toggleDir,
    expandAll,
    collapseAll,
  };
}

// Internal tree node (not exported)
interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  depth?: number;
  path?: string;
  fileType?: FileType;
  isDirty?: boolean;
  children: TreeNode[];
}
```

## Appendix B: Complete SortableTab Component

```typescript
import { useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { getFileIcon } from '../file-tree/fileIcons';
import type { FileId } from '@/types';

interface SortableTabProps {
  fileId: FileId;
  name: string;
  isActive: boolean;
  isDirty: boolean;
  onClose: (fileId: FileId) => void;
  onActivate: (fileId: FileId) => void;
}

export function SortableTab({
  fileId,
  name,
  isActive,
  isDirty,
  onClose,
  onActivate,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const { icon: Icon, color } = getFileIcon(name);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        // Middle-click: close tab
        e.preventDefault();
        onClose(fileId);
      }
    },
    [fileId, onClose]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-tab-id={fileId}
      className={`
        group relative flex items-center gap-1.5 pl-3 pr-2 py-2 text-xs font-medium
        border-r border-slate-200 dark:border-slate-700/50 cursor-pointer
        select-none shrink-0 min-w-0 max-w-[180px]
        ${isActive
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        }
      `}
      {...attributes}
      {...listeners}
      onClick={() => onActivate(fileId)}
      onMouseDown={handleMouseDown}
    >
      {/* Active indicator line */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" />
      )}

      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />

      <span className="truncate">{name}</span>

      {/* Dirty dot or close button */}
      {isDirty ? (
        <span className="ml-auto h-2 w-2 rounded-full bg-sky-400 shrink-0" />
      ) : null}

      <button
        className={`
          ml-auto shrink-0 h-4 w-4 rounded-sm flex items-center justify-center
          hover:bg-slate-200 dark:hover:bg-slate-600
          ${isDirty ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
        onClick={(e) => {
          e.stopPropagation();
          onClose(fileId);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
```

## Appendix C: Zustand Tab State Slice

```typescript
// Add to projectStore or create a dedicated tabStore

interface TabSlice {
  // State
  openTabIds: FileId[];
  activeTabId: FileId | null;

  // Actions
  openTab: (fileId: FileId) => void;
  closeTab: (fileId: FileId) => void;
  closeOtherTabs: (keepFileId: FileId) => void;
  closeAllTabs: () => void;
  closeTabsToRight: (fileId: FileId) => void;
  reorderTabs: (tabIds: FileId[]) => void;
  setActiveTab: (fileId: FileId | null) => void;
}

const createTabSlice: StateCreator<ProjectState, [], [], TabSlice> = (set, get) => ({
  openTabIds: [],
  activeTabId: null,

  openTab: (fileId) => set((state) => {
    if (state.openTabIds.includes(fileId)) {
      state.activeTabId = fileId;
      return;
    }
    const activeIndex = state.openTabIds.indexOf(state.activeTabId!);
    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : state.openTabIds.length;
    state.openTabIds.splice(insertIndex, 0, fileId);
    state.activeTabId = fileId;
  }),

  closeTab: (fileId) => set((state) => {
    const index = state.openTabIds.indexOf(fileId);
    if (index === -1) return;
    state.openTabIds.splice(index, 1);
    if (state.activeTabId === fileId) {
      const nextIndex = Math.min(index, state.openTabIds.length - 1);
      state.activeTabId = state.openTabIds[nextIndex] ?? null;
    }
  }),

  closeOtherTabs: (keepFileId) => set((state) => {
    state.openTabIds = [keepFileId];
    state.activeTabId = keepFileId;
  }),

  closeAllTabs: () => set((state) => {
    state.openTabIds = [];
    state.activeTabId = null;
  }),

  closeTabsToRight: (fileId) => set((state) => {
    const index = state.openTabIds.indexOf(fileId);
    if (index === -1) return;
    state.openTabIds = state.openTabIds.slice(0, index + 1);
    if (state.activeTabId && !state.openTabIds.includes(state.activeTabId)) {
      state.activeTabId = fileId;
    }
  }),

  reorderTabs: (tabIds) => set((state) => {
    state.openTabIds = tabIds;
  }),

  setActiveTab: (fileId) => set((state) => {
    state.activeTabId = fileId;
  }),
});
```
