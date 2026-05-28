/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  FileCode2,
  Braces,
  FileJson,
  Palette,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  Plus,
  FolderPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { vfs } from '../../utils/vfs';
import type { FileId, FileType, FlatTreeNode } from '../../types/project';

// ─── File Icon Mapping ────────────────────────────────────────

function getFileIcon(
  fileType: FileType | undefined,
  isDirectory: boolean,
  isExpanded: boolean
) {
  if (isDirectory) {
    return isExpanded ? (
      <FolderOpen className="h-4 w-4 text-amber-400" />
    ) : (
      <Folder className="h-4 w-4 text-amber-400" />
    );
  }

  switch (fileType) {
    case 'html':
      return <FileCode2 className="h-4 w-4 text-amber-500" />;
    case 'css':
      return <Palette className="h-4 w-4 text-sky-500" />;
    case 'javascript':
      return <Braces className="h-4 w-4 text-yellow-500" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-green-500" />;
    case 'markdown':
      return <FileText className="h-4 w-4 text-slate-400" />;
    default:
      return <FileText className="h-4 w-4 text-slate-400" />;
  }
}

// ─── Context Menu ─────────────────────────────────────────────

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FlatTreeNode | null;
}

interface FileTreeProps {
  onFileSelect?: (fileId: FileId) => void;
}

