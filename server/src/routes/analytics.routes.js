const express = require('express');
const { getDB } = require('../db/connection');
const { authenticate, workspaceMember } = require('../middleware/auth');

const router = express.Router();

// very basic metrics, mostly placeholder for now
router.get('/:workspaceId/analytics', authenticate, workspaceMember(), async (req, res) => {
  try {
    const db = getDB();

    const [[{ projectCount }]] = await db.query(
      'SELECT COUNT(*) as projectCount FROM projects WHERE workspace_id = ?',
      [req.params.workspaceId]
    );

    const [[{ taskCount }]] = await db.query(
      `SELECT COUNT(*) as taskCount
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE p.workspace_id = ?`,
      [req.params.workspaceId]
    );

    const [[{ memberCount }]] = await db.query(
      'SELECT COUNT(*) as memberCount FROM workspace_members WHERE workspace_id = ?',
      [req.params.workspaceId]
    );

    res.json({ projectCount, taskCount, memberCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
