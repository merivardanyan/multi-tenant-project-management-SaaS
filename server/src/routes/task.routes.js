const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { columnId, projectId, title, description, assigneeId, priority, dueDate } = req.body;
    if (!columnId || !projectId || !title) {
      return res.status(400).json({ error: 'columnId, projectId, and title are required' });
    }

    const db = getDB();

    const [maxPos] = await db.query(
      'SELECT MAX(position) as maxPos FROM tasks WHERE column_id = ?',
      [columnId]
    );
    const position = (maxPos[0].maxPos ?? -1) + 1;

    const id = uuidv4();
    await db.query(
      `INSERT INTO tasks (id, column_id, project_id, title, description, assignee_id, priority, due_date, position, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, columnId, projectId, title, description || null, assigneeId || null, priority || 'medium', dueDate || null, position, req.user.id]
    );

    const [tasks] = await db.query(
      `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = ?`,
      [id]
    );

    res.status(201).json(tasks[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
