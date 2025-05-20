const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/workspaces/:workspaceId/projects
router.get('/:workspaceId/projects', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [projects] = await db.query(
      'SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC',
      [req.params.workspaceId]
    );
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:workspaceId/projects
router.post('/:workspaceId/projects', authenticate, workspaceMember('admin'), async (req, res) => {
  try {
    const db = getDB();
    const [[workspace]] = await db.query('SELECT * FROM workspaces WHERE id = ?', [req.params.workspaceId]);

    if (workspace.plan === 'free') {
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) as count FROM projects WHERE workspace_id = ?',
        [req.params.workspaceId]
      );
      if (count >= 1) {
        return res.status(403).json({ error: 'Free plan is limited to 1 project. Upgrade to create more.' });
      }
    }

    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const id = uuidv4();
    await db.query(
      'INSERT INTO projects (id, workspace_id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.workspaceId, name, description || null, color || '#6366f1', req.user.userId]
    );

    await db.query('CALL seed_default_columns(?)', [id]);

    await db.query(
      'INSERT INTO activity_logs (id, workspace_id, project_id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.workspaceId, id, req.user.userId, 'created', 'project', id]
    );

    const [[project]] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:workspaceId/projects/:projectId
router.get('/:workspaceId/projects/:projectId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [[project]] = await db.query(
      'SELECT * FROM projects WHERE id = ? AND workspace_id = ?',
      [req.params.projectId, req.params.workspaceId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [columns] = await db.query(
      'SELECT * FROM columns WHERE project_id = ? ORDER BY position ASC',
      [project.id]
    );

    for (const col of columns) {
      const [tasks] = await db.query(
        `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.column_id = ?
         ORDER BY t.position ASC`,
        [col.id]
      );
      col.tasks = tasks;
    }

    res.json({ ...project, columns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workspaces/:workspaceId/projects/:projectId
router.patch('/:workspaceId/projects/:projectId', authenticate, workspaceMember('admin'), async (req, res) => {
  try {
    const db = getDB();
    const { name, description, color } = req.body;
    await db.query(
      `UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        color = COALESCE(?, color)
       WHERE id = ? AND workspace_id = ?`,
      [name, description, color, req.params.projectId, req.params.workspaceId]
    );
    const [[project]] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.projectId]);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId
router.delete('/:workspaceId/projects/:projectId', authenticate, workspaceMember('admin'), async (req, res) => {
  try {
    const db = getDB();
    const [[project]] = await db.query(
      'SELECT id FROM projects WHERE id = ? AND workspace_id = ?',
      [req.params.projectId, req.params.workspaceId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await db.query('DELETE FROM projects WHERE id = ?', [req.params.projectId]);

    await db.query(
      'INSERT INTO activity_logs (id, workspace_id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.workspaceId, req.user.userId, 'deleted', 'project', req.params.projectId]
    );

    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:workspaceId/projects/:projectId/activity
router.get('/:workspaceId/projects/:projectId/activity', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [logs] = await db.query(
      `SELECT al.*, u.name as user_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.project_id = ?
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [req.params.projectId]
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
