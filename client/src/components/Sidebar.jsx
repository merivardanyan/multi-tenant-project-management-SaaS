import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import useWorkspaceStore from '../stores/workspaceStore';
import CreateWorkspaceModal from './CreateWorkspaceModal';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const [wsDropdown, setWsDropdown] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces').then((r) => r.data),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', currentWorkspace?.id],
    queryFn: () => api.get(`/workspaces/${currentWorkspace.id}/projects`).then((r) => r.data),
    enabled: !!currentWorkspace,
  });

  const handleSelectWorkspace = (ws) => {
    setCurrentWorkspace(ws);
    setWsDropdown(false);
    navigate('/');
  };

  return (
    <>
      <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => setWsDropdown(!wsDropdown)}
            className="w-full flex items-center justify-between text-sm font-medium text-white"
          >
            <span className="truncate">{currentWorkspace?.name || 'Select workspace'}</span>
            <span className="text-gray-400 text-xs">▾</span>
          </button>

          {wsDropdown && (
            <div className="mt-2 bg-gray-800 rounded-lg overflow-hidden">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 truncate"
                >
                  {ws.name}
                </button>
              ))}
              <button
                onClick={() => { setWsDropdown(false); setShowCreateWs(true); }}
                className="w-full text-left px-3 py-2 text-xs text-brand-500 hover:bg-gray-700"
              >
                + New workspace
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              location.pathname === '/' ? 'bg-gray-700 text-white' : 'hover:bg-gray-800'
            }`}
          >
            Dashboard
          </Link>

          {currentWorkspace && (
            <>
              <div className="pt-3 pb-1 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Projects
              </div>
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/workspaces/${currentWorkspace.id}/projects/${p.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname.includes(p.id) ? 'bg-gray-700 text-white' : 'hover:bg-gray-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#6366f1' }}
                  />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {currentWorkspace && (
          <div className="p-3 border-t border-gray-700">
            <Link
              to={`/workspaces/${currentWorkspace.id}/settings`}
              className="block px-3 py-2 text-sm hover:bg-gray-800 rounded-lg"
            >
              Settings
            </Link>
          </div>
        )}
      </aside>

      {showCreateWs && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWs(false)}
          onCreated={(ws) => { setCurrentWorkspace(ws); navigate('/'); }}
        />
      )}
    </>
  );
}
