# LiveFrame — Phase 1.4: IndexedDB Persistence Research Report

> **Sub-agent**: IndexedDB + idb Persistence Researcher
> **Date**: 2026-05-29
> **Project**: LiveFrame — Browser-based HTML/CSS/JS Code Editor
> **Stack**: React 19 + Vite 6 + TypeScript 5.8 + Zustand 5 + idb 8.x

---

## Table of Contents

1. [`idb` Library API Patterns](#1-idb-library-api-patterns)
2. [Two-Tier Debounce Auto-Save](#2-two-tier-debounce-auto-save)
3. [Database Versioning & Migration](#3-database-versioning--migration)
4. [Error Handling & Graceful Degradation](#4-error-handling--graceful-degradation)
5. [Performance Considerations](#5-performance-considerations)
6. [Integration with Zustand](#6-integration-with-zustand)
7. [Recommended Implementation Architecture](#7-recommended-implementation-architecture)

---

## 1. `idb` Library API Patterns

### 1.1 Overview

The `idb` library (v8.x, by Jake Archibald) is a tiny (~1.2KB gzipped) promise-based wrapper over the raw IndexedDB API. It converts the event-driven, callback-heavy IndexedDB API into a clean async/await interface while providing full TypeScript type safety through a `DBSchema` generic.

**Key advantages over raw IndexedDB:**
- Promise-based: every operation returns a `Promise` instead of using `IDBRequest` + event listeners
- Type-safe: `openDB<DBSchema>` infers store names, value types, key types, and index types throughout the API
- Transaction auto-completion: transactions commit automatically when the microtask queue drains (no manual `transaction.commit()` needed)
- Async iterators: stores and indexes support `for await...of` for cursor-based iteration

### 1.2 Defining a Typed Database Schema

The core of `idb`'s TypeScript integration is the `DBSchema` interface. Each property in the schema defines an object store, with nested `key`, `value`, and optional `indexes` types:

```typescript
import { DBSchema, IDBPDatabase, openDB } from 'idb';

// ─── Value Types (domain models) ────────────────────────────

interface ProjectValue {
  id: string;
  name: string;
  mode: 'single-file' | 'project';
  fileIds: string[];
  externalResources: ExternalResource[];
  createdAt: string;   // ISO 8601
  updatedAt: string;
  activeFileId: string | null;
  templateId: string | null;
}

interface FileValue {
  id: string;
  projectId: string;
  path: string;
  name: string;
  type: FileType;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  isDirty: boolean;
  isVirtual: boolean;
}

interface SettingsValue {
  key: string;
  value: Record<string, unknown>;
}

// ─── Database Schema Definition ─────────────────────────────

interface LiveFrameDB extends DBSchema {
  projects: {
    key: string;                    // keyPath = 'id', type = ProjectId
    value: ProjectValue;
    indexes: {
      'by-updatedAt': string;      // index on updatedAt for "recently updated" sorting
      'by-name': string;           // index on name for alphabetical listing
    };
  };
  files: {
    key: string;                    // keyPath = 'id', type = FileId
    value: FileValue;
    indexes: {
      'by-projectId': string;                         // all files in a project
      'by-projectId-path': [string, string];          // compound unique index
    };
  };
  settings: {
    key: string;                    // keyPath = 'key', e.g. 'workspace', 'editor'
    value: SettingsValue;
  };
}
```

**Key design decisions:**

1. **`key` type matches keyPath field type** — Since we use `{ keyPath: 'id' }`, the `key` type must match the type of the `id` property in the value (both `string`).
2. **Compound indexes use tuple types** — The `by-projectId-path` index on `['projectId', 'path']` uses `[string, string]` as its type.
3. **Indexes are optional** — The `indexes` property in the schema is optional. Only add indexes you'll actually query.
4. **Settings store uses a string key** — Simple key-value pairs for workspace preferences; `keyPath: 'key'` lets us do `db.get('settings', 'workspace')`.

### 1.3 Opening the Database and Creating Stores

```typescript
const DB_NAME = 'liveframe-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<LiveFrameDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<LiveFrameDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LiveFrameDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // ─── Projects Store ────────────────────────
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updatedAt', 'updatedAt');
        projectStore.createIndex('by-name', 'name');
      }

      // ─── Files Store ───────────────────────────
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-projectId', 'projectId');
        fileStore.createIndex('by-projectId-path', ['projectId', 'path'], {
          unique: true,  // enforces unique (projectId, path) pairs
        });
      }

      // ─── Settings Store ────────────────────────
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },

    blocked(currentVersion, blockedVersion) {
      console.warn(
        `[LiveFrame DB] Upgrade blocked — close other tabs (current: ${currentVersion}, blocked: ${blockedVersion})`
      );
    },

    blocking(currentVersion, blockedVersion) {
      console.warn(
        `[LiveFrame DB] This tab is blocking an upgrade (current: ${currentVersion}, blocked: ${blockedVersion})`
      );
    },

    terminated() {
      console.error('[LiveFrame DB] Connection terminated unexpectedly');
      dbInstance = null;  // allow reconnection on next getDB() call
    },
  });

  return dbInstance;
}
```

**Critical notes on the `upgrade` callback:**

- It runs inside a `versionchange` transaction — the ONLY place where you can create/delete object stores and indexes.
- The `!db.objectStoreNames.contains(...)` guard is essential: `openDB` runs the upgrade callback for **every** version jump. If a user goes from v1 → v3, the v2 and v3 upgrades all run in sequence within the same transaction. Without guards, you'd try to create stores that already exist.
- The `transaction` parameter gives you access to the upgrade transaction if you need to migrate data between stores.

### 1.4 CRUD Operations — Shortcuts vs Transactions

`idb` provides two styles for database operations:

#### Shortcut Methods (single operation, auto-transaction)

These are convenient but create a separate transaction per call. Use for one-off operations:

```typescript
const db = await getDB();

// CREATE / UPDATE (put = upsert, add = insert-only)
await db.put('projects', projectValue);                    // upsert by keyPath
await db.add('files', fileValue);                          // rejects if key exists

// READ
const project = await db.get('projects', projectId);       // → ProjectValue | undefined
const allProjects = await db.getAll('projects');            // → ProjectValue[]
const recentProjects = await db.getAllFromIndex(
  'projects',
  'by-updatedAt'                                            // type-checked index name
);                                                          // → ProjectValue[]

// READ with compound index
const existingFile = await db.getFromIndex(
  'files',
  'by-projectId-path',
  [projectId, 'src/App.tsx']                                // tuple key for compound index
);

// COUNT
const fileCount = await db.countFromIndex('files', 'by-projectId', projectId);

// DELETE
await db.delete('files', fileId);
await db.clear('files');                                    // delete all records in store
```

#### Transaction Methods (multi-operation, atomic)

Use when you need atomicity across multiple writes or when writing multiple records:

```typescript
const db = await getDB();

// Single-store transaction
const tx = db.transaction('files', 'readwrite');
await tx.store.put(fileValue1);
await tx.store.put(fileValue2);
await tx.store.put(fileValue3);
await tx.done;  // resolves when transaction completes

// Multi-store transaction (atomic across stores)
const tx2 = db.transaction(['projects', 'files'], 'readwrite');
await tx2.objectStore('projects').put(updatedProject);
await tx2.objectStore('files').delete(fileId);
await tx2.done;

// Read-write with durability option (Chromium-only)
const tx3 = db.transaction('files', 'readwrite', {
  durability: 'relaxed',  // better perf, fewer guarantees — ideal for auto-save
});
```

**`tx.done` vs individual operation promises:**
- Each `put`/`add`/`delete` returns a promise that resolves when that specific operation succeeds.
- `tx.done` resolves when the entire transaction commits. **Always `await tx.done`** if you need to know the transaction succeeded — individual operation promises can resolve even if the transaction later aborts.

### 1.5 Cursor-Based Iteration

`idb` supports `for await...of` iteration over stores and indexes:

```typescript
const db = await getDB();

// Iterate all files in a project using index
const tx = db.transaction('files', 'readonly');
const index = tx.store.index('by-projectId');

const projectFiles: FileValue[] = [];
for await (const cursor of index.iterate(projectId)) {
  projectFiles.push(cursor.value);
  // cursor.delete() — available in readwrite transactions
  // cursor.update(modifiedValue) — available in readwrite transactions
}

// Key-only iteration (cheaper, no value deserialization)
for await (const cursor of tx.store.openKeyCursor()) {
  console.log(cursor.key);  // just the key, no value
}
```

**When to use cursors vs `getAll`:**
- Use `getAll` / `getAllFromIndex` when you need **all** records and they fit comfortably in memory (< 10,000 records for LiveFrame's use case).
- Use cursors when you need **pagination**, **streaming processing**, or **selective deletion**.
- Use `openKeyCursor` when you only need keys (e.g., to delete records by key range).

---

## 2. Two-Tier Debounce Auto-Save

### 2.1 Problem Statement

The Phase 1.4 spec calls for "two-tier debounce: structural immediate, content 3s". This means:

- **Structural changes** (file create, file delete, file rename, project create, project delete) → save **immediately** (no debounce).
- **Content changes** (keystrokes in the editor, updating a file's text content) → save with a **3-second debounce** per file.

This distinction exists because:
1. Structural changes are infrequent and high-stakes — losing a file creation or deletion is catastrophic.
2. Content changes are extremely frequent (every keystroke) and low-stakes for any single character — losing 3 seconds of typing is acceptable.
3. Debouncing content writes reduces IndexedDB write load dramatically (from ~1 write/keystroke to ~1 write/3s per file).

### 2.2 Architecture: Save Scheduler

```typescript
// src/lib/save-scheduler.ts

type SaveOperation =
  | { type: 'structural'; store: 'projects' | 'files' | 'settings'; data: unknown }
  | { type: 'content'; fileId: string; data: FileValue };

// Per-file debounce timers for content saves
const contentTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Queue for pending content saves (latest data per file)
const pendingContentSaves = new Map<string, FileValue>();

// Batched structural saves (immediate, but can be batched within a microtask)
let structuralFlushPromise: Promise<void> | null = null;
const pendingStructuralSaves: SaveOperation[] = [];

const CONTENT_DEBOUNCE_MS = 3000;

export function scheduleSave(operation: SaveOperation): void {
  if (operation.type === 'structural') {
    // Structural: save immediately (within current microtask batch)
    pendingStructuralSaves.push(operation);
    if (!structuralFlushPromise) {
      structuralFlushPromise = Promise.resolve().then(flushStructuralSaves);
    }
  } else {
    // Content: debounce per-file
    const { fileId, data } = operation;
    pendingContentSaves.set(fileId, data);  // always keep the latest data

    if (contentTimers.has(fileId)) {
      clearTimeout(contentTimers.get(fileId)!);
    }

    contentTimers.set(
      fileId,
      setTimeout(() => {
        flushContentSave(fileId);
      }, CONTENT_DEBOUNCE_MS)
    );
  }
}

async function flushStructuralSaves(): Promise<void> {
  const batch = [...pendingStructuralSaves];
  pendingStructuralSaves.length = 0;
  structuralFlushPromise = null;

  try {
    const db = await getDB();
    // Group by store for efficient transactions
    const byStore = new Map<string, unknown[]>();
    for (const op of batch) {
      const items = byStore.get(op.store) ?? [];
      items.push(op.data);
      byStore.set(op.store, items);
    }

    for (const [storeName, items] of byStore) {
      const tx = db.transaction(storeName as StoreNames<LiveFrameDB>, 'readwrite', {
        durability: 'relaxed',
      });
      for (const item of items) {
        await tx.store.put(item);
      }
      await tx.done;
    }
  } catch (error) {
    console.error('[SaveScheduler] Structural save failed:', error);
  }
}

async function flushContentSave(fileId: string): Promise<void> {
  const data = pendingContentSaves.get(fileId);
  if (!data) return;

  pendingContentSaves.delete(fileId);
  contentTimers.delete(fileId);

  try {
    const db = await getDB();
    await db.put('files', data, { durability: 'relaxed' } as any);
  } catch (error) {
    console.error(`[SaveScheduler] Content save failed for file ${fileId}:`, error);
    // Re-queue the save for retry
    pendingContentSaves.set(fileId, data);
    scheduleSave({ type: 'content', fileId, data });
  }
}

/** Force-flush all pending saves (call on beforeunload) */
export async function flushAll(): Promise<void> {
  // Flush structural saves
  if (pendingStructuralSaves.length > 0) {
    await flushStructuralSaves();
  }

  // Flush all pending content saves
  const fileIds = [...pendingContentSaves.keys()];
  for (const fileId of fileIds) {
    clearTimeout(contentTimers.get(fileId)!);
    await flushContentSave(fileId);
  }
}
```

### 2.3 Integration with Zustand Store Actions

The two-tier approach integrates naturally with Zustand actions:

```typescript
// In projectStore.ts

addFile: (projectId, path, content = '') => {
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  const file: FileValue = {
    id: fileId,
    projectId,
    path,
    name: path.split('/').pop()!,
    type: getFileType(path),
    content,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    isVirtual: false,
  };

  set((state) => {
    state.files[fileId] = file;
    if (state.projects[projectId]) {
      state.projects[projectId].fileIds.push(fileId);
      state.projects[projectId].updatedAt = now;
    }
  });

  // Structural: save project + new file immediately
  const project = get().projects[projectId];
  scheduleSave({ type: 'structural', store: 'projects', data: project });
  scheduleSave({ type: 'structural', store: 'files', data: file });

  return fileId;
},

deleteFile: (fileId) => {
  const file = get().files[fileId];
  if (!file) return;

  const projectId = file.projectId;

  set((state) => {
    delete state.files[fileId];
    if (state.projects[projectId]) {
      state.projects[projectId].fileIds =
        state.projects[projectId].fileIds.filter(id => id !== fileId);
      state.projects[projectId].updatedAt = new Date().toISOString();
    }
  });

  // Structural: delete from IDB immediately
  (async () => {
    const db = await getDB();
    const tx = db.transaction(['projects', 'files'], 'readwrite');
    await tx.objectStore('files').delete(fileId);
    await tx.objectStore('projects').put(get().projects[projectId]);
    await tx.done;
  })();

  // Also clean up any pending content save for this file
  pendingContentSaves.delete(fileId);
  if (contentTimers.has(fileId)) {
    clearTimeout(contentTimers.get(fileId)!);
    contentTimers.delete(fileId);
  }
},
```

```typescript
// In editorStore.ts

updateContent: (fileId, content) => {
  const now = new Date().toISOString();

  set((state) => {
    state.contents[fileId] = content;
    state.dirtyMap[fileId] = true;
  });

  // Also update the FileEntry in project store
  useProjectStore.setState((state) => {
    if (state.files[fileId]) {
      state.files[fileId].content = content;
      state.files[fileId].isDirty = true;
      state.files[fileId].updatedAt = now;
    }
  });

  // Content: debounced save (3s)
  const file = useProjectStore.getState().files[fileId];
  if (file) {
    scheduleSave({ type: 'content', fileId, data: { ...file, content } });
  }
},
```

### 2.4 BeforeUnload Handler

When the user closes the tab or navigates away, we must flush pending saves:

```typescript
// src/lib/persistence-init.ts

window.addEventListener('beforeunload', () => {
  // beforeunload handlers should be synchronous and fast.
  // Use a synchronous XHR trick or navigator.sendBeacon for reliability.
  // For IndexedDB, the best we can do is start the flush — the browser
  // may or may not complete it.

  // Option 1: Start the flush and hope the browser completes it
  flushAll();

  // Option 2: Use navigator.sendBeacon (not applicable for IndexedDB)

  // Option 3: Warn the user if there are unsaved changes
  if (pendingContentSaves.size > 0) {
    // The beforeunload event can trigger a "Leave site?" dialog
    event.preventDefault();
  }
});

// Also use the 'pagehide' event which is more reliable on mobile
window.addEventListener('pagehide', () => {
  flushAll();
});
```

**Important caveat**: IndexedDB writes are asynchronous. There is no guaranteed way to force a synchronous IndexedDB write during `beforeunload`. The best strategies are:

1. **Keep debounce intervals short enough** that 3 seconds of data loss is acceptable.
2. **Show a warning dialog** via `beforeunload` if there are pending saves, giving the user a chance to stay on the page.
3. **Use the `visibilitychange` event** to flush saves when the tab becomes hidden (more reliable than `beforeunload` on mobile).

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushAll();  // flush when tab goes to background
  }
});
```

---

## 3. Database Versioning & Migration

### 3.1 How `openDB` Versioning Works

IndexedDB uses a version number to manage schema changes:

- When `openDB(name, version)` is called with a `version` higher than the existing database, the `upgrade` callback fires.
- The `upgrade` callback receives `(db, oldVersion, newVersion, transaction)`.
- **All upgrades run in a single `versionchange` transaction** — if the user goes from v1 → v4, the upgrade callback fires once with `oldVersion=1, newVersion=4`. You must handle all intermediate steps within that one call.
- If another tab has the database open, the upgrade is **blocked** until that tab closes. The `blocked` callback fires to notify you.
- The `blocking` callback fires on the old tab to let it know it should close the connection.

### 3.2 Recommended Migration Pattern

Use a switch-case with fall-through for incremental migrations:

```typescript
const DB_VERSION = 4;  // increment when adding schema changes

export async function getDB(): Promise<IDBPDatabase<LiveFrameDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LiveFrameDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
      // Switch with fall-through: each case adds the changes for that version
      switch (oldVersion) {
        case 0:
          // ─── Version 1: Initial schema ────────────
          {
            const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
            projectStore.createIndex('by-updatedAt', 'updatedAt');
            projectStore.createIndex('by-name', 'name');

            const fileStore = db.createObjectStore('files', { keyPath: 'id' });
            fileStore.createIndex('by-projectId', 'projectId');
            fileStore.createIndex('by-projectId-path', ['projectId', 'path'], {
              unique: true,
            });

            db.createObjectStore('settings', { keyPath: 'key' });
          }
        // falls through!

        case 1:
          // ─── Version 2: Add description to projects ────────────
          {
            // No need to recreate the store — just add new indexes
            // For adding a new field to existing records, migrate data:
            const projectStore = tx.objectStore('projects');
            // Note: we cannot add new indexes here without the store reference
            // from the versionchange transaction
          }
        // falls through!

        case 2:
          // ─── Version 3: Add templates store ────────────────────
          {
            if (!db.objectStoreNames.contains('templates')) {
              const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
              templateStore.createIndex('by-category', 'category');
            }
          }
        // falls through!

        case 3:
          // ─── Version 4: Add by-mode index to projects ──────────
          {
            // Adding an index to an existing store
            const projectStore = tx.objectStore('projects');
            projectStore.createIndex('by-mode', 'mode');
          }
        // falls through!
      }
    },

    blocked() {
      console.warn('[LiveFrame DB] Upgrade blocked — please close other tabs');
    },

    blocking() {
      console.warn('[LiveFrame DB] Blocking upgrade — refreshing recommended');
      // Optionally: auto-reload to allow upgrade
      // window.location.reload();
    },

    terminated() {
      console.error('[LiveFrame DB] Connection terminated');
      dbInstance = null;
    },
  });

  return dbInstance;
}
```

### 3.3 Data Migration Strategies

When changing the **shape** of stored values (adding/removing/renaming fields), you need to migrate existing data:

```typescript
// Example: Version 2 adds a 'description' field to ProjectValue
case 1:
  {
    const store = tx.objectStore('projects');
    // Use cursor to update all existing records
    (async () => {
      let cursor = await store.openCursor();
      while (cursor) {
        const project = cursor.value;
        // Add default value for new field
        project.description = '';
        await cursor.update(project);
        cursor = await cursor.continue();
      }
    })();
  }
```

**Important**: The `upgrade` transaction is the only place you can modify the schema. Data migrations within it use the transaction's object stores.

### 3.4 Best Practices for Versioning

1. **Never modify an existing version number** — once a version is deployed, its upgrade logic must remain unchanged. Always add a new case.
2. **Use `!db.objectStoreNames.contains()` guards** — even with fall-through, this is extra safety against edge cases.
3. **Test migration paths** — test upgrading from v1→v4 directly, not just v3→v4.
4. **Keep the DB_VERSION constant in sync** — increment it every time you add an upgrade case.
5. **Handle the `blocked` callback** — show a user-facing message asking them to close other tabs.
6. **Don't delete old migration code** — users may have very old database versions.

---

## 4. Error Handling & Graceful Degradation

### 4.1 Detecting IndexedDB Availability

Not all environments support IndexedDB. It may be unavailable in:

- **Private browsing mode** (Safari historically, though modern Safari supports it with quotas)
- **IndexedDB disabled by browser policy**
- **Storage API blocked** (some iframe contexts)
- **WebKit bug on older iOS** that throws during IDB open in private mode

```typescript
// src/lib/idb-availability.ts

let idbAvailable: boolean | null = null;

export function isIndexedDBAvailable(): boolean {
  if (idbAvailable !== null) return idbAvailable;

  try {
    // Check if the API exists
    if (typeof indexedDB === 'undefined') {
      idbAvailable = false;
      return false;
    }

    // Try opening a test database (catches private browsing issues)
    const testDB = indexedDB.open('__liveframe_test__');
    testDB.onerror = () => {
      idbAvailable = false;
    };
    testDB.onsuccess = () => {
      testDB.result.close();
      indexedDB.deleteDatabase('__liveframe_test__');
      idbAvailable = true;
    };

    // Optimistic: assume available until proven otherwise
    idbAvailable = true;
    return true;
  } catch {
    idbAvailable = false;
    return false;
  }
}

/** Async version — waits for the test database to confirm availability */
export async function checkIndexedDBAvailable(): Promise<boolean> {
  if (idbAvailable !== null) return idbAvailable;

  try {
    if (typeof indexedDB === 'undefined') {
      idbAvailable = false;
      return false;
    }

    const db = await openDB('__liveframe_test__', 1, {
      upgrade(db) {
        db.createObjectStore('test');
      },
    });
    db.close();
    await deleteDB('__liveframe_test__');
    idbAvailable = true;
    return true;
  } catch {
    idbAvailable = false;
    return false;
  }
}
```

### 4.2 Storage Quota Exceeded

IndexedDB writes can fail when the browser's storage quota is exceeded. The error is a `DOMException` with name `'QuotaExceededError'`:

```typescript
async function safePut(
  storeName: StoreNames<LiveFrameDB>,
  value: StoreValue<LiveFrameDB, typeof storeName>
): Promise<boolean> {
  try {
    const db = await getDB();
    await db.put(storeName, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        console.error('[LiveFrame] Storage quota exceeded. Consider deleting old projects.');
        // Show user-facing notification
        showStorageWarning();
        return false;
      }
    }
    console.error('[LiveFrame] Failed to save:', error);
    return false;
  }
}

function showStorageWarning(): void {
  // Use a toast/notification to inform the user
  // Optionally: calculate current storage usage and suggest cleanup
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(({ usage, quota }) => {
      const usedMB = ((usage ?? 0) / 1024 / 1024).toFixed(1);
      const totalMB = ((quota ?? 0) / 1024 / 1024).toFixed(1);
      console.warn(`Storage: ${usedMB}MB / ${totalMB}MB used`);
    });
  }
}
```

### 4.3 Handling DB Connection Termination

The `terminated` callback in `openDB` fires when the browser abnormally closes the database connection (e.g., the user clears site data, the browser runs out of memory, or the OS reclaims storage). Handle this by:

1. Nullifying the cached `dbInstance` so the next `getDB()` call reopens the connection.
2. Optionally re-reading state from the fresh connection to verify data integrity.

```typescript
terminated() {
  console.error('[LiveFrame DB] Connection terminated unexpectedly');
  dbInstance = null;

  // Optionally: notify the app to re-hydrate from IndexedDB
  // This could dispatch an event or call a Zustand action
  window.dispatchEvent(new CustomEvent('liveframe:db-terminated'));
}
```

### 4.4 Graceful Fallback Strategy

When IndexedDB is unavailable, fall back to `localStorage` for small data:

```typescript
// src/lib/storage-adapter.ts

