const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');
const { sendInviteEmail } = require('../utils/email');

const router = express.Router();

// GET /api/workspaces
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const [rows] = await db.query(
      `SELECT w.*, wm.role
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ?`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces
router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });

    const id = uuidv4();
    await db.query(
      'INSERT INTO workspaces (id, name, slug, owner_id) VALUES (?, ?, ?, ?)',
      [id, name, slug, req.user.userId]
    );
    await db.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, req.user.userId, 'owner']
    );
    const [[workspace]] = await db.query('SELECT * FROM workspaces WHERE id = ?', [id]);
    res.status(201).json(workspace);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Slug already taken' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:workspaceId
router.get('/:workspaceId', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [[workspace]] = await db.query(
      'SELECT * FROM workspaces WHERE id = ?',
      [req.params.workspaceId]
    );
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspaces/:workspaceId/members
router.get('/:workspaceId/members', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();
    const [members] = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?`,
      [req.params.workspaceId]
    );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/:workspaceId/invite
router.post('/:workspaceId/invite', authenticate, workspaceMember('admin'), async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO workspace_invitations (id, workspace_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), req.params.workspaceId, email, token, expiresAt]
    );

    const [[workspace]] = await db.query('SELECT * FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    await sendInviteEmail(email, token, workspace.name);

    res.json({ message: 'Invite sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces/join/:token
router.post('/join/:token', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const [[invite]] = await db.query(
      'SELECT * FROM workspace_invitations WHERE token = ? AND expires_at > NOW()',
      [req.params.token]
    );
    if (!invite) return res.status(400).json({ error: 'Invalid or expired invite' });

    const [[existing]] = await db.query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [invite.workspace_id, req.user.userId]
    );
    if (existing) return res.status(409).json({ error: 'Already a member' });

    await db.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), invite.workspace_id, req.user.userId, 'member']
    );
    await db.query('DELETE FROM workspace_invitations WHERE token = ?', [req.params.token]);

    res.json({ workspace_id: invite.workspace_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/workspaces/:workspaceId
router.patch('/:workspaceId', authenticate, workspaceMember('owner'), async (req, res) => {
  try {
    const db = getDB();
    const { name } = req.body;
    await db.query('UPDATE workspaces SET name = ? WHERE id = ?', [name, req.params.workspaceId]);
    const [[workspace]] = await db.query('SELECT * FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:workspaceId
router.delete('/:workspaceId', authenticate, workspaceMember('owner'), async (req, res) => {
  try {
    const db = getDB();
    await db.query('DELETE FROM workspaces WHERE id = ?', [req.params.workspaceId]);
    res.json({ message: 'Workspace deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
