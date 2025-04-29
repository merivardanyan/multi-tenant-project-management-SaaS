const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/workspaces/:workspaceId/projects/:projectId/tasks
router.post('/:workspaceId/projects/:projectId/tasks', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { title, description, column_id, priority, due_date, assignee_id } = req.body;
    if (!title || !column_id) return res.status(400).json({ error: 'title and column_id required' });

    const [[col]] = await db.query(
      'SELECT id FROM columns WHERE id = ? AND project_id = ?',
      [column_id, req.params.projectId]
    );
    if (!col) return res.status(404).json({ error: 'Column not found' });

    const [[{ maxPos }]] = await db.query(
      'SELECT MAX(position) as maxPos FROM tasks WHERE column_id = ?',
      [column_id]
    );

    const id = uuidv4();
    await db.query(
      `INSERT INTO tasks (id, project_id, column_id, title, description, priority, due_date, assignee_id, position, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.projectId, column_id, title, description || null,
       priority || 'medium', due_date || null, assignee_id || null,
       (maxPos || 0) + 1, req.user.userId]
    );

    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);

    // emit to everyone in this project room
    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('task:created', task);

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:workspaceId/projects/:projectId/tasks
router.get('/:workspaceId/projects/:projectId/tasks', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC',
      [req.params.projectId]
    );
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
router.patch('/:workspaceId/projects/:projectId/tasks/:taskId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { title, description, priority, due_date, assignee_id, column_id } = req.body;

    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [req.params.taskId, req.params.projectId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await db.query(
      `UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        due_date = COALESCE(?, due_date),
        assignee_id = COALESCE(?, assignee_id),
        column_id = COALESCE(?, column_id)
       WHERE id = ?`,
      [title, description, priority, due_date, assignee_id, column_id, req.params.taskId]
    );

    const [[updated]] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('task:updated', updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
router.delete('/:workspaceId/projects/:projectId/tasks/:taskId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [req.params.taskId, req.params.projectId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await db.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('task:deleted', { id: req.params.taskId });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/move
router.post('/:workspaceId/projects/:projectId/tasks/:taskId/move', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { column_id, position } = req.body;

    // bug: forgot to validate column belongs to this project
    const [[task]] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // shift other tasks to make room
    await db.query(
      'UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?',
      [column_id, position]
    );

    await db.query(
      'UPDATE tasks SET column_id = ?, position = ? WHERE id = ?',
      [column_id, position, req.params.taskId]
    );

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('task:moved', {
      taskId: req.params.taskId,
      column_id,
      position,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
