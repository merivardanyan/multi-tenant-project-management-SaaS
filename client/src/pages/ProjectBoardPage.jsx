import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';

export default function ProjectBoardPage() {
  const { workspaceId, projectId } = useParams();
  const qc = useQueryClient();
  const [createCol, setCreateCol] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects/${projectId}`).then((r) => r.data),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit('join:project', projectId);

    const refresh = () => qc.invalidateQueries(['project', projectId]);
    socket.on('task:created', refresh);
    socket.on('task:updated', refresh);
    socket.on('task:deleted', refresh);
    socket.on('task:moved', refresh);
    socket.on('column:created', refresh);
    socket.on('column:updated', refresh);
    socket.on('column:deleted', refresh);
    socket.on('columns:reordered', refresh);

    return () => {
      socket.emit('leave:project', projectId);
      socket.off('task:created', refresh);
      socket.off('task:updated', refresh);
      socket.off('task:deleted', refresh);
      socket.off('task:moved', refresh);
      socket.off('column:created', refresh);
      socket.off('column:updated', refresh);
      socket.off('column:deleted', refresh);
      socket.off('columns:reordered', refresh);
    };
  }, [projectId, qc]);

  const onDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    try {
      await api.post(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${draggableId}/move`,
        { column_id: destination.droppableId, position: destination.index + 1 }
      );
      await qc.invalidateQueries(['project', projectId]);
    } catch (err) {
      console.error('Move failed', err);
    }
  }, [workspaceId, projectId, qc]);

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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
          {columns.map((col) => (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`w-64 shrink-0 min-h-[100px] rounded-lg p-2 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-brand-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">{col.title}</span>
                      <span className="text-xs text-gray-400">{col.tasks?.length || 0}</span>
                    </div>
                    <button
                      onClick={() => setCreateCol(col.id)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      +
                    </button>
                  </div>

                  {(col.tasks || []).map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`mb-2 ${snapshot.isDragging ? 'rotate-1 shadow-lg' : ''}`}
                        >
                          <TaskCard task={task} onClick={setSelectedTask} />
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

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