export default function FileTree({ onFileSelect }: FileTreeProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const files = useProjectStore((s) => s.files);
  const addFile = useProjectStore((s) => s.addFile);
  const deleteFile = useProjectStore((s) => s.deleteFile);
  const renameFile = useProjectStore((s) => s.renameFile);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const openTab = useEditorStore((s) => s.openTab);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set(['dir:src'])
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newItemState, setNewItemState] = useState<{
    parentPath: string;
    type: 'file' | 'folder';
  } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Build tree from flat files
  const flatNodes = useMemo(() => {
    if (!activeProject) return [];
    const tree = vfs.buildTree(files, activeProject.id);
    return vfs.flattenTree(tree, expandedDirs);
  }, [files, activeProject, expandedDirs]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  const toggleDir = useCallback((dirId: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirId)) {
        next.delete(dirId);
      } else {
        next.add(dirId);
      }
      return next;
    });
  }, []);

  const handleFileClick = useCallback(
    (node: FlatTreeNode) => {
      if (node.type === 'directory') {
        toggleDir(node.id);
      } else if (node.fileId) {
        setActiveFile(node.fileId);
        openTab(node.fileId);
        onFileSelect?.(node.fileId);
      }
    },
    [setActiveFile, openTab, onFileSelect, toggleDir]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FlatTreeNode) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        node,
      });
    },
    []
  );

  const handleStartRename = useCallback(
    (node: FlatTreeNode) => {
      setRenamingNodeId(node.id);
      setRenameValue(node.name);
    },
    []
  );

  const handleFinishRename = useCallback(
    (node: FlatTreeNode) => {
      if (renameValue && renameValue !== node.name) {
        if (node.type === 'file' && node.fileId) {
          const dirPath = node.path.includes('/')
            ? node.path.substring(0, node.path.lastIndexOf('/'))
            : '';
          const newPath = dirPath ? `${dirPath}/${renameValue}` : renameValue;
          renameFile(node.fileId, newPath);
        }
      }
      setRenamingNodeId(null);
      setRenameValue('');
    },
    [renameFile, renameValue]
  );

  const handleAddFile = useCallback(
    (parentPath: string) => {
      setNewItemState({ parentPath, type: 'file' });
      setNewItemName('');
    },
    []
  );

  const handleAddFolder = useCallback(
    (parentPath: string) => {
      setNewItemState({ parentPath, type: 'folder' });
      setNewItemName('');
    },
    []
  );

  const handleFinishNewItem = useCallback(() => {
    if (!newItemName || !activeProject || !newItemState) return;

    if (newItemState.type === 'file') {
      const path = newItemState.parentPath
        ? `${newItemState.parentPath}/${newItemName}`
        : newItemName;
      addFile(activeProject.id, path, '');
    } else {
      // For folders, we create a placeholder file inside to establish the directory
      const path = newItemState.parentPath
        ? `${newItemState.parentPath}/${newItemName}/.gitkeep`
        : `${newItemName}/.gitkeep`;
      addFile(activeProject.id, path, '');
    }

    setNewItemState(null);
    setNewItemName('');
  }, [newItemName, activeProject, newItemState, addFile]);

  const handleDeleteNode = useCallback(
    (node: FlatTreeNode) => {
      if (node.type === 'file' && node.fileId) {
        if (window.confirm(`Delete "${node.name}"?`)) {
          deleteFile(node.fileId);
        }
      }
    },
    [deleteFile]
  );

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        No project loaded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800/60">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/60 select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAddFile('')}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="New File"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleAddFolder('')}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div ref={parentRef} className="flex-1 overflow-y-auto text-sm">
        {flatNodes.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-xs">
            No files yet. Add a file to get started.
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const node = flatNodes[virtualRow.index];
              const isActive = node.fileId === activeFileId;
              const isRenaming = renamingNodeId === node.id;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isRenaming ? (
                    <div
                      className="flex items-center gap-1.5 px-2 py-0.5"
                      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
                    >
                      <ChevronRight className="h-3 w-3 text-transparent" />
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename(node);
                          if (e.key === 'Escape') setRenamingNodeId(null);
                        }}
                        onBlur={() => handleFinishRename(node)}
                        autoFocus
                        className="flex-1 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-indigo-500 rounded outline-none font-mono"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <button
                      className={`flex items-center gap-1.5 w-full px-2 py-0.5 text-left transition-colors outline-none ${
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/40'
                      }`}
                      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
                      onClick={() => handleFileClick(node)}
                      onContextMenu={(e) => handleContextMenu(e, node)}
                      onDoubleClick={() => {
                        if (node.type === 'file') handleStartRename(node);
                      }}
                    >
                      {node.type === 'directory' && (
                        <ChevronRight
                          className={`h-3 w-3 text-slate-400 transition-transform duration-150 ${
                            node.isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      )}
                      {getFileIcon(
                        node.fileType,
                        node.type === 'directory',
                        !!node.isExpanded
                      )}
                      <span className="truncate text-xs font-medium">
                        {node.name}
                      </span>
                      {node.isDirty && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* New item input at bottom */}
        {newItemState && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 border-t border-slate-200 dark:border-slate-800"
            style={{
              paddingLeft: `${(newItemState.parentPath.split('/').length - 1) * 16 + 8}px`,
            }}
          >
            {newItemState.type === 'folder' ? (
              <Folder className="h-4 w-4 text-amber-400" />
            ) : (
              <FileCode2 className="h-4 w-4 text-slate-400" />
            )}
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishNewItem();
                if (e.key === 'Escape') setNewItemState(null);
              }}
              onBlur={() => {
                if (newItemName) handleFinishNewItem();
                else setNewItemState(null);
              }}
              placeholder={
                newItemState.type === 'file'
                  ? 'filename.ext'
                  : 'folder-name/'
              }
              autoFocus
              className="flex-1 px-1.5 py-0.5 text-xs bg-white dark:bg-slate-800 border border-indigo-500 rounded outline-none font-mono"
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.node && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px] text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'directory' && (
            <>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  handleAddFile(contextMenu.node!.path);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Plus className="h-3.5 w-3.5" /> New File
              </button>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  handleAddFolder(contextMenu.node!.path);
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" /> New Folder
              </button>
            </>
          )}
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => {
              handleStartRename(contextMenu.node!);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          {contextMenu.node.type === 'file' && (
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={() => {
                handleDeleteNode(contextMenu.node!);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