import { PersistStorage, StorageValue } from 'zustand/middleware';

function createIDBPersistStorage<S>(): PersistStorage<S> | undefined {
  // Only create if IndexedDB is available
  if (!isIndexedDBAvailable()) return undefined;

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      try {
        const db = await getDB();
        const result = await db.get('settings', name);
        if (!result) return null;
        return result.value as StorageValue<S>;
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: StorageValue<S>): Promise<void> => {
      try {
        const db = await getDB();
        await db.put('settings', { key: name, value });
      } catch (error) {
        console.error(`[IDB Storage] Failed to set ${name}:`, error);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const db = await getDB();
        await db.delete('settings', name);
      } catch (error) {
        console.error(`[IDB Storage] Failed to remove ${name}:`, error);
      }
    },
  };
}

function createLocalStorageFallback<S>(): PersistStorage<S> {
  return createJSONStorage(() => localStorage);
}

export function getPersistStorage<S>(): PersistStorage<S> {
  return createIDBPersistStorage<S>() ?? createLocalStorageFallback<S>();
}
```

### 4.5 Summary of Error Scenarios

| Scenario | Error | Detection | Mitigation |
|----------|-------|-----------|------------|
| Private browsing (old Safari) | `DOMException` on `openDB` | `checkIndexedDBAvailable()` | Fall back to localStorage |
| Storage quota exceeded | `QuotaExceededError` | Catch in write operations | Show warning, suggest cleanup |
| DB connection terminated | `terminated` callback | Set `dbInstance = null` | Re-open on next access |
| Upgrade blocked by other tab | `blocked` callback | Show UI message | Ask user to close other tabs |
| Corrupted database | Various on `openDB` | Catch + `deleteDB` | Delete and recreate; warn user |
| `beforeunload` data loss | N/A (no error) | Pending saves exist | Show leave confirmation; flush on `visibilitychange` |

---

## 5. Performance Considerations

### 5.1 Batch Writes for Initial Project Load

When loading a project, all its files need to be fetched from IndexedDB. Use a transaction to read all files in a single operation:

```typescript
async function loadProject(projectId: string): Promise<{
  project: ProjectValue;
  files: FileValue[];
}> {
  const db = await getDB();

  const project = await db.get('projects', projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Use the index to get all files for this project in one read
  const files = await db.getAllFromIndex('files', 'by-projectId', projectId);

  return { project, files };
}
```

**Why `getAllFromIndex` instead of individual `get` calls?**
- `getAllFromIndex` uses a single IDB cursor internally → one transaction, one read operation.
- Individual `get` calls would each create a separate transaction → N round-trips to the IDB backend.
- For a project with 50 files, `getAllFromIndex` is roughly 50x faster than 50 individual `get` calls.

### 5.2 Transaction Usage for Atomic Multi-Record Operations

Use transactions when you need atomicity — all operations succeed or all fail:

```typescript
/** Save an entire project (project + all files) atomically */
async function saveProjectAtomic(
  project: ProjectValue,
  files: FileValue[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'files'], 'readwrite', {
    durability: 'relaxed',  // better write performance
  });

  await tx.objectStore('projects').put(project);
  for (const file of files) {
    await tx.objectStore('files').put(file);
  }

  await tx.done;  // wait for transaction to commit
}

