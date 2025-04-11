const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require('../utils/tokens');
const { authenticate } = require('../middleware/auth');
const { sendVerificationEmail, sendResetPasswordEmail } = require('../utils/email');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string, minLength: 8 }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDB();
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();

    await db.query(
      `INSERT INTO users (id, email, password_hash, name, verification_token) VALUES (?, ?, ?, ?, ?)`,
      [id, email, passwordHash, name, verificationToken]
    );

    sendVerificationEmail(email, verificationToken).catch(console.error);

    const user = { id, email };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: { id, name, email, isVerified: false, plan: 'free' },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDB();
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        isVerified: user.is_verified,
        plan: user.plan,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token cookie
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const db = getDB();
    const [tokens] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [refreshToken, payload.userId]
    );

    if (tokens.length === 0) {
      await revokeAllUserTokens(payload.userId);
      return res.status(401).json({ error: 'Token reuse detected' });
    }

    await revokeRefreshToken(refreshToken);

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [payload.userId]);
    if (users.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = users[0];
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await saveRefreshToken(user.id, newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke refresh token
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email with token
 */
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const db = getDB();
    const [users] = await db.query(
      'SELECT id FROM users WHERE verification_token = ?', [token]
    );
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    await db.query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = ?',
      [users[0].id]
    );

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset email
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const db = getDB();
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, expiresAt, users[0].id]
    );

    sendResetPasswordEmail(email, resetToken).catch(console.error);
    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDB();
    const [users] = await db.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, users[0].id]
    );

    await revokeAllUserTokens(users[0].id);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDB();
    const [users] = await db.query(
      'SELECT id, name, email, avatar_url, is_verified, plan, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      isVerified: user.is_verified,
      plan: user.plan,
      createdAt: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
