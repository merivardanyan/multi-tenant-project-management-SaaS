const jwt = require('jsonwebtoken');
const { getDB } = require('../db/connection');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function workspaceMember(...allowedRoles) {
  return async (req, res, next) => {
    const workspaceId = req.params.workspaceId || req.body.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'Workspace ID required' });

    const db = getDB();
    const [rows] = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const memberRole = rows[0].role;
    if (allowedRoles.length > 0 && !allowedRoles.includes(memberRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.workspaceRole = memberRole;
    next();
  };
}

module.exports = { authenticate, workspaceMember };