/** Delete a project and all its files atomically */
async function deleteProjectAtomic(projectId: string): Promise<void> {
  const db = await getDB();

  // First, get all file IDs for this project
  const fileIds = await db.getAllKeysFromIndex('files', 'by-projectId', projectId);

  // Delete project + files in one transaction
  const tx = db.transaction(['projects', 'files'], 'readwrite');
  await tx.objectStore('projects').delete(projectId);
  for (const fileId of fileIds) {
    await tx.objectStore('files').delete(fileId);
  }
  await tx.done;
}
```

### 5.3 Transaction Durability Hints

IDB supports a `durability` option (Chromium-based browsers):

```typescript
db.transaction('files', 'readwrite', { durability: 'relaxed' });
```

| Durability | Behavior | Use Case |
|------------|----------|----------|
| `'default'` | Browser decides (usually `'strict'` on desktop, `'relaxed'` on mobile) | General use |
| `'strict'` | Waits for data to be flushed to disk before completing | Critical data (user-initiated explicit save) |
| `'relaxed'` | Completes as soon as data is in OS buffer | Auto-save, ephemeral data (acceptable to lose last few ms) |

**Recommendation**: Use `'relaxed'` for auto-save operations and `'default'`/`'strict'` for explicit user saves (Ctrl+S).

### 5.4 `getAll` vs Cursor-Based Iteration

| Approach | When to Use | Trade-off |
|----------|-------------|-----------|
| `db.getAll()` | Load all records (< 10,000) into memory at once | Simple, fast for small datasets. Materializes entire result set. |
| `db.getAllFromIndex()` | Load all records matching an index query | Same as above but filtered by index. |
| `for await (const cursor of store.iterate())` | Stream processing, pagination, selective update/delete | Lazy evaluation. Can break out early. Lower peak memory. |
| `store.openCursor()` | Same as iterate but with more manual control | More verbose but allows `advance()`, `continuePrimaryKey()`. |
| `store.openKeyCursor()` | Only need keys, not values | Cheapest — no value deserialization. |

**For LiveFrame's use case** (typical projects have 3–100 files, max ~500):
- **Loading a project**: Use `getAllFromIndex('files', 'by-projectId', projectId)` — simple and fast.
- **Project list page**: Use `getAll('projects')` — unlikely to exceed 100 projects.
- **Search/filter**: Use `getAllFromIndex()` with `IDBKeyRange` for range queries.

### 5.5 Avoiding Common Performance Pitfalls

1. **Don't open/close the database repeatedly** — Cache the `IDBPDatabase` instance in a module-level variable. Opening a database is expensive (involves disk I/O and version checks).

2. **Don't create a transaction per write in a loop** — Use a single transaction with multiple `put` calls instead of N separate `db.put()` shortcut calls.

3. **Don't read-then-write in separate transactions** — This creates a race condition (another tab could modify between your read and write). Use a single readwrite transaction.

4. **Don't store large blobs in IndexedDB unnecessarily** — If you store images or large files, consider storing them as Blobs (which IDB supports natively) rather than base64 strings. IDB can store Blobs efficiently without serialization.

5. **Avoid putting too much in a single store** — If you have project metadata (small, frequently accessed) and file content (large, less frequently accessed), separate them into different stores. This avoids deserializing large content objects when you only need metadata.

### 5.6 Startup Hydration Performance

On app startup, we need to hydrate Zustand stores from IndexedDB. The key to fast startup is **parallel loading**:

```typescript
async function hydrateStores(): Promise<void> {
  const startTime = performance.now();

  // Load all data in parallel
  const [projects, settings, recentProject] = await Promise.all([
    loadAllProjects(),
    loadSettings(),
    loadMostRecentProject(),
  ]);

  // Hydrate Zustand stores
  useProjectStore.setState({ projects, isLoading: false });
  useUIStore.setState(settings);

  // If a project was recently open, load its files too
  if (recentProject) {
    const files = await loadProjectFiles(recentProject.id);
    useEditorStore.getState().loadContents(
      files.map(f => ({ fileId: f.id, content: f.content ?? '' }))
    );
    useProjectStore.setState({
      activeProject: recentProject,
      files: Object.fromEntries(files.map(f => [f.id, f])),
    });
  }

  console.log(`[Hydrate] Completed in ${(performance.now() - startTime).toFixed(1)}ms`);
}
```

---

## 6. Integration with Zustand

### 6.1 Two Integration Approaches

There are two primary patterns for connecting IndexedDB persistence to Zustand:

#### Approach A: Zustand `persist` Middleware (Simple)

Use Zustand's built-in `persist` middleware with a custom storage adapter. This is the simplest approach and works well for small-to-medium state.

**Pros**: Minimal code, automatic hydration, built-in version/migration support.
**Cons**: Serializes entire state to JSON (no selective per-record persistence), stores everything as a single blob (no index queries), JSON serialization/deserialization overhead for large state.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Custom IDB storage adapter for Zustand's persist middleware
function createIDBStorage<S>(): StateStorage {
  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const db = await getDB();
        const record = await db.get('settings', name);
        return record?.value ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const db = await getDB();
        await db.put('settings', { key: name, value });
      } catch (error) {
        console.error(`[IDB Storage] setItem failed for ${name}:`, error);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const db = await getDB();
        await db.delete('settings', name);
      } catch (error) {
        console.error(`[IDB Storage] removeItem failed for ${name}:`, error);
      }
    },
  };
}

// Usage: Persist UI preferences with IDB
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      autoRefresh: true,
      // ...
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'liveframe-ui',
      storage: createJSONStorage(() => createIDBStorage()),
      partialize: (state) => ({
        // Only persist these fields
        theme: state.theme,
        autoRefresh: state.autoRefresh,
      }),
    }
  )
);
```

