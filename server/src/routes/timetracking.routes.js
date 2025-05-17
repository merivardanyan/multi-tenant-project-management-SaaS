const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// not doing this in v1, just keeping the routes so we have a clear spot to add it later

router.post('/tasks/:taskId/time-entries', authenticate, async (req, res) => {
  res.status(501).json({ error: 'not implemented' });
});

router.get('/tasks/:taskId/time-entries', authenticate, async (req, res) => {
  res.status(501).json({ error: 'not implemented' });
});

module.exports = router;
