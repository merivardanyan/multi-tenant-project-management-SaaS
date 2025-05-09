import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import useWorkspaceStore from '../stores/workspaceStore';

export default function ProjectBoardPage() {
  const { workspaceId, projectId } = useParams();
  const qc = useQueryClient();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const [createCol, setCreateCol] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects/${projectId}`).then((r) => r.data),
  });

  if (isLoading) return <div className="text-gray-400 text-sm p-4">Loading...</div>;
  if (!project) return <div className="p-4 text-red-500">Project not found</div>;

  const columns = project.columns || [];

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: project.color || '#6366f1' }}
        />
        <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {columns.map((col) => (
          <div key={col.id} className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-medium text-gray-700">{col.title}</span>
                <span className="text-xs text-gray-400">
                  {col.tasks?.length || 0}
                </span>
              </div>
              <button
                onClick={() => setCreateCol(col.id)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                +
              </button>
            </div>

            <div className="space-y-2">
              {(col.tasks || []).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={setSelectedTask}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {createCol && (
        <CreateTaskModal
          workspaceId={workspaceId}
          projectId={projectId}
          columnId={createCol}
          onClose={() => setCreateCol(null)}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
