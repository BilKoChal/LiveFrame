/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, type IDBPDatabase } from 'idb';
import type {
  ProjectId,
  FileId,
  Project,
  FileEntry,
} from '../types/project';

// ─── Database Schema ──────────────────────────────────────────

const DB_NAME = 'liveframe-db';
const DB_VERSION = 1;

interface LiveFrameDB {
  projects: {
    key: ProjectId;
    value: Project;
    indexes: {
      'by-updatedAt': string;
      'by-name': string;
    };
  };
  files: {
    key: FileId;
    value: FileEntry;
    indexes: {
      'by-projectId': ProjectId;
      'by-projectId-path': [ProjectId, string];
    };
  };
  settings: {
    key: string;
    value: Record<string, unknown>;
  };
}

// ─── Database Instance ────────────────────────────────────────

let dbInstance: IDBPDatabase<LiveFrameDB> | null = null;

/**
 * Get or create the IndexedDB database connection.
 * Caches the instance for reuse — opening a DB is expensive.
 */
async function getDB(): Promise<IDBPDatabase<LiveFrameDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LiveFrameDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ─── Projects Store ─────────────────────────────────
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', {
          keyPath: 'id',
        });
        projectStore.createIndex('by-updatedAt', 'updatedAt');
        projectStore.createIndex('by-name', 'name');
      }

      // ─── Files Store ────────────────────────────────────
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-projectId', 'projectId');
        fileStore.createIndex('by-projectId-path', ['projectId', 'path'], {
          unique: true,
        });
      }

      // ─── Settings Store ─────────────────────────────────
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('LiveFrame DB upgrade blocked — close other tabs');
    },
    blocking() {
      console.warn('LiveFrame DB blocking — this tab is blocking an upgrade');
    },
    terminated() {
      console.error('LiveFrame DB connection terminated unexpectedly');
      dbInstance = null;
    },
  });

  return dbInstance;
}

// ─── Availability Check ───────────────────────────────────────

let idbAvailable: boolean | null = null;

/**
 * Check if IndexedDB is available in the current browser context.
 * Returns false in private browsing on some older browsers.
 */
export async function isIDBAvailable(): Promise<boolean> {
  if (idbAvailable !== null) return idbAvailable;

  try {
    const testDB = await openDB('__liveframe_test__', 1, {
      upgrade(db) {
        db.createObjectStore('test');
      },
    });
    await testDB.deleteObjectStore('test');
    dbInstance = null; // Don't cache test DB
    idbAvailable = true;
  } catch {
    idbAvailable = false;
    console.warn('IndexedDB is not available — persistence disabled');
  }

  return idbAvailable;
}

// ─── Project Operations ───────────────────────────────────────

/** Save a project to IndexedDB */
export async function saveProjectToIDB(project: Project): Promise<void> {
  try {
    const db = await getDB();
    await db.put('projects', project);
  } catch (error) {
    console.error('Failed to save project to IndexedDB:', error);
  }
}

/** Load a project from IndexedDB */
export async function loadProjectFromIDB(
  projectId: ProjectId
): Promise<Project | undefined> {
  try {
    const db = await getDB();
    return await db.get('projects', projectId);
  } catch (error) {
    console.error('Failed to load project from IndexedDB:', error);
    return undefined;
  }
}

/** Delete a project from IndexedDB */
export async function deleteProjectFromIDB(
  projectId: ProjectId
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['projects', 'files'], 'readwrite');

    // Delete the project record
    await tx.objectStore('projects').delete(projectId);

    // Delete all files belonging to this project
    const fileStore = tx.objectStore('files');
    const index = fileStore.index('by-projectId');
    let cursor = await index.openCursor(projectId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
  } catch (error) {
    console.error('Failed to delete project from IndexedDB:', error);
  }
}

/** Load all projects from IndexedDB */
export async function loadAllProjectsFromIDB(): Promise<
  Record<ProjectId, Project>
> {
  try {
    const db = await getDB();
    const projects = await db.getAll('projects');
    return Object.fromEntries(
      projects.map((p) => [p.id as ProjectId, p])
    ) as Record<ProjectId, Project>;
  } catch (error) {
    console.error('Failed to load projects from IndexedDB:', error);
    return {};
  }
}

// ─── File Operations ──────────────────────────────────────────

/** Save a file to IndexedDB */
export async function saveFileToIDB(file: FileEntry): Promise<void> {
  try {
    const db = await getDB();
    await db.put('files', file);
  } catch (error) {
    console.error('Failed to save file to IndexedDB:', error);
  }
}

/** Load a file from IndexedDB */
export async function loadFileFromIDB(
  fileId: FileId
): Promise<FileEntry | undefined> {
  try {
    const db = await getDB();
    return await db.get('files', fileId);
  } catch (error) {
    console.error('Failed to load file from IndexedDB:', error);
    return undefined;
  }
}

