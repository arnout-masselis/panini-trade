import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

// ── Helpers ────────────────────────────────────────────────────────
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const map = {
    pending: ['badge-pending', 'Pending'],
    accepted: ['badge-accepted', 'Accepted ✓'],
    completed: ['badge-completed', 'Completed ✓✓'],
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

// ── Proposal detail (chat + mark traded) ──────────────────────────
function ProposalView({ proposal, myId, onBack, onRefresh }) {
  const isFromUser = proposal.from_user_id === myId;
  const otherName = isFromUser ? proposal.to_username : proposal.from_username;

  const myMarked = isFromUser ? proposal.from_marked_traded : proposal.to_marked_traded;
  const theirMarked = isFromUser ? proposal.to_marked_traded : proposal.from_marked_traded;

  const giveItems = proposal.items.filter(i => i.direction === 'give');
  const getItems = proposal.items.filter(i => i.direction === 'get');

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const chatEndRef = useRef(null);

  const loadMessages = useCallback(() => {
    api.getMessages(proposal.id).then(msgs => {
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }).catch(() => {});
  }, [proposal.id]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sending) return;
    setSending(true);
    try {
      await api.sendMessage(proposal.id, chatInput.trim());
      setChatInput('');
      loadMessages();
    } finally {
      setSending(false);
    }
  };

  const markTraded = async (autoUpdate) => {
    setMarking(true);
    try {
      await api.markTraded(proposal.id, autoUpdate);
      onRefresh();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="page">
      <button className="btn btn-ghost back-btn" onClick={onBack}>← Back</button>

      <div className="proposal-view-header">
        <h2>Trade with <span className="highlight">{otherName}</span></h2>
        <StatusBadge status={proposal.status} />
      </div>

      {/* Cards overview */}
      <div className="trade-cols" style={{ marginBottom: 24 }}>
        <div className="trade-col">
          <h3 className="trade-col-header give">
            You give <span className="count-badge">{giveItems.length}</span>
          </h3>
          {giveItems.length === 0 ? <p className="empty-msg">None</p> : (
            <ul className="trade-list">
              {giveItems.map(item => (
                <li key={item.card_id} className="trade-row">
                  <span className="trade-num">#{item.number}</span>
                  <span className="trade-name">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="trade-col">
          <h3 className="trade-col-header get">
            You get <span className="count-badge">{getItems.length}</span>
          </h3>
          {getItems.length === 0 ? <p className="empty-msg">None</p> : (
            <ul className="trade-list">
              {getItems.map(item => (
                <li key={item.card_id} className="trade-row">
                  <span className="trade-num">#{item.number}</span>
                  <span className="trade-name">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Accept/Reject for pending inbox */}
      {proposal.status === 'pending' && !isFromUser && (
        <div className="proposal-send-bar" style={{ marginBottom: 24 }}>
          <button className="btn btn-accept" onClick={async () => {
            await api.acceptProposal(proposal.id);
            onRefresh();
          }}>Accept Trade</button>
          <button className="btn btn-reject" onClick={async () => {
            await api.rejectProposal(proposal.id);
            onBack();
          }}>Reject</button>
        </div>
      )}

      {/* Mark as traded (accepted only) */}
      {proposal.status === 'accepted' && (
        <div className="mark-traded-box">
          <h3 className="mark-traded-title">Did the exchange happen?</h3>
          {proposal.status === 'completed' ? (
            <p className="traded-done">Trade completed!</p>
          ) : (
            <>
              <div className="traded-status">
                <span className={myMarked ? 'traded-yes' : 'traded-no'}>
                  {myMarked ? '✓ You confirmed' : '○ You haven\'t confirmed yet'}
                </span>
                <span className={theirMarked ? 'traded-yes' : 'traded-no'}>
                  {theirMarked ? `✓ ${otherName} confirmed` : `○ ${otherName} hasn't confirmed yet`}
                </span>
              </div>
              {!myMarked && (
                <div className="mark-traded-actions">
                  <p className="mark-traded-hint">Choose how to update your collection:</p>
                  <button
                    className="btn btn-accept"
                    disabled={marking}
                    onClick={() => markTraded(true)}
                  >
                    Auto-update my collection
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={marking}
                    onClick={() => markTraded(false)}
                  >
                    I'll update it manually
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="chat-box">
        <h3 className="chat-title">Chat with {otherName}</h3>
        <div className="chat-messages">
          {messages.length === 0 && (
            <p className="chat-empty">No messages yet. Arrange where and when to meet!</p>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`chat-msg ${msg.from_user_id === myId ? 'chat-mine' : 'chat-theirs'}`}
            >
              <span className="chat-bubble">{msg.message}</span>
              <span className="chat-meta">{msg.from_user_id !== myId && <b>{msg.from_username} · </b>}{fmtTime(msg.created_at)}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form className="chat-input-row" onSubmit={sendMsg}>
          <input
            className="chat-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type a message…"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !chatInput.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function Trades() {
  const { auth } = useAuth();
  const myId = auth?.userId;

  const [view, setView] = useState('overview');
  const [overview, setOverview] = useState([]);
  const [proposals, setProposals] = useState({ inbox: [], sent: [] });
  const [loading, setLoading] = useState(true);

  // Trade detail (card selection)
  const [selectedUser, setSelectedUser] = useState(null);
  const [tradeMatch, setTradeMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [giveSelected, setGiveSelected] = useState(new Set());
  const [getSelected, setGetSelected] = useState(new Set());
  const [sendingProposal, setSendingProposal] = useState(false);
  const [proposalMsg, setProposalMsg] = useState(null);

  // Proposal detail (chat)
  const [selectedProposal, setSelectedProposal] = useState(null);

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

  const openProposal = (proposal) => {
    setSelectedProposal(proposal);
    setView('proposal');
  };

  const refreshAndStay = useCallback(async () => {
    const props = await api.getProposals();
    setProposals(props);
    // Update the selected proposal with fresh data
    if (selectedProposal) {
      const fresh = [...props.inbox, ...props.sent].find(p => p.id === selectedProposal.id);
      if (fresh) setSelectedProposal(fresh);
    }
  }, [selectedProposal]);

  const viewMatch = async (user) => {
    setSelectedUser(user);
    setProposalMsg(null);
    setView('detail');
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

  const sendProposal = async () => {
    if (!giveSelected.size && !getSelected.size) return;
    setSendingProposal(true);
    try {
      await api.sendProposal(selectedUser.id, [...giveSelected], [...getSelected]);
      setProposalMsg({ type: 'success', text: `Proposal sent to ${selectedUser.username}!` });
      loadData();
    } catch (err) {
      setProposalMsg({ type: 'error', text: err.message });
    } finally {
      setSendingProposal(false);
    }
  };

  const backToOverview = () => {
    setView('overview');
    setSelectedUser(null);
    setTradeMatch(null);
    setSelectedProposal(null);
    setProposalMsg(null);
    loadData();
  };

  // ── Proposal detail view ──────────────────────────────────────────
  if (view === 'proposal' && selectedProposal) {
    return (
      <ProposalView
        proposal={selectedProposal}
        myId={myId}
        onBack={backToOverview}
        onRefresh={refreshAndStay}
      />
    );
  }

  // ── Trade detail / card selection view ───────────────────────────
  if (view === 'detail' && selectedUser) {
    const alreadySent = proposals.sent.some(
      p => p.to_user_id === selectedUser.id && p.status === 'pending'
    );

    return (
      <div className="page">
        <button className="btn btn-ghost back-btn" onClick={backToOverview}>← Back</button>
        {matchLoading ? <div className="loading">Loading…</div> : tradeMatch && (
          <>
            <h2>Trade with <span className="highlight">{tradeMatch.user.username}</span></h2>
            <p className="trade-hint">Select the cards you want to include, then send a proposal.</p>

            <div className="trade-cols">
              <div className="trade-col">
                <h3 className="trade-col-header give">
                  You give <span className="count-badge">{giveSelected.size}/{tradeMatch.iCanGive.length}</span>
                </h3>
                {tradeMatch.iCanGive.length === 0 ? <p className="empty-msg">No cards to give</p> : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGive.map(card => (
                      <li
                        key={card.id}
                        className={`trade-row selectable${giveSelected.has(card.id) ? ' selected' : ''}`}
                        onClick={() => setGiveSelected(prev => {
                          const n = new Set(prev);
                          n.has(card.id) ? n.delete(card.id) : n.add(card.id);
                          return n;
                        })}
                      >
                        <input type="checkbox" readOnly checked={giveSelected.has(card.id)} />
                        <span className="trade-num">#{card.number}</span>
                        <span className="trade-name">{card.name}</span>
                        {card.my_quantity > 2 && <span className="avail-badge">×{card.my_quantity - 1}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="trade-col">
                <h3 className="trade-col-header get">
                  You get <span className="count-badge">{getSelected.size}/{tradeMatch.iCanGet.length}</span>
                </h3>
                {tradeMatch.iCanGet.length === 0 ? <p className="empty-msg">No cards to receive</p> : (
                  <ul className="trade-list">
                    {tradeMatch.iCanGet.map(card => (
                      <li
                        key={card.id}
                        className={`trade-row selectable${getSelected.has(card.id) ? ' selected' : ''}`}
                        onClick={() => setGetSelected(prev => {
                          const n = new Set(prev);
                          n.has(card.id) ? n.delete(card.id) : n.add(card.id);
                          return n;
                        })}
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
              {alreadySent && !proposalMsg && (
                <span className="proposal-msg info">You already have a pending proposal with this person.</span>
              )}
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
  const allActive = [...proposals.inbox, ...proposals.sent].filter(
    p => p.status === 'pending' || p.status === 'accepted'
  );
  const inboxActive = proposals.inbox.filter(p => p.status === 'pending' || p.status === 'accepted');
  const sentActive = proposals.sent.filter(p => p.status === 'pending' || p.status === 'accepted');

  return (
    <div className="page">
      {inboxActive.length > 0 && (
        <div className="proposals-section">
          <h3 className="proposals-title">
            Incoming Proposals
            <span className="inbox-badge">{inboxActive.filter(p => p.status === 'pending').length || undefined}</span>
          </h3>
          {inboxActive.map(p => (
            <div key={p.id} className="proposal-card" onClick={() => openProposal(p)} style={{ cursor: 'pointer' }}>
              <div className="proposal-header">
                <span className="proposal-from">{p.from_username}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="proposal-counts">
                    <span className="get-num">{p.items.filter(i => i.direction === 'give').length} for you</span>
                    <span className="sep">·</span>
                    <span className="give-num">{p.items.filter(i => i.direction === 'get').length} from you</span>
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <p className="proposal-cta">Click to view cards, chat, and respond →</p>
            </div>
          ))}
        </div>
      )}

      {sentActive.length > 0 && (
        <div className="proposals-section">
          <h3 className="proposals-title">Sent Proposals</h3>
          {sentActive.map(p => (
            <div key={p.id} className="proposal-card proposal-sent" onClick={() => openProposal(p)} style={{ cursor: 'pointer' }}>
              <div className="proposal-header">
                <span className="proposal-from">To {p.to_username}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="proposal-counts">
                    <span className="give-num">{p.items.filter(i => i.direction === 'give').length} you give</span>
                    <span className="sep">·</span>
                    <span className="get-num">{p.items.filter(i => i.direction === 'get').length} you get</span>
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <p className="proposal-cta">Click to chat →</p>
            </div>
          ))}
        </div>
      )}

      <h2>Find Trade Partners</h2>
      <p className="page-sub">Click a person to select cards and send a trade proposal.</p>

      {loading ? <div className="loading">Loading…</div> : overview.length === 0 ? (
        <div className="empty-state">
          <p>No other collectors yet.</p>
          <p>Share the app with your friends to start trading!</p>
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
              {user.canGive + user.canGet > 0
                ? <div className="match-score">{user.canGive + user.canGet} potential swaps</div>
                : <div className="no-match">No matches yet</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
