const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/workspaces/:workspaceId/projects/:projectId/columns
router.post('/:workspaceId/projects/:projectId/columns', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { title, color } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const [[{ maxPos }]] = await db.query(
      'SELECT MAX(position) as maxPos FROM columns WHERE project_id = ?',
      [req.params.projectId]
    );

    const id = uuidv4();
    await db.query(
      'INSERT INTO columns (id, project_id, title, color, position) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.projectId, title, color || '#94a3b8', (maxPos || 0) + 1]
    );

    const [[col]] = await db.query('SELECT * FROM columns WHERE id = ?', [id]);

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('column:created', col);

    res.status(201).json(col);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workspaces/:workspaceId/projects/:projectId/columns/:columnId
router.patch('/:workspaceId/projects/:projectId/columns/:columnId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { title, color } = req.body;

    const [[col]] = await db.query(
      'SELECT * FROM columns WHERE id = ? AND project_id = ?',
      [req.params.columnId, req.params.projectId]
    );
    if (!col) return res.status(404).json({ error: 'Column not found' });

    await db.query(
      'UPDATE columns SET title = COALESCE(?, title), color = COALESCE(?, color) WHERE id = ?',
      [title, color, req.params.columnId]
    );

    const [[updated]] = await db.query('SELECT * FROM columns WHERE id = ?', [req.params.columnId]);

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('column:updated', updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId/columns/:columnId
router.delete('/:workspaceId/projects/:projectId/columns/:columnId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [[col]] = await db.query(
      'SELECT * FROM columns WHERE id = ? AND project_id = ?',
      [req.params.columnId, req.params.projectId]
    );
    if (!col) return res.status(404).json({ error: 'Column not found' });

    await db.query('DELETE FROM columns WHERE id = ?', [req.params.columnId]);

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('column:deleted', { id: req.params.columnId });

    res.json({ message: 'Column deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:workspaceId/projects/:projectId/columns/reorder
router.post('/:workspaceId/projects/:projectId/columns/reorder', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const { order } = req.body; // array of { id, position }
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

    await Promise.all(
      order.map(({ id, position }) =>
        db.query('UPDATE columns SET position = ? WHERE id = ? AND project_id = ?',
          [position, id, req.params.projectId])
      )
    );

    const io = req.app.get('io');
    if (io) io.to(`project:${req.params.projectId}`).emit('columns:reordered', { order });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
