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

    await db.query(
      'INSERT INTO activity_logs (id, project_id, user_id, action_type, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), projectId, req.user.id, 'created', 'task', id, JSON.stringify({ title })]
    );

    res.status(201).json(tasks[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task
 */
router.put('/:taskId', authenticate, async (req, res, next) => {
  try {
    const { title, description, assigneeId, priority, dueDate, columnId, position } = req.body;
    const db = getDB();

    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (tasks.length === 0) return res.status(404).json({ error: 'Task not found' });

    const task = tasks[0];
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (assigneeId !== undefined) { updates.push('assignee_id = ?'); values.push(assigneeId); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (dueDate !== undefined) { updates.push('due_date = ?'); values.push(dueDate); }
    if (columnId !== undefined) { updates.push('column_id = ?'); values.push(columnId); }
    if (position !== undefined) { updates.push('position = ?'); values.push(position); }

    if (updates.length > 0) {
      values.push(req.params.taskId);
      await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const actionType = columnId && columnId !== task.column_id ? 'moved' : 'updated';
    await db.query(
      'INSERT INTO activity_logs (id, project_id, user_id, action_type, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), task.project_id, req.user.id, actionType, 'task', req.params.taskId, JSON.stringify({ title: task.title })]
    );

    const [updated] = await db.query(
      `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = ?`,
      [req.params.taskId]
    );

    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 */
router.delete('/:taskId', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (tasks.length === 0) return res.status(404).json({ error: 'Task not found' });

    await db.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);

    await db.query(
      'INSERT INTO activity_logs (id, project_id, user_id, action_type, entity_type, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), tasks[0].project_id, req.user.id, 'deleted', 'task', req.params.taskId, JSON.stringify({ title: tasks[0].title })]
    );

    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
