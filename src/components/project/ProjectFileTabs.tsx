/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, FileCode2, Palette, Braces, FileJson, FileText } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import type { FileId, FileType } from '../../types/project';

// ─── File Icon Helper ─────────────────────────────────────────

function getTabIcon(fileType: FileType | undefined) {
  switch (fileType) {
    case 'html':
      return <FileCode2 className="h-3.5 w-3.5 text-amber-500" />;
    case 'css':
      return <Palette className="h-3.5 w-3.5 text-sky-500" />;
    case 'javascript':
      return <Braces className="h-3.5 w-3.5 text-yellow-500" />;
    case 'json':
      return <FileJson className="h-3.5 w-3.5 text-green-500" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-slate-400" />;
  }
}

// ─── Sortable Tab ─────────────────────────────────────────────

interface SortableTabProps {
  fileId: FileId;
  name: string;
  fileType: FileType | undefined;
  isActive: boolean;
  isDirty: boolean;
  onClose: (fileId: FileId) => void;
  onActivate: (fileId: FileId) => void;
}

function SortableTab({
  fileId,
  name,
  fileType,
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle-click to close
      if (e.button === 1) {
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
      className={`group flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-slate-200 dark:border-slate-800/60 cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-white dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 border-b-2 border-b-indigo-500'
          : 'bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 border-b-2 border-b-transparent'
      }`}
      onClick={() => onActivate(fileId)}
      onMouseDown={handleMouseDown}
      {...attributes}
      {...listeners}
    >
      {getTabIcon(fileType)}
      <span className="truncate max-w-[120px]">{name}</span>
      {isDirty && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      )}
      <button
        className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onClose(fileId);
        }}
        title="Close tab"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Project File Tabs ────────────────────────────────────────

export default function ProjectFileTabs() {
  const openTabIds = useEditorStore((s) => s.openTabIds);
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const fileContents = useEditorStore((s) => s.fileContents);
  const dirtyMap = useEditorStore((s) => s.dirtyMap);
  const setActiveFileId = useEditorStore((s) => s.setActiveFileId);
  const closeTab = useEditorStore((s) => s.closeTab);
  const reorderTabs = useEditorStore((s) => s.reorderTabs);
  const files = useProjectStore((s) => s.files);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = openTabIds.indexOf(active.id as FileId);
      const newIndex = openTabIds.indexOf(over.id as FileId);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    },
    [openTabIds, reorderTabs]
  );

  const handleActivate = useCallback(
    (fileId: FileId) => {
      setActiveFileId(fileId);
    },
    [setActiveFileId]
  );

  const handleClose = useCallback(
    (fileId: FileId) => {
      closeTab(fileId);
    },
    [closeTab]
  );

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollContainerRef.current || !activeFileId) return;
    const activeTab = scrollContainerRef.current.querySelector(
      `[data-tab-id="${activeFileId}"]`
    );
    if (activeTab) {
      activeTab.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    }
  }, [activeFileId]);

  if (openTabIds.length === 0) {
    return (
      <div className="flex items-center px-4 py-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/60 select-none">
        No files open
      </div>
    );
  }

  return (
    <div className="flex items-stretch bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/60 overflow-hidden select-none">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={openTabIds}
          strategy={horizontalListSortingStrategy}
        >
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto scrollbar-none"
          >
            {openTabIds.map((fileId) => {
              const file = files[fileId];
              if (!file) return null;

              return (
                <div key={fileId} data-tab-id={fileId}>
                  <SortableTab
                    fileId={fileId}
                    name={file.name}
                    fileType={file.type}
                    isActive={fileId === activeFileId}
                    isDirty={!!dirtyMap[fileId]}
                    onClose={handleClose}
                    onActivate={handleActivate}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
