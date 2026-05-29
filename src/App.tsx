/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProjectList from './components/project/ProjectList';
import { useTheme } from './hooks/useTheme';
import { useProjectStore } from './stores/projectStore';
import { useEditorStore } from './stores/editorStore';
import { useLayoutStore } from './stores/layoutStore';
import {
  hydrateFromIDB,
  setupAutoSaveHandlers,
  isIDBAvailable,
} from './utils/idb';
import {
  VIRTUAL_HTML_FILE_ID,
  VIRTUAL_CSS_FILE_ID,
  VIRTUAL_JS_FILE_ID,
} from './types/project';
import type { ProjectId } from './types/project';

/** Derive basename from VITE_BASE_PATH env (for GitHub Pages subdirectory) */
function getBasename(): string {
  const basePath = import.meta.env.BASE_URL;
  // BASE_URL includes trailing slash, but BrowserRouter expects no trailing slash
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

/** Inner component that syncs route params with store state */
function ProjectRouteHandler() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const projects = useProjectStore((s) => s.projects);
  const setMode = useLayoutStore((s) => s.setMode);

  useEffect(() => {
    if (id && projects[id as ProjectId]) {
      setActiveProject(id as ProjectId);
      setMode('project');
    } else if (id) {
      // Project not found, redirect to project list
      navigate('/project', { replace: true });
    }
  }, [id, projects, setActiveProject, setMode, navigate]);

  return <AppLayout />;
}

/** Syncs the root route with single-file mode */
function SingleFileRouteHandler() {
  const setMode = useLayoutStore((s) => s.setMode);
  const activeProject = useProjectStore((s) => s.activeProject);

  useEffect(() => {
    setMode('single-file');
    // Ensure virtual project is active for single-file mode
    if (!activeProject) {
      const projectStore = useProjectStore.getState();
      if (projectStore.projects['proj_virtual_default']) {
        projectStore.setActiveProject('proj_virtual_default');
      }
    }
  }, [setMode, activeProject]);

  return <AppLayout />;
}

/** Project list page */
function ProjectListRoute() {
  const navigate = useNavigate();
  const setMode = useLayoutStore((s) => s.setMode);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const handleOpenProject = (projectId: ProjectId) => {
    setActiveProject(projectId);
    setMode('project');
    navigate(`/project/${projectId}`);
  };

  const handleNewProject = () => {
    const projectStore = useProjectStore.getState();
    const projectId = projectStore.createProject('New Project', 'project');
    setActiveProject(projectId);
    setMode('project');
    navigate(`/project/${projectId}`);
  };

  return (
    <ProjectList onOpenProject={handleOpenProject} onNewProject={handleNewProject} />
  );
}

export default function App() {
  useTheme(); // Triggers modern theme bindings on root html element

  // Hydrate from IndexedDB on startup
  useEffect(() => {
    async function init() {
      const available = await isIDBAvailable();
      if (!available) return;

      const { projects, files } = await hydrateFromIDB();
      const projectStore = useProjectStore.getState();

      if (Object.keys(projects).length > 0) {
        projectStore.hydrateFromIndexedDB(projects, files);

        // Also hydrate editor store file contents
        const editorStore = useEditorStore.getState();
        const fileContents: Record<string, string> = {};
        for (const file of Object.values(files)) {
          if (file.content !== null) {
            fileContents[file.id] = file.content;
          }
        }
        editorStore.loadFileContents(
          Object.entries(fileContents).map(([fileId, content]) => ({
            fileId: fileId as typeof VIRTUAL_HTML_FILE_ID,
            content,
          }))
        );
      }

      projectStore.setHydrated(true);
    }

    init();
  }, []);

  // Set up auto-save handlers (visibility change, beforeunload)
  useEffect(() => {
    const cleanup = setupAutoSaveHandlers(
      () => useProjectStore.getState().files,
      () => useProjectStore.getState().projects
    );
    return cleanup;
  }, []);

  return (
    <BrowserRouter basename={getBasename()}>
      <Routes>
        <Route path="/" element={<SingleFileRouteHandler />} />
        <Route path="/project" element={<ProjectListRoute />} />
        <Route path="/project/:id" element={<ProjectRouteHandler />} />
      </Routes>
    </BrowserRouter>
  );
}
