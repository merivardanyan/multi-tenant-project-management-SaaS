const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { getDB } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// PATCH /api/users/me
router.patch('/me', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { name, email } = req.body;
    await db.query(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
      [name, email, req.user.userId]
    );
    const [[user]] = await db.query(
      'SELECT id, name, email, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    res.json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/me/avatar
router.post('/me/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'projectflow/avatars', transformation: [{ width: 256, height: 256, crop: 'fill' }] },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const db = getDB();
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [result.secure_url, req.user.userId]);
    res.json({ avatar_url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
