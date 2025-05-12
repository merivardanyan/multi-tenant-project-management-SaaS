import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import useWorkspaceStore from '../stores/workspaceStore';

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentWorkspace, setCurrentWorkspace, clearWorkspace } = useWorkspaceStore();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/members`).then((r) => r.data),
  });

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    try {
      await api.post(`/workspaces/${workspaceId}/invite`, { email: inviteEmail });
      setInviteEmail('');
      setInviteMsg('Invite sent!');
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data } = await api.post('/stripe/checkout', { workspaceId });
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setUpgrading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this workspace? This cannot be undone.')) return;
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      clearWorkspace();
      await qc.invalidateQueries(['workspaces']);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Workspace settings</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Members</h2>
        <ul className="space-y-3 mb-4">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
                  {m.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                <p className="text-xs text-gray-500 truncate">{m.email}</p>
              </div>
              <span className="text-xs text-gray-400 capitalize">{m.role}</span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary shrink-0" disabled={inviting}>
            {inviting ? 'Sending...' : 'Invite'}
          </button>
        </form>
        {inviteMsg && (
          <p className="mt-2 text-sm text-gray-600">{inviteMsg}</p>
        )}
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Plan</h2>
        <p className="text-sm text-gray-600 mb-4">
          Current plan: <span className="font-medium capitalize">{currentWorkspace?.plan || 'free'}</span>
          {currentWorkspace?.plan !== 'pro' && ' — limited to 1 active project'}
        </p>
        {currentWorkspace?.plan !== 'pro' && (
          <button className="btn-primary" onClick={handleUpgrade} disabled={upgrading}>
            {upgrading ? 'Redirecting...' : 'Upgrade to Pro'}
          </button>
        )}
      </div>

      <div className="card p-6 border-red-200">
        <h2 className="text-base font-semibold text-red-700 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-600 mb-4">
          Deleting the workspace will remove all projects, tasks, and members permanently.
        </p>
        <button className="btn-danger" onClick={handleDelete}>Delete workspace</button>
      </div>
    </div>
  );
}
