const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Get pending count (for navbar badge)
router.get('/count', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as cnt FROM trade_proposals
       WHERE to_user_id = $1 AND status = 'pending'`,
      [req.user.userId]
    );
    res.json({ pending: parseInt(rows[0].cnt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all proposals (inbox + sent)
router.get('/', auth, async (req, res) => {
  const myId = req.user.userId;
  try {
    const { rows: proposals } = await pool.query(
      `SELECT tp.*, uf.username as from_username, ut.username as to_username
       FROM trade_proposals tp
       JOIN users uf ON uf.id = tp.from_user_id
       JOIN users ut ON ut.id = tp.to_user_id
       WHERE tp.from_user_id = $1 OR tp.to_user_id = $1
       ORDER BY tp.created_at DESC`,
      [myId]
    );

    let items = [];
    if (proposals.length > 0) {
      const ids = proposals.map(p => p.id);
      const { rows } = await pool.query(
        `SELECT tpi.proposal_id, tpi.direction, c.id as card_id, c.number, c.name
         FROM trade_proposal_items tpi
         JOIN cards c ON c.id = tpi.card_id
         WHERE tpi.proposal_id = ANY($1)
         ORDER BY c.number`,
        [ids]
      );
      items = rows;
    }

    const withItems = proposals.map(p => ({
      ...p,
      items: items.filter(i => i.proposal_id === p.id),
    }));

    res.json({
      inbox: withItems.filter(p => p.to_user_id === myId),
      sent: withItems.filter(p => p.from_user_id === myId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a proposal
router.post('/', auth, async (req, res) => {
  const myId = req.user.userId;
  const { toUserId, giveCardIds, getCardIds } = req.body;

  if (!toUserId || (!giveCardIds?.length && !getCardIds?.length)) {
    return res.status(400).json({ error: 'Must include at least one card' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cancel any existing pending proposal between these two users
    await client.query(
      `UPDATE trade_proposals SET status = 'cancelled'
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [myId, toUserId]
    );

    const { rows } = await client.query(
      `INSERT INTO trade_proposals (from_user_id, to_user_id)
       VALUES ($1, $2) RETURNING id`,
      [myId, toUserId]
    );
    const proposalId = rows[0].id;

    for (const cardId of (giveCardIds || [])) {
      await client.query(
        `INSERT INTO trade_proposal_items (proposal_id, card_id, direction) VALUES ($1, $2, 'give')`,
        [proposalId, cardId]
      );
    }
    for (const cardId of (getCardIds || [])) {
      await client.query(
        `INSERT INTO trade_proposal_items (proposal_id, card_id, direction) VALUES ($1, $2, 'get')`,
        [proposalId, cardId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: proposalId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Accept a proposal
router.put('/:id/accept', auth, async (req, res) => {
  const myId = req.user.userId;
  const proposalId = parseInt(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM trade_proposals WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [proposalId, myId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = rows[0];

    const { rows: items } = await client.query(
      `SELECT * FROM trade_proposal_items WHERE proposal_id = $1`,
      [proposalId]
    );

    for (const item of items) {
      if (item.direction === 'give') {
        // from_user gives card to to_user (me)
        await client.query(
          `UPDATE user_cards SET quantity = quantity - 1
           WHERE user_id = $1 AND card_id = $2 AND quantity > 0`,
          [proposal.from_user_id, item.card_id]
        );
        await client.query(
          `INSERT INTO user_cards (user_id, card_id, quantity) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = 1`,
          [myId, item.card_id]
        );
      } else {
        // to_user (me) gives card to from_user
        await client.query(
          `UPDATE user_cards SET quantity = quantity - 1
           WHERE user_id = $1 AND card_id = $2 AND quantity > 0`,
          [myId, item.card_id]
        );
        await client.query(
          `INSERT INTO user_cards (user_id, card_id, quantity) VALUES ($1, $2, 1)
           ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = 1`,
          [proposal.from_user_id, item.card_id]
        );
      }
    }

    await client.query(
      `UPDATE trade_proposals SET status = 'accepted' WHERE id = $1`,
      [proposalId]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Reject a proposal
router.put('/:id/reject', auth, async (req, res) => {
  const myId = req.user.userId;
  try {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'rejected'
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), myId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel a sent proposal
router.delete('/:id', auth, async (req, res) => {
  const myId = req.user.userId;
  try {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'cancelled'
       WHERE id = $1 AND from_user_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), myId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
