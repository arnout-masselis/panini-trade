const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Pending count for navbar badge
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
       WHERE (tp.from_user_id = $1 OR tp.to_user_id = $1)
         AND tp.status NOT IN ('cancelled', 'rejected')
       ORDER BY tp.created_at DESC`,
      [myId]
    );

    let items = [];
    if (proposals.length > 0) {
      const { rows } = await pool.query(
        `SELECT tpi.proposal_id, tpi.direction, c.id as card_id, c.number, c.name
         FROM trade_proposal_items tpi
         JOIN cards c ON c.id = tpi.card_id
         WHERE tpi.proposal_id = ANY($1)
         ORDER BY c.number`,
        [proposals.map(p => p.id)]
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
    await client.query(
      `UPDATE trade_proposals SET status = 'cancelled'
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [myId, toUserId]
    );
    const { rows } = await client.query(
      `INSERT INTO trade_proposals (from_user_id, to_user_id) VALUES ($1, $2) RETURNING id`,
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

// Accept — just confirms the deal, no collection update yet
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'accepted'
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'rejected'
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel (sender)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE trade_proposals SET status = 'cancelled'
       WHERE id = $1 AND from_user_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark as traded — each user calls this after the physical exchange
router.put('/:id/traded', auth, async (req, res) => {
  const myId = req.user.userId;
  const proposalId = parseInt(req.params.id);
  const { autoUpdate } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM trade_proposals WHERE id = $1 AND status = 'accepted'
       AND (from_user_id = $2 OR to_user_id = $2)`,
      [proposalId, myId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = rows[0];

    const isFromUser = proposal.from_user_id === myId;
    const myColumn = isFromUser ? 'from_marked_traded' : 'to_marked_traded';

    // Optionally update my part of the collection
    if (autoUpdate) {
      const { rows: items } = await client.query(
        `SELECT * FROM trade_proposal_items WHERE proposal_id = $1`,
        [proposalId]
      );
      for (const item of items) {
        const iGive = (isFromUser && item.direction === 'give') || (!isFromUser && item.direction === 'get');
        if (iGive) {
          await client.query(
            `UPDATE user_cards SET quantity = quantity - 1 WHERE user_id = $1 AND card_id = $2 AND quantity > 0`,
            [myId, item.card_id]
          );
        } else {
          await client.query(
            `INSERT INTO user_cards (user_id, card_id, quantity) VALUES ($1, $2, 1)
             ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = 1`,
            [myId, item.card_id]
          );
        }
      }
    }

    // Mark my side and check if both sides are done
    const { rows: updated } = await client.query(
      `UPDATE trade_proposals SET ${myColumn} = TRUE WHERE id = $1
       RETURNING from_marked_traded, to_marked_traded`,
      [proposalId]
    );
    const { from_marked_traded, to_marked_traded } = updated[0];

    if (from_marked_traded && to_marked_traded) {
      await client.query(
        `UPDATE trade_proposals SET status = 'completed' WHERE id = $1`,
        [proposalId]
      );
    }

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

// Get chat messages
router.get('/:id/messages', auth, async (req, res) => {
  const myId = req.user.userId;
  const proposalId = parseInt(req.params.id);
  try {
    const { rows: prop } = await pool.query(
      `SELECT id FROM trade_proposals WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)`,
      [proposalId, myId]
    );
    if (!prop[0]) return res.status(404).json({ error: 'Proposal not found' });

    const { rows } = await pool.query(
      `SELECT m.id, m.message, m.created_at, m.from_user_id, u.username as from_username
       FROM trade_messages m
       JOIN users u ON u.id = m.from_user_id
       WHERE m.proposal_id = $1
       ORDER BY m.created_at ASC`,
      [proposalId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a chat message
router.post('/:id/messages', auth, async (req, res) => {
  const myId = req.user.userId;
  const proposalId = parseInt(req.params.id);
  const { message } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

  try {
    const { rows: prop } = await pool.query(
      `SELECT id FROM trade_proposals WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)`,
      [proposalId, myId]
    );
    if (!prop[0]) return res.status(404).json({ error: 'Proposal not found' });

    await pool.query(
      `INSERT INTO trade_messages (proposal_id, from_user_id, message) VALUES ($1, $2, $3)`,
      [proposalId, myId, message.trim()]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
