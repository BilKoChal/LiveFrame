/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  FolderOpen,
  Code2,
  Clock,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useLayoutStore } from '../../stores/layoutStore';
import type { Project, ProjectId } from '../../types/project';

export default function ProjectList() {
  const projects = useProjectStore((s) => s.projects);
  const workspace = useProjectStore((s) => s.workspace);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setMode = useLayoutStore((s) => s.setMode);

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const projectId = createProject(newProjectName.trim(), 'project');
    loadProject(projectId);
    setMode('project');
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleOpenProject = (projectId: ProjectId) => {
    loadProject(projectId);
    const project = projects[projectId];
    setMode(project?.mode === 'project' ? 'project' : 'single-file');
  };

  const handleDeleteProject = (projectId: ProjectId, name: string) => {
    if (window.confirm(`Delete project "${name}"? This cannot be undone.`)) {
      deleteProject(projectId);
    }
  };

  const handleDuplicateProject = (projectId: ProjectId) => {
    const newName = `${projects[projectId]?.name ?? 'Project'} (Copy)`;
    duplicateProject(projectId, newName);
  };

  const sortedProjects = Object.values(projects)
    .filter((p) => !p.id.startsWith('proj_virtual_'))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Projects
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {sortedProjects.length} project{sortedProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* New Project Form */}
      {isCreating && (
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              placeholder="Project name..."
              autoFocus
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 rounded-lg transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 dark:text-slate-500">
            <Code2 className="h-12 w-12 stroke-[1]" />
            <div className="text-center">
              <p className="font-semibold text-sm">No projects yet</p>
              <p className="text-xs mt-1">
                Create a project to start building with multiple files.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => handleOpenProject(project.id)}
                onDelete={() => handleDeleteProject(project.id, project.name)}
                onDuplicate={() => handleDuplicateProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function ProjectCard({ project, onOpen, onDelete, onDuplicate }: ProjectCardProps) {
  const fileCount = project.fileIds.length;
  const updatedAt = new Date(project.updatedAt);
  const timeAgo = getTimeAgo(updatedAt);

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden">
      <button
        onClick={onOpen}
        className="flex flex-col flex-1 p-4 text-left"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Code2 className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {project.name}
            </h3>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              {project.mode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 mt-auto">
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3" />
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </span>
        </div>
      </button>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-slate-100 dark:border-slate-800/60 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 dark:bg-slate-900/60">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Duplicate project"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete project"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
