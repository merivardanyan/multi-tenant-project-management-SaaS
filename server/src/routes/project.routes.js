const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router();

router.get('/workspace/:workspaceId', authenticate, workspaceMember(), async (req, res, next) => {
  try {
    const db = getDB();
    const [projects] = await db.query(
      `SELECT p.*, u.name as created_by_name
       FROM projects p
       JOIN users u ON p.created_by = u.id
       WHERE p.workspace_id = ?
       ORDER BY p.created_at DESC`,
      [req.params.workspaceId]
    );
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { workspaceId, name, description, color } = req.body;
    if (!workspaceId || !name) {
      return res.status(400).json({ error: 'Workspace ID and name are required' });
    }

    const db = getDB();

    const [membership] = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.user.id]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const id = uuidv4();
    await db.query(
      'INSERT INTO projects (id, workspace_id, name, description, color, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workspaceId, name, description || null, color || '#6366f1', req.user.id]
    );

    res.status(201).json({ id, name, workspaceId, description, color: color || '#6366f1' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
