const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/projects/workspace/{workspaceId}:
 *   get:
 *     tags: [Projects]
 *     summary: List projects in a workspace
 */
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

/**
 * @swagger
 * /api/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 */
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

    const defaultColumns = ['To Do', 'In Progress', 'In Review', 'Done'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await db.query(
        'INSERT INTO `columns` (id, project_id, title, position) VALUES (?, ?, ?, ?)',
        [uuidv4(), id, defaultColumns[i], i]
      );
    }

    res.status(201).json({ id, name, workspaceId, description, color: color || '#6366f1' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project details with columns and tasks
 */
router.get('/:projectId', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.projectId]);

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projects[0];

    const [membership] = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [project.workspace_id, req.user.id]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const [columns] = await db.query(
      'SELECT * FROM `columns` WHERE project_id = ? ORDER BY position ASC',
      [project.id]
    );

    const [tasks] = await db.query(
      `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.project_id = ?
       ORDER BY t.position ASC`,
      [project.id]
    );

    res.json({
      ...project,
      columns: columns.map((col) => ({
        ...col,
        tasks: tasks.filter((t) => t.column_id === col.id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
