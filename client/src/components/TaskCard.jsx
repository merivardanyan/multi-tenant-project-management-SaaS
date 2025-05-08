import { useState } from 'react';

const PRIORITY_COLORS = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TaskCard({ task, onClick }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      onClick={() => onClick?.(task)}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
    >
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{task.title}</p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
          {task.priority}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {task.due_date && (
            <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}

          {task.assignee_avatar ? (
            <img
              src={task.assignee_avatar}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : task.assignee_id ? (
            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs">
              ?
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
