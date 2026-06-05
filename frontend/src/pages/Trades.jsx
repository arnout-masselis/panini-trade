import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

export default function Trades() {
  const [overview, setOverview] = useState([]);
  const [proposals, setProposals] = useState({ inbox: [], sent: [] });
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [tradeMatch, setTradeMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const [giveSelected, setGiveSelected] = useState(new Set());
  const [getSelected, setGetSelected] = useState(new Set());
  const [sendingProposal, setSendingProposal] = useState(false);
  const [proposalMsg, setProposalMsg] = useState(null);

  const [expandedProposal, setExpandedProposal] = useState(null);

  const loadData = useCallback(async () => {
    const [ov, props] = await Promise.all([
      api.getTradeOverview(),
      api.getProposals(),
    ]);
    setOverview(ov);
    setProposals(props);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const viewMatch = async (user) => {
    setSelectedUser(user);
    setProposalMsg(null);
    setMatchLoading(true);
    try {
      const match = await api.getTradeMatch(user.id);
      setTradeMatch(match);
      setGiveSelected(new Set(match.iCanGive.map(c => c.id)));
      setGetSelected(new Set(match.iCanGet.map(c => c.id)));
    } finally {
      setMatchLoading(false);
    }
  };

  const back = () => {
    setSelectedUser(null);
    setTradeMatch(null);
    setProposalMsg(null);
  };

  const toggleGive = (id) => setGiveSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleGet = (id) => setGetSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const sendProposal = async () => {
    if (!giveSelected.size && !getSelected.size) return;
    setSendingProposal(true);
    try {
      await api.sendProposal(selectedUser.id, [...giveSelected], [...getSelected]);
      setProposalMsg({ type: 'success', text: `Trade proposal sent to ${selectedUser.username}!` });
      loadData();
    } catch (err) {
      setProposalMsg({ type: 'error', text: err.message });
    } finally {
      setSendingProposal(false);
    }
  };

  const handleAccept = async (id) => {
    await api.acceptProposal(id);
    loadData();
  };

  const handleReject = async (id) => {
    await api.rejectProposal(id);
    loadData();
  };

  const handleCancel = async (id) => {
    await api.cancelProposal(id);
    loadData();
  };

  const pendingInbox = proposals.inbox.filter(p => p.status === 'pending');
  const pendingSent = proposals.sent.filter(p => p.status === 'pending');

  // ── Trade detail view ──────────────────────────────────────────────
  if (selectedUser) {
    const alreadySent = proposals.sent.some(
      p => p.to_user_id === selectedUser.id && p.status === 'pending'
    );

    return (
      <div className="page">
        <button className="btn btn-ghost back-btn" onClick={back}>← Back</button>
        {matchLoading ? (
          <div className="loading">Loading…</div>
        ) : tradeMatch && (
          <>
            <h2>Trade with <span className="highlight">{tradeMatch.user.username}</span></h2>
            <p className="trade-hint">Check the cards you want to include, then send a proposal.</p>

            <div className="trade-cols">
              <div className="trade-col">
                <h3 className="trade-col-header give">
                  You give <span className="count-badge">{giveSelected.size}/{tradeMatch.iCanGive.length}</span>
                </h3>
                {tradeMatch.iCanGive.length === 0 ? (
                  <p className="empty-msg">No cards to give</p>
                ) : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGive.map(card => (
                      <li
                        key={card.id}
                        className={`trade-row selectable${giveSelected.has(card.id) ? ' selected' : ''}`}
                        onClick={() => toggleGive(card.id)}
                      >
                        <input type="checkbox" readOnly checked={giveSelected.has(card.id)} />
                        <span className="trade-num">#{card.number}</span>
                        <span className="trade-name">{card.name}</span>
                        {card.my_quantity > 2 && (
                          <span className="avail-badge">×{card.my_quantity - 1}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="trade-col">
                <h3 className="trade-col-header get">
                  You get <span className="count-badge">{getSelected.size}/{tradeMatch.iCanGet.length}</span>
                </h3>
                {tradeMatch.iCanGet.length === 0 ? (
                  <p className="empty-msg">No cards to receive</p>
                ) : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGet.map(card => (
                      <li
                        key={card.id}
                        className={`trade-row selectable${getSelected.has(card.id) ? ' selected' : ''}`}
                        onClick={() => toggleGet(card.id)}
                      >
                        <input type="checkbox" readOnly checked={getSelected.has(card.id)} />
                        <span className="trade-num">#{card.number}</span>
                        <span className="trade-name">{card.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="proposal-send-bar">
              {proposalMsg && (
                <span className={`proposal-msg ${proposalMsg.type}`}>{proposalMsg.text}</span>
              )}
              {alreadySent && !proposalMsg ? (
                <span className="proposal-msg info">You already have a pending proposal with this person.</span>
              ) : null}
              <button
                className="btn btn-primary"
                onClick={sendProposal}
                disabled={sendingProposal || (!giveSelected.size && !getSelected.size) || alreadySent}
              >
                {sendingProposal ? 'Sending…' : `Send Proposal (${giveSelected.size + getSelected.size} cards)`}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Overview ──────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* Incoming proposals */}
      {pendingInbox.length > 0 && (
        <div className="proposals-section">
          <h3 className="proposals-title">
            Incoming Proposals
            <span className="inbox-badge">{pendingInbox.length}</span>
          </h3>
          {pendingInbox.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="proposal-header">
                <span className="proposal-from">{p.from_username} wants to trade with you</span>
                <span className="proposal-counts">
                  <span className="get-num">{p.items.filter(i => i.direction === 'give').length} for you</span>
                  <span className="sep">·</span>
                  <span className="give-num">{p.items.filter(i => i.direction === 'get').length} from you</span>
                </span>
              </div>

              {expandedProposal === p.id && (
                <div className="proposal-items">
                  <div className="proposal-items-col">
                    <div className="proposal-items-label get">You receive:</div>
                    {p.items.filter(i => i.direction === 'give').map(item => (
                      <div key={item.card_id} className="proposal-item-row">
                        <span className="trade-num">#{item.number}</span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="proposal-items-col">
                    <div className="proposal-items-label give">You give:</div>
                    {p.items.filter(i => i.direction === 'get').map(item => (
                      <div key={item.card_id} className="proposal-item-row">
                        <span className="trade-num">#{item.number}</span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="proposal-actions">
                <button className="btn btn-sm btn-ghost" onClick={() =>
                  setExpandedProposal(expandedProposal === p.id ? null : p.id)
                }>
                  {expandedProposal === p.id ? 'Hide cards' : 'View cards'}
                </button>
                <button className="btn btn-sm btn-accept" onClick={() => handleAccept(p.id)}>Accept</button>
                <button className="btn btn-sm btn-reject" onClick={() => handleReject(p.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent proposals */}
      {pendingSent.length > 0 && (
        <div className="proposals-section">
          <h3 className="proposals-title">Sent Proposals</h3>
          {pendingSent.map(p => (
            <div key={p.id} className="proposal-card proposal-sent">
              <div className="proposal-header">
                <span className="proposal-from">Waiting on {p.to_username}</span>
                <span className="proposal-counts">
                  <span className="give-num">{p.items.filter(i => i.direction === 'give').length} you give</span>
                  <span className="sep">·</span>
                  <span className="get-num">{p.items.filter(i => i.direction === 'get').length} you get</span>
                </span>
              </div>
              <div className="proposal-actions">
                <button className="btn btn-sm btn-ghost btn-reject" onClick={() => handleCancel(p.id)}>
                  Cancel proposal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trade partners */}
      <h2>Find Trade Partners</h2>
      <p className="page-sub">Click a person to select cards and send a trade proposal.</p>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : overview.length === 0 ? (
        <div className="empty-state">
          <p>No other collectors registered yet.</p>
          <p>Share the app URL with your friends to start trading!</p>
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
