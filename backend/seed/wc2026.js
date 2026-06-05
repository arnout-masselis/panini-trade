module.exports = async function seedWC2026(pool) {
  const introCards = [
    'FIFA World Cup 2026™ Logo',
    'FIFA World Cup 2026™ Trophy',
    'Host Countries — USA, Canada, Mexico',
    'Official Mascot',
    'Official Match Ball',
    'Group Overview A–D',
    'Group Overview E–H',
    'Group Overview I–L',
    'FIFA President',
    'Host Cities Map',
    'SoFi Stadium — Los Angeles',
    'MetLife Stadium — New York/NJ',
    'AT&T Stadium — Dallas',
    "Levi's Stadium — San Francisco Bay Area",
    'Lumen Field — Seattle',
    'Arrowhead Stadium — Kansas City',
    'BC Place — Vancouver',
    'BMO Field — Toronto',
    'Estadio Azteca — Mexico City',
    'Estadio BBVA — Monterrey',
  ];

  const groups = [
    { name: 'Group A', teams: ['Mexico', 'Poland', 'Saudi Arabia', 'Qatar'] },
    { name: 'Group B', teams: ['USA', 'Netherlands', 'England', 'Albania'] },
    { name: 'Group C', teams: ['Canada', 'Morocco', 'Portugal', 'Uruguay'] },
    { name: 'Group D', teams: ['Argentina', 'France', 'Australia', 'Denmark'] },
    { name: 'Group E', teams: ['Spain', 'Brazil', 'Switzerland', 'Japan'] },
    { name: 'Group F', teams: ['Germany', 'Belgium', 'Costa Rica', 'Serbia'] },
    { name: 'Group G', teams: ['Colombia', 'Ecuador', 'Croatia', 'Cameroon'] },
    { name: 'Group H', teams: ['South Korea', 'Senegal', 'Iran', 'Austria'] },
    { name: 'Group I', teams: ['Nigeria', 'Sweden', 'Turkey', 'Ivory Coast'] },
    { name: 'Group J', teams: ['Egypt', 'Italy', 'Norway', 'Algeria'] },
    { name: 'Group K', teams: ['Ghana', 'Czech Republic', 'Romania', 'Jamaica'] },
    { name: 'Group L', teams: ['Chile', 'Scotland', 'South Africa', 'Paraguay'] },
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const introRes = await client.query(
      'INSERT INTO sections (name, display_order) VALUES ($1, $2) RETURNING id',
      ['Introduction', 0]
    );
    const introId = introRes.rows[0].id;

    let cardNumber = 1;
    for (const name of introCards) {
      await client.query(
        'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
        [cardNumber++, name, introId, 1]
      );
    }

    let order = 1;
    for (const { name, teams } of groups) {
      const secRes = await client.query(
        'INSERT INTO sections (name, display_order) VALUES ($1, $2) RETURNING id',
        [name, order++]
      );
      const sectionId = secRes.rows[0].id;

      for (const team of teams) {
        await client.query(
          'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
          [cardNumber++, `${team} — Badge`, sectionId, 1]
        );
        await client.query(
          'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
          [cardNumber++, `${team} — Home Kit`, sectionId, 0]
        );
        await client.query(
          'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
          [cardNumber++, `${team} — Away Kit`, sectionId, 0]
        );
        await client.query(
          'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
          [cardNumber++, `${team} — Team Photo`, sectionId, 0]
        );
        for (let i = 1; i <= 16; i++) {
          await client.query(
            'INSERT INTO cards (number, name, section_id, is_special) VALUES ($1, $2, $3, $4)',
            [cardNumber++, `${team} — Player ${i}`, sectionId, 0]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${cardNumber - 1} cards for FIFA World Cup 2026 (68 special)`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