/** Delete a file from IndexedDB */
export async function deleteFileFromIDB(fileId: FileId): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('files', fileId);
  } catch (error) {
    console.error('Failed to delete file from IndexedDB:', error);
  }
}

/** Load all files for a project from IndexedDB */
export async function loadProjectFilesFromIDB(
  projectId: ProjectId
): Promise<Record<FileId, FileEntry>> {
  try {
    const db = await getDB();
    const files = await db.getAllFromIndex('files', 'by-projectId', projectId);
    return Object.fromEntries(
      files.map((f) => [f.id as FileId, f])
    ) as Record<FileId, FileEntry>;
  } catch (error) {
    console.error('Failed to load project files from IndexedDB:', error);
    return {};
  }
}

/** Load all files from IndexedDB */
export async function loadAllFilesFromIDB(): Promise<
  Record<FileId, FileEntry>
> {
  try {
    const db = await getDB();
    const files = await db.getAll('files');
    return Object.fromEntries(
      files.map((f) => [f.id as FileId, f])
    ) as Record<FileId, FileEntry>;
  } catch (error) {
    console.error('Failed to load files from IndexedDB:', error);
    return {};
  }
}

/** Save multiple files in a single transaction (batch write) */
export async function saveFilesBatchToIDB(
  files: FileEntry[]
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('files', 'readwrite');
    for (const file of files) {
      await tx.store.put(file);
    }
    await tx.done;
  } catch (error) {
    console.error('Failed to batch save files to IndexedDB:', error);
  }
}

// ─── Settings Operations ──────────────────────────────────────

/** Save a settings key-value pair */
export async function saveSettingsToIDB(
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('settings', { key, ...value });
  } catch (error) {
    console.error('Failed to save settings to IndexedDB:', error);
  }
}

/** Load settings by key */
export async function loadSettingsFromIDB(
  key: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = await getDB();
    return await db.get('settings', key);
  } catch (error) {
    console.error('Failed to load settings from IndexedDB:', error);
    return undefined;
  }
}

// ─── Hydration ────────────────────────────────────────────────

/**
 * Hydrate the project store from IndexedDB on startup.
 * Returns all projects and files from the database.
 */
export async function hydrateFromIDB(): Promise<{
  projects: Record<ProjectId, Project>;
  files: Record<FileId, FileEntry>;
}> {
  const available = await isIDBAvailable();
  if (!available) {
    return { projects: {}, files: {} };
  }

  const [projects, files] = await Promise.all([
    loadAllProjectsFromIDB(),
    loadAllFilesFromIDB(),
  ]);

  return { projects, files };
}

// ─── Auto-Save Scheduler ──────────────────────────────────────

const autoSaveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Schedule a debounced auto-save for a file's content.
 * Content changes debounce at the configured interval (default 3s).
 */
export function scheduleContentSave(
  fileId: FileId,
  file: FileEntry,
  delayMs: number = 3000
): void {
  if (autoSaveTimers[fileId]) {
    clearTimeout(autoSaveTimers[fileId]);
  }

  autoSaveTimers[fileId] = setTimeout(async () => {
    if (file.isDirty) {
      await saveFileToIDB(file);
    }
    delete autoSaveTimers[fileId];
  }, delayMs);
}

/**
 * Immediately save structural changes (file create/delete/rename).
 * Uses Promise.resolve() flush pattern for immediate persistence.
 */
export async function saveStructuralChange(
  project: Project,
  affectedFiles: FileEntry[]
): Promise<void> {
  await Promise.all([
    saveProjectToIDB(project),
    saveFilesBatchToIDB(affectedFiles),
  ]);
}

/**
 * Flush all pending content saves — call on visibility change and beforeunload.
 */
export async function flushPendingSaves(
  files: Record<FileId, FileEntry>
): Promise<void> {
  // Clear all timers
  for (const fileId of Object.keys(autoSaveTimers)) {
    clearTimeout(autoSaveTimers[fileId]);
    delete autoSaveTimers[fileId];
  }

  // Save all dirty files
  const dirtyFiles = Object.values(files).filter((f) => f.isDirty);
  if (dirtyFiles.length > 0) {
    await saveFilesBatchToIDB(dirtyFiles);
  }
}

/**
 * Set up visibility change and beforeunload handlers for data safety.
 * Call once during app initialization.
 */
export function setupAutoSaveHandlers(
  getFiles: () => Record<FileId, FileEntry>,
  getProjects: () => Record<ProjectId, Project>
): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSaves(getFiles());
    }
  };

  const handleBeforeUnload = () => {
    // Synchronous best-effort: start the saves
    const files = getFiles();
    const dirtyFiles = Object.values(files).filter((f) => f.isDirty);
    // We can't await in beforeunload, but we can start the writes
    for (const file of dirtyFiles) {
      saveFileToIDB(file);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
