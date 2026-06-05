import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Trades() {
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tradeMatch, setTradeMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    api.getTradeOverview().then(data => {
      setOverview(data);
      setLoading(false);
    });
  }, []);

  const viewMatch = async (user) => {
    setSelectedUser(user);
    setMatchLoading(true);
    try {
      const match = await api.getTradeMatch(user.id);
      setTradeMatch(match);
    } finally {
      setMatchLoading(false);
    }
  };

  const back = () => {
    setSelectedUser(null);
    setTradeMatch(null);
  };

  if (selectedUser) {
    return (
      <div className="page">
        <button className="btn btn-ghost back-btn" onClick={back}>← Back</button>
        {matchLoading ? (
          <div className="loading">Loading trade details…</div>
        ) : tradeMatch && (
          <div className="trade-detail">
            <h2>Trade with <span className="highlight">{tradeMatch.user.username}</span></h2>
            <p className="trade-hint">
              Cards you give are your doubles. Cards you get fill your needed list.
            </p>
            <div className="trade-cols">
              <div className="trade-col">
                <h3 className="trade-col-header give">
                  You give
                  <span className="count-badge">{tradeMatch.iCanGive.length}</span>
                </h3>
                {tradeMatch.iCanGive.length === 0 ? (
                  <p className="empty-msg">No cards to give</p>
                ) : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGive.map(card => (
                      <li key={card.id} className="trade-row">
                        <span className="trade-num">#{card.number}</span>
                        <span className="trade-name">{card.name}</span>
                        {card.my_quantity > 2 && (
                          <span className="avail-badge">×{card.my_quantity - 1} avail.</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="trade-col">
                <h3 className="trade-col-header get">
                  You get
                  <span className="count-badge">{tradeMatch.iCanGet.length}</span>
                </h3>
                {tradeMatch.iCanGet.length === 0 ? (
                  <p className="empty-msg">No cards to receive</p>
                ) : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGet.map(card => (
                      <li key={card.id} className="trade-row">
                        <span className="trade-num">#{card.number}</span>
                        <span className="trade-name">{card.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Find Trade Partners</h2>
      <p className="page-sub">
        These matches are based on your doubles vs. their needed cards, and vice versa.
      </p>
      {loading ? (
        <div className="loading">Loading…</div>
      ) : overview.length === 0 ? (
        <div className="empty-state">
          <p>No other collectors registered yet.</p>
          <p>Share this app with your friends to start trading!</p>
        </div>
      ) : (
        <div className="traders-grid">
          {overview.map(user => (
            <button key={user.id} className="trader-card" onClick={() => viewMatch(user)}>
              <div className="trader-name">{user.username}</div>
              <div className="trade-nums">
                <span className="give-num">{user.canGive} you give</span>
                <span className="sep">·</span>
                <span className="get-num">{user.canGet} you get</span>
              </div>
              {user.canGive + user.canGet > 0 ? (
                <div className="match-score">{user.canGive + user.canGet} potential swaps</div>
              ) : (
                <div className="no-match">No matches yet</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