#### Approach B: Manual Subscribe + Save (Recommended for Project/File Data)

Use Zustand's `subscribe` or `subscribeWithSelector` middleware to watch for store changes and manually persist to IndexedDB using the two-tier save scheduler. This is the recommended approach for the project/file stores because:

1. **Selective persistence**: Save only the changed record, not the entire state blob.
2. **Index-friendly**: Records are stored individually in IndexedDB, enabling index queries (e.g., "get all files for project X").
3. **Performance**: No JSON serialization of the entire state tree on every change.
4. **Two-tier debounce**: Can distinguish structural vs. content changes.

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Do NOT use persist middleware for project/file stores
// Instead, use subscribeWithSelector for fine-grained observation
export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      projects: {},
      files: {},
      activeProject: null,
      // ... actions
    }))
  )
);
```

### 6.2 Hydration on Startup

Hydration must happen before the app renders to avoid flickering. Use Zustand's `onRehydrateStorage` or a manual hydration step:

#### Manual Hydration (Recommended)

```typescript
// src/lib/persistence-init.ts

let hydrationPromise: Promise<void> | null = null;

export function hydrateFromIDB(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    try {
      const db = await getDB();

      // Load all projects (metadata only)
      const projects = await db.getAll('projects');
      const projectMap = Object.fromEntries(
        projects.map(p => [p.id, p])
      );

      // Load workspace settings
      const settingsRecord = await db.get('settings', 'workspace');

      // Determine the active project
      const activeProjectId = settingsRecord?.value?.activeProjectId ?? null;

      // Load files for the active project only (lazy-load others on demand)
      let files: FileValue[] = [];
      if (activeProjectId) {
        files = await db.getAllFromIndex('files', 'by-projectId', activeProjectId);
      }

      // Hydrate Zustand stores
      useProjectStore.setState({
        projects: projectMap,
        files: Object.fromEntries(files.map(f => [f.id, f])),
        activeProject: activeProjectId ? projectMap[activeProjectId] ?? null : null,
        isLoading: false,
      });

      useEditorStore.getState().loadContents(
        files.map(f => ({ fileId: f.id, content: f.content ?? '' }))
      );

      if (settingsRecord?.value) {
        useLayoutStore.setState(settingsRecord.value.layout ?? {});
      }

      console.log('[Hydrate] Successfully loaded from IndexedDB');
    } catch (error) {
      console.error('[Hydrate] Failed to load from IndexedDB:', error);
      // App continues with default state
      useProjectStore.setState({ isLoading: false });
    }
  })();

  return hydrationPromise;
}
```

```tsx
// src/main.tsx

