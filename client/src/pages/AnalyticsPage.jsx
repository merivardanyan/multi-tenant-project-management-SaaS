import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

// basic stats page, will expand later
export default function AnalyticsPage() {
  const { workspaceId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/analytics`).then((r) => r.data),
    enabled: !!workspaceId,
  });

  if (isLoading) return <div className="text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Projects</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data?.projectCount ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Tasks</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data?.taskCount ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Members</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data?.memberCount ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
