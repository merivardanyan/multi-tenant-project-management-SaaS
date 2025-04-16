const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');
const { sendWorkspaceInviteEmail } = require('../utils/email');

const router = express.Router();

/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     tags: [Workspaces]
 *     summary: List workspaces for current user
 */
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

/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     tags: [Workspaces]
 *     summary: Create a new workspace
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

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

    if (workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

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

/**
 * @swagger
 * /api/workspaces/{workspaceId}/invite:
 *   post:
 *     tags: [Workspaces]
 *     summary: Invite a user to workspace by email
 */
router.post('/:workspaceId/invite', authenticate, workspaceMember('owner', 'admin'), async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDB();
    const workspaceId = req.params.workspaceId;

    const [existing] = await db.query(
      `SELECT wm.id FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ? AND u.email = ?`,
      [workspaceId, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    const token = uuidv4();
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO workspace_invites (id, workspace_id, email, token, role, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, workspaceId, email, token, role, req.user.id, expiresAt]
    );

    const [ws] = await db.query('SELECT name FROM workspaces WHERE id = ?', [workspaceId]);
    const [inviter] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);

    sendWorkspaceInviteEmail(email, ws[0].name, inviter[0].name, token).catch(console.error);

    res.status(201).json({ message: 'Invitation sent', token });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/workspaces/join/{token}:
 *   post:
 *     tags: [Workspaces]
 *     summary: Accept workspace invite
 */
router.post('/join/:token', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [invites] = await db.query(
      'SELECT * FROM workspace_invites WHERE token = ? AND expires_at > NOW()',
      [req.params.token]
    );

    if (invites.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }

    const invite = invites[0];

    const [existing] = await db.query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [invite.workspace_id, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already a member of this workspace' });
    }

    await db.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), invite.workspace_id, req.user.id, invite.role]
    );

    await db.query('DELETE FROM workspace_invites WHERE id = ?', [invite.id]);

    res.json({ message: 'Joined workspace', workspaceId: invite.workspace_id });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/workspaces/{workspaceId}:
 *   put:
 *     tags: [Workspaces]
 *     summary: Update workspace (owner/admin only)
 */
router.put('/:workspaceId', authenticate, workspaceMember('owner', 'admin'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const db = getDB();
    await db.query('UPDATE workspaces SET name = ? WHERE id = ?', [name, req.params.workspaceId]);

    res.json({ message: 'Workspace updated' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/workspaces/{workspaceId}:
 *   delete:
 *     tags: [Workspaces]
 *     summary: Delete workspace (owner only)
 */
router.delete('/:workspaceId', authenticate, workspaceMember('owner'), async (req, res, next) => {
  try {
    const db = getDB();
    await db.query('DELETE FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