import { hydrateFromIDB } from './lib/persistence-init';

// Hydrate before rendering
hydrateFromIDB().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

### 6.3 Subscribing to Store Changes for Auto-Save

Use Zustand's `subscribe` to watch for changes and trigger the save scheduler:

```typescript
// src/lib/auto-save.ts

import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { scheduleSave, flushAll } from './save-scheduler';

// Track which files have changed content
const dirtyContentFileIds = new Set<string>();

export function initAutoSave(): () => void {
  // Subscribe to project store changes (structural)
  const unsubProject = useProjectStore.subscribe(
    (state) => ({
      projects: state.projects,
      activeProject: state.activeProject,
    }),
    (currentState, previousState) => {
      // Detect structural changes by comparing project lists
      const currentKeys = Object.keys(currentState.projects);
      const previousKeys = Object.keys(previousState.projects);

      // New project created
      for (const key of currentKeys) {
        if (!previousState.projects[key]) {
          scheduleSave({
            type: 'structural',
            store: 'projects',
            data: currentState.projects[key],
          });
        }
      }

      // Project deleted
      for (const key of previousKeys) {
        if (!currentState.projects[key]) {
          // Delete from IDB
          (async () => {
            const db = await getDB();
            await db.delete('projects', key);
          })();
        }
      }

      // Project updated (name, fileIds, etc.)
      for (const key of currentKeys) {
        const current = currentState.projects[key];
        const previous = previousState.projects[key];
        if (current && previous && current !== previous) {
          // Check if it's a structural change (fileIds changed) vs just updatedAt
          if (current.fileIds.length !== previous.fileIds.length) {
            scheduleSave({ type: 'structural', store: 'projects', data: current });
          } else {
            // Project metadata update — still save immediately but less urgent
            scheduleSave({ type: 'structural', store: 'projects', data: current });
          }
        }
      }
    }
  );

  // Subscribe to editor store changes (content)
  const unsubEditor = useEditorStore.subscribe(
    (state) => state.dirtyMap,
    (dirtyMap, previousDirtyMap) => {
      // Detect newly dirty files
      for (const [fileId, isDirty] of Object.entries(dirtyMap)) {
        if (isDirty && !previousDirtyMap[fileId]) {
          dirtyContentFileIds.add(fileId);
        }
      }
    }
  );

  // Periodically flush dirty content to IndexedDB (backup for the debounced approach)
  const intervalId = setInterval(() => {
    for (const fileId of dirtyContentFileIds) {
      const file = useProjectStore.getState().files[fileId];
      const content = useEditorStore.getState().contents[fileId];
      if (file && content !== undefined) {
        scheduleSave({
          type: 'content',
          fileId,
          data: { ...file, content },
        });
      }
    }
    dirtyContentFileIds.clear();
  }, 3000);

  // Visibility change handler
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushAll();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Beforeunload handler
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (dirtyContentFileIds.size > 0 || hasPendingSaves()) {
      flushAll();
      e.preventDefault();
      e.returnValue = '';  // Chrome requires this
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    unsubProject();
    unsubEditor();
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
```

