const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [workspaces] = await db.query(
      `SELECT w.*, wm.role
       FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const db = getDB();
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(0, 8);

    await db.query(
      'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
      [id, name, slug, req.user.id]
    );

    await db.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, req.user.id, 'owner']
    );

    res.status(201).json({ id, name, slug, ownerId: req.user.id, plan: 'free' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
