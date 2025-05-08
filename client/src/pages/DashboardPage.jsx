import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import useWorkspaceStore from '../stores/workspaceStore';
import CreateProjectModal from '../components/CreateProjectModal';

export default function DashboardPage() {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', currentWorkspace?.id],
    queryFn: () => api.get(`/workspaces/${currentWorkspace.id}/projects`).then((r) => r.data),
    enabled: !!currentWorkspace,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', currentWorkspace?.id],
    queryFn: () => api.get(`/workspaces/${currentWorkspace.id}/members`).then((r) => r.data),
    enabled: !!currentWorkspace,
  });

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Select or create a workspace to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{currentWorkspace.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + New project
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Projects</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{members.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Plan</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">{currentWorkspace.plan || 'free'}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/workspaces/${currentWorkspace.id}/projects/${p.id}`}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color || '#6366f1' }}
                />
                <h2 className="font-semibold text-gray-900 truncate">{p.name}</h2>
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
              )}
            </Link>
          ))}

          {projects.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              No projects yet.{' '}
              <button onClick={() => setShowCreate(true)} className="text-brand-500 hover:underline">
                Create one
              </button>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