### 6.4 Avoiding Infinite Loops

A critical concern when connecting Zustand to IndexedDB is **avoiding infinite loops**: store change → save to IDB → re-hydrate store → store change → ...

**Strategies to prevent loops:**

1. **Never auto-hydrate after initial load** — Hydrate once on startup, then switch to write-only mode. The Zustand `persist` middleware has a `skipHydration` option for this.

2. **Use `onRehydrateStorage` to set a flag** — After hydration completes, set a flag that enables auto-save:

```typescript
let isHydrated = false;

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: 'liveframe-projects',
      storage: createJSONStorage(() => createIDBStorage()),
      skipHydration: true,  // manual hydration
      onRehydrateStorage: () => {
        return () => { isHydrated = true; };
      },
    }
  )
);

// In auto-save subscription, check the flag:
if (!isHydrated) return;  // skip auto-save during hydration
```

3. **Use `subscribeWithSelector` with equality checks** — Only trigger saves when the selected slice actually changes:

```typescript
useProjectStore.subscribe(
  (state) => state.projects,
  (current, previous) => {
    if (current === previous) return;  // no actual change
    // ... save logic
  },
  { equalityFn: shallow }  // use shallow comparison
);
```

4. **Don't write back the same data you just read** — If you hydrate from IDB and then the store subscription fires, compare the current state with what was just hydrated and skip the save if they match.

