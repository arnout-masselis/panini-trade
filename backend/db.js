const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      section_id INTEGER NOT NULL REFERENCES sections(id),
      is_special INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      card_id INTEGER NOT NULL REFERENCES cards(id),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      UNIQUE(user_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS trade_proposals (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trade_proposal_items (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      direction TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_messages (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Add columns introduced after initial deploy (safe to run repeatedly)
  await pool.query(`
    ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS from_marked_traded BOOLEAN DEFAULT FALSE;
    ALTER TABLE trade_proposals ADD COLUMN IF NOT EXISTS to_marked_traded BOOLEAN DEFAULT FALSE;
  `);
}

module.exports = { pool, initDb };
