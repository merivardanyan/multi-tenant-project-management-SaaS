const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/connection');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../utils/tokens');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

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

module.exports = router;