### 6.5 Recommended Store-Specific Strategy

| Store | Approach | Why |
|-------|----------|-----|
| `uiStore` | `persist` middleware with IDB adapter | Small state, simple key-value, no complex queries needed |
| `layoutStore` | `persist` middleware with IDB adapter | Tiny state, simple persistence |
| `editorStore` | Manual subscribe + save scheduler (content tier) | High-frequency updates, per-file debouncing, large content strings |
| `projectStore` | Manual subscribe + save scheduler (structural tier) | Needs per-record IDB storage for index queries, structural vs content distinction |

---

## 7. Recommended Implementation Architecture

### 7.1 File Structure

```
src/
├── lib/
│   ├── idb.ts                    # Database schema, openDB, getDB, CRUD helpers
│   ├── save-scheduler.ts         # Two-tier debounce save scheduler
│   ├── auto-save.ts              # Zustand subscription → save scheduler bridge
│   ├── persistence-init.ts       # Hydration on startup, event listeners
│   ├── idb-availability.ts       # Detect IDB support, fallback logic
│   └── storage-adapter.ts        # Zustand persist IDB adapter
├── stores/
│   ├── editorStore.ts            # No persist middleware; manual auto-save
│   ├── projectStore.ts           # No persist middleware; manual auto-save
│   ├── uiStore.ts                # persist middleware with IDB adapter
│   └── layoutStore.ts            # persist middleware with IDB adapter
```

### 7.2 Initialization Order

```
1. App loads → main.tsx executes
2. checkIndexedDBAvailable() → determines if IDB is usable
3. hydrateFromIDB() → loads projects, settings, active project files from IDB
4. React renders with hydrated state
5. initAutoSave() → subscribes to store changes, starts save scheduler
6. User edits → store updates → save scheduler writes to IDB
```

### 7.3 Key Implementation Checklist

- [ ] `src/lib/idb.ts` — Define `LiveFrameDB` schema, `getDB()`, CRUD helpers
- [ ] `src/lib/save-scheduler.ts` — Two-tier debounce (structural: immediate, content: 3s)
- [ ] `src/lib/auto-save.ts` — Zustand subscribe → save scheduler
- [ ] `src/lib/persistence-init.ts` — Hydrate on startup, `visibilitychange` + `beforeunload`
- [ ] `src/lib/idb-availability.ts` — Detect IDB, provide fallback
- [ ] `src/lib/storage-adapter.ts` — Zustand persist adapter for IDB
- [ ] Update `uiStore.ts` — Add `persist` with IDB adapter
- [ ] Update `layoutStore.ts` — Add `persist` with IDB adapter
- [ ] Update `projectStore.ts` — Wire to save scheduler (structural tier)
- [ ] Update `editorStore.ts` — Wire to save scheduler (content tier)
- [ ] Update `main.tsx` — Call `hydrateFromIDB()` before render
- [ ] Add loading splash — Show spinner during IDB hydration
- [ ] Test: private browsing fallback
- [ ] Test: storage quota exceeded handling
- [ ] Test: multi-tab upgrade blocking
- [ ] Test: `beforeunload` save flushing

### 7.4 Migration from Current State

The current `editorStore.ts` stores content as three flat strings (`html`, `css`, `javascript`). The new architecture stores them as individual `FileValue` records in IndexedDB. Migration path:

1. On first load with the new code, check if old localStorage data exists.
2. If it does, convert the three strings into a virtual single-file project and save to IndexedDB.
3. Clear the old localStorage data.

