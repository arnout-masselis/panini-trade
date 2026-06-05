const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [sections, cards] = await Promise.all([
      pool.query('SELECT * FROM sections ORDER BY display_order'),
      pool.query('SELECT * FROM cards ORDER BY number'),
    ]);
    res.json({ sections: sections.rows, cards: cards.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT card_id, quantity FROM user_cards WHERE user_id = $1',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/my/:cardId', auth, async (req, res) => {
  const cardId = parseInt(req.params.cardId);
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'quantity must be a non-negative integer' });
  }

  try {
    await pool.query(
      `INSERT INTO user_cards (user_id, card_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [req.user.userId, cardId, quantity]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/my/:cardId', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_cards WHERE user_id = $1 AND card_id = $2',
      [req.user.userId, parseInt(req.params.cardId)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
