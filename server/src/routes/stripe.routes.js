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

// POST /api/stripe/webhook
// raw body required — must be mounted before express.json()
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { workspaceId } = session.metadata || {};
    if (workspaceId) {
      try {
        const db = getDB();
        await db.query(
          'UPDATE workspaces SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?',
          ['pro', session.customer, session.subscription, workspaceId]
        );
      } catch (dbErr) {
        console.error('DB update failed after checkout:', dbErr);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    try {
      const db = getDB();
      await db.query(
        'UPDATE workspaces SET plan = ? WHERE stripe_subscription_id = ?',
        ['free', sub.id]
      );
    } catch (dbErr) {
      console.error('DB update failed after subscription cancel:', dbErr);
    }
  }

  res.json({ received: true });
});

module.exports = router;