```typescript
// In persistence-init.ts
async function migrateFromLocalStorage(): Promise<void> {
  const OLD_KEY = 'liveframe-editor';
  const oldData = localStorage.getItem(OLD_KEY);
  if (!oldData) return;

  try {
    const parsed = JSON.parse(oldData);
    const { html, css, javascript } = parsed.state ?? parsed;

    // Create a virtual single-file project
    const projectId = crypto.randomUUID();
    const htmlFileId = crypto.randomUUID();
    const cssFileId = crypto.randomUUID();
    const jsFileId = crypto.randomUUID();

    const project: ProjectValue = {
      id: projectId,
      name: 'Migrated Project',
      mode: 'single-file',
      fileIds: [htmlFileId, cssFileId, jsFileId],
      externalResources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeFileId: htmlFileId,
      templateId: null,
    };

    const files: FileValue[] = [
      {
        id: htmlFileId, projectId, path: 'index.html', name: 'index.html',
        type: 'html', content: html, createdAt: project.createdAt,
        updatedAt: project.createdAt, isDirty: false, isVirtual: true,
      },
      {
        id: cssFileId, projectId, path: 'style.css', name: 'style.css',
        type: 'css', content: css, createdAt: project.createdAt,
        updatedAt: project.createdAt, isDirty: false, isVirtual: true,
      },
      {
        id: jsFileId, projectId, path: 'script.js', name: 'script.js',
        type: 'javascript', content: javascript, createdAt: project.createdAt,
        updatedAt: project.createdAt, isDirty: false, isVirtual: true,
      },
    ];

    await saveProjectAtomic(project, files);
    localStorage.removeItem(OLD_KEY);
    console.log('[Migration] Successfully migrated from localStorage to IndexedDB');
  } catch (error) {
    console.error('[Migration] Failed to migrate from localStorage:', error);
  }
}
```

---

## Appendix A: `idb` API Quick Reference

### Database Operations

```typescript
import { openDB, deleteDB, wrap, unwrap } from 'idb';

// Open database
const db = await openDB<Schema>('name', version, { upgrade, blocked, blocking, terminated });

// Delete database
await deleteDB('name', { blocked });

// Wrap raw IDB objects (for use with raw IDB APIs)
const wrappedDB = wrap(rawIDBDatabase);
const rawDB = unwrap(wrappedDB);
```

### Shortcut Methods on `IDBPDatabase`

| Method | Signature | Notes |
|--------|-----------|-------|
| `put` | `db.put(store, value, key?)` | Upsert (create or update) |
| `add` | `db.add(store, value, key?)` | Insert only (rejects if key exists) |
| `get` | `db.get(store, key)` | Get by key → `value \| undefined` |
| `getAll` | `db.getAll(store, query?, count?)` | Get all values in store |
| `getAllKeys` | `db.getAllKeys(store, query?, count?)` | Get all keys in store |
| `getFromIndex` | `db.getFromIndex(store, index, key)` | Get by index key |
| `getAllFromIndex` | `db.getAllFromIndex(store, index, query?, count?)` | Get all matching index |
| `count` | `db.count(store, key?)` | Count records |
| `countFromIndex` | `db.countFromIndex(store, index, key?)` | Count by index |
| `delete` | `db.delete(store, key)` | Delete by key |
| `clear` | `db.clear(store)` | Delete all records |

### Transaction Methods

```typescript
const tx = db.transaction('store', 'readwrite', { durability: 'relaxed' });
// or multi-store:
const tx = db.transaction(['store1', 'store2'], 'readwrite');

// Access stores
const store = tx.objectStore('storeName');
const index = store.index('indexName');

// Operations (same as shortcuts but on store/index)
await store.put(value);
await store.add(value);
const value = await store.get(key);
const all = await store.getAll();
const fromIndex = await index.getAll(query);

// Transaction completion
await tx.done;  // resolves when transaction commits
```

### Cursor Iteration

```typescript
// Async iterator pattern
for await (const cursor of store.iterate(query?, direction?)) {
  console.log(cursor.key, cursor.value);
  await cursor.update(newValue);  // in readwrite tx
  await cursor.delete();          // in readwrite tx
}

// Manual cursor
let cursor = await store.openCursor(query, direction);
while (cursor) {
  console.log(cursor.key, cursor.value);
  cursor = await cursor.continue();
}

// Advance by N records
cursor = await cursor.advance(10);
```

---

## Appendix B: Zustand `persist` + IDB Adapter Reference

```typescript
import { createJSONStorage, PersistStorage, StorageValue } from 'zustand/middleware';

// Option 1: Use createJSONStorage with a custom StateStorage
const idbStorage: StateStorage = {
  getItem: async (name) => {
    const db = await getDB();
    const record = await db.get('settings', name);
    return record?.value ?? null;
  },
  setItem: async (name, value) => {
    const db = await getDB();
    await db.put('settings', { key: name, value });
  },
  removeItem: async (name) => {
    const db = await getDB();
    await db.delete('settings', name);
  },
};

// Usage with persist middleware
persist(storeFn, {
  name: 'liveframe-ui',
  storage: createJSONStorage(() => idbStorage),
  partialize: (state) => ({ theme: state.theme, autoRefresh: state.autoRefresh }),
  version: 1,
  migrate: (persisted, version) => {
    if (version === 0) {
      // Migrate from v0 to v1
      return { ...persisted, autoRefresh: true };
    }
    return persisted;
  },
  merge: (persisted, current) => ({ ...current, ...persisted }),
  skipHydration: false,
  onRehydrateStorage: (state) => {
    return (state, error) => {
      if (error) console.error('Rehydration failed:', error);
    };
  },
});
```

---

## Appendix C: Browser Compatibility Notes

| Browser | IndexedDB Support | Private Browsing | Notes |
|---------|-------------------|------------------|-------|
| Chrome 24+ | Full | Full | No issues |
| Firefox 16+ | Full | Full (since v78+) | Earlier private mode had 0 quota |
| Safari 10+ | Full | Full (since iOS 17+) | iOS 16 and earlier: IDB broken in private mode |
| Edge 79+ | Full | Full | Chromium-based |
| Samsung Internet | Full | Full | Chromium-based |

**`idb` library browser support**: Same as IndexedDB support. The library uses Proxy internally for its magic wrappers, which requires IE11+ or any modern browser. Since LiveFrame targets modern browsers (React 19), this is not a concern.

**`durability` option support**: Chromium-only (Chrome, Edge, Opera). Firefox and Safari ignore it silently (behave as `'default'`).

---

*End of Phase 1.4 IndexedDB Persistence Research Report*
