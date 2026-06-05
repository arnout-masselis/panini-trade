const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/overview', auth, async (req, res) => {
  try {
    const myId = req.user.userId;
    const { rows: users } = await pool.query(
      'SELECT id, username FROM users WHERE id != $1 ORDER BY username',
      [myId]
    );

    const results = await Promise.all(users.map(async user => {
      const [give, get] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as cnt FROM user_cards mine
           JOIN user_cards theirs ON theirs.card_id = mine.card_id AND theirs.user_id = $1
           WHERE mine.user_id = $2 AND mine.quantity >= 2 AND theirs.quantity = 0`,
          [user.id, myId]
        ),
        pool.query(
          `SELECT COUNT(*) as cnt FROM user_cards theirs
           JOIN user_cards mine ON mine.card_id = theirs.card_id AND mine.user_id = $1
           WHERE theirs.user_id = $2 AND theirs.quantity >= 2 AND mine.quantity = 0`,
          [myId, user.id]
        ),
      ]);
      return { ...user, canGive: parseInt(give.rows[0].cnt), canGet: parseInt(get.rows[0].cnt) };
    }));

    results.sort((a, b) => (b.canGive + b.canGet) - (a.canGive + a.canGet));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/match/:otherUserId', auth, async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherId = parseInt(req.params.otherUserId);

    const [otherUser, iCanGive, iCanGet] = await Promise.all([
      pool.query('SELECT id, username FROM users WHERE id = $1', [otherId]),
      pool.query(
        `SELECT c.id, c.number, c.name, mine.quantity as my_quantity
         FROM user_cards mine
         JOIN cards c ON c.id = mine.card_id
         JOIN user_cards theirs ON theirs.card_id = mine.card_id AND theirs.user_id = $1
         WHERE mine.user_id = $2 AND mine.quantity >= 2 AND theirs.quantity = 0
         ORDER BY c.number`,
        [otherId, myId]
      ),
      pool.query(
        `SELECT c.id, c.number, c.name, theirs.quantity as their_quantity
         FROM user_cards theirs
         JOIN cards c ON c.id = theirs.card_id
         JOIN user_cards mine ON mine.card_id = theirs.card_id AND mine.user_id = $1
         WHERE theirs.user_id = $2 AND theirs.quantity >= 2 AND mine.quantity = 0
         ORDER BY c.number`,
        [myId, otherId]
      ),
    ]);

    if (!otherUser.rows[0]) return res.status(404).json({ error: 'User not found' });

    res.json({ user: otherUser.rows[0], iCanGive: iCanGive.rows, iCanGet: iCanGet.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
