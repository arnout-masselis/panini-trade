import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import CardItem from '../components/CardItem.jsx';

export default function Collection() {
  const [sections, setSections] = useState([]);
  const [cards, setCards] = useState([]);
  const [myCards, setMyCards] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getCards().then(({ sections, cards }) => {
      setSections(sections);
      setCards(cards);
    });
    api.getMyCards().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.card_id] = r.quantity; });
      setMyCards(map);
    });
  }, []);

  const handleQuantityChange = useCallback((cardId, quantity) => {
    setMyCards(prev => {
      if (quantity === undefined) {
        const next = { ...prev };
        delete next[cardId];
        return next;
      }
      return { ...prev, [cardId]: quantity };
    });
    if (quantity === undefined) {
      api.deleteCard(cardId);
    } else {
      api.updateCard(cardId, quantity);
    }
  }, []);

  const cardsBySection = cards.reduce((acc, card) => {
    (acc[card.section_id] ??= []).push(card);
    return acc;
  }, {});

  const total = cards.length;
  const totalSpecial = cards.filter(c => c.is_special).length;
  const collected = Object.values(myCards).filter(q => q >= 1).length;
  const collectedSpecial = cards.filter(c => c.is_special && myCards[c.id] >= 1).length;
  const needed = Object.values(myCards).filter(q => q === 0).length;
  const doublesCount = Object.values(myCards)
    .filter(q => q >= 2)
    .reduce((sum, q) => sum + q - 1, 0);
  const pct = total ? Math.round((collected / total) * 100) : 0;

  const filteredCards = (sectionId) => {
    const all = cardsBySection[sectionId] || [];
    if (filter === 'all') return all;
    return all.filter(card => {
      const q = myCards[card.id];
      if (filter === 'needed') return q === 0;
      if (filter === 'doubles') return q >= 2;
      if (filter === 'missing') return q === undefined;
      if (filter === 'special') return card.is_special;
      return true;
    });
  };

  return (
    <div className="page">
      <div className="collection-header">
        <h2>My Collection</h2>
        <div className="stats-row">
          <div className="stat-box">
            <span className="stat-val">{collected}<span className="stat-total">/{total}</span></span>
            <span className="stat-lbl">Collected</span>
          </div>
          <div className="stat-box stat-needed">
            <span className="stat-val">{needed}</span>
            <span className="stat-lbl">Needed</span>
          </div>
          <div className="stat-box stat-doubles">
            <span className="stat-val">{doublesCount}</span>
            <span className="stat-lbl">Doubles</span>
          </div>
          <div className="stat-box stat-special">
            <span className="stat-val">{collectedSpecial}<span className="stat-total">/{totalSpecial}</span></span>
            <span className="stat-lbl">Special ★</span>
          </div>
          <div className="stat-box">
            <span className="stat-val">{pct}%</span>
            <span className="stat-lbl">Complete</span>
          </div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="toolbar">
        <div className="legend">
          <span className="legend-item"><span className="dot dot-none" />Not set</span>
          <span className="legend-item"><span className="dot dot-needed" />Needed</span>
          <span className="legend-item"><span className="dot dot-have_one" />Have 1</span>
          <span className="legend-item"><span className="dot dot-doubles" />Doubles</span>
          <span className="legend-item"><span className="dot dot-special" />Special ★</span>
        </div>
        <div className="filter-btns">
          {['all', 'missing', 'needed', 'doubles', 'special'].map(f => (
            <button
              key={f}
              className={`btn btn-sm${filter === f ? ' btn-active' : ' btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {sections.map(section => {
        const visible = filteredCards(section.id);
        if (filter !== 'all' && visible.length === 0) return null;
        return (
          <div key={section.id} className="section-block">
            <h3 className="section-title">{section.name}</h3>
            <div className="cards-grid">
              {(filter === 'all' ? (cardsBySection[section.id] || []) : visible).map(card => (
                <CardItem
                  key={card.id}
                  card={card}
                  quantity={myCards[card.id]}
                  onQuantityChange={(qty) => handleQuantityChange(card.id, qty)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
