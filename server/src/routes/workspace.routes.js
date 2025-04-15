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

/**
 * @swagger
 * /api/workspaces/{workspaceId}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace details
 */
router.get('/:workspaceId', authenticate, workspaceMember(), async (req, res, next) => {
  try {
    const db = getDB();
    const [workspaces] = await db.query('SELECT * FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    if (workspaces.length === 0) return res.status(404).json({ error: 'Workspace not found' });
    res.json(workspaces[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members:
 *   get:
 *     tags: [Workspaces]
 *     summary: List workspace members
 */
router.get('/:workspaceId/members', authenticate, workspaceMember(), async (req, res, next) => {
  try {
    const db = getDB();
    const [members] = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?
       ORDER BY wm.joined_at ASC`,
      [req.params.workspaceId]
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
