const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getDB } = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/stripe/checkout
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/workspaces/${workspaceId}/settings?upgraded=1`,
      cancel_url: `${process.env.CLIENT_URL}/workspaces/${workspaceId}/settings`,
      metadata: { workspaceId },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
