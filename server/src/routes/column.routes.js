const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { projectId, title, color } = req.body;
    if (!projectId || !title) {
      return res.status(400).json({ error: 'Project ID and title are required' });
    }

    const db = getDB();

    const [projects] = await db.query('SELECT workspace_id FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

    const [membership] = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [projects[0].workspace_id, req.user.id]
    );
    if (membership.length === 0) return res.status(403).json({ error: 'Not a member' });

    const [maxPos] = await db.query(
      'SELECT MAX(position) as maxPos FROM `columns` WHERE project_id = ?',
      [projectId]
    );
    const position = (maxPos[0].maxPos ?? -1) + 1;

    const id = uuidv4();
    await db.query(
      'INSERT INTO `columns` (id, project_id, title, position, color) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, title, position, color || '#94a3b8']
    );

    const column = { id, project_id: projectId, title, position, color: color || '#94a3b8', tasks: [] };
    res.status(201).json(column);
  } catch (err) {
    next(err);
  }
});

router.put('/:columnId', authenticate, async (req, res, next) => {
  try {
    const { title, color } = req.body;
    const db = getDB();

    const [columns] = await db.query('SELECT * FROM `columns` WHERE id = ?', [req.params.columnId]);
    if (columns.length === 0) return res.status(404).json({ error: 'Column not found' });

    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }

    if (updates.length > 0) {
      values.push(req.params.columnId);
      await db.query(`UPDATE \`columns\` SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json({ message: 'Column updated' });
  } catch (err) {
    next(err);
  }
});

router.put('/reorder', authenticate, async (req, res, next) => {
  try {
    const { projectId, columnOrder } = req.body;
    if (!projectId || !columnOrder) {
      return res.status(400).json({ error: 'projectId and columnOrder are required' });
    }

    const db = getDB();
    for (let i = 0; i < columnOrder.length; i++) {
      await db.query('UPDATE `columns` SET position = ? WHERE id = ? AND project_id = ?', [i, columnOrder[i], projectId]);
    }

    res.json({ message: 'Columns reordered' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:columnId', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [columns] = await db.query('SELECT * FROM `columns` WHERE id = ?', [req.params.columnId]);
    if (columns.length === 0) return res.status(404).json({ error: 'Column not found' });

    await db.query('DELETE FROM `columns` WHERE id = ?', [req.params.columnId]);
    res.json({ message: 'Column deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
