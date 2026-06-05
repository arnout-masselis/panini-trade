const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');
const seedWC2026 = require('./seed/wc2026');

async function start() {
  await initDb();

  const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM cards');
  if (parseInt(rows[0].cnt) === 0) {
    console.log('Seeding database with FIFA World Cup 2026 data...');
    await seedWC2026(pool);
  }

  const app = express();

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok =
        origin.includes('localhost') ||
        origin.includes('.vercel.app') ||
        origin === process.env.FRONTEND_URL;
      cb(null, ok || process.env.NODE_ENV !== 'production');
    },
  }));
  app.use(express.json());

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/cards', require('./routes/cards'));
  app.use('/api/trades', require('./routes/trades'));
  app.use('/api/proposals', require('./routes/proposals'));

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () =>
    console.log(`Panini Trade server running on http://localhost:${PORT}`)
  );
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
