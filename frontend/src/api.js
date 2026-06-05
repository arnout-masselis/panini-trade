const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

function authHeaders() {
  const stored = localStorage.getItem('panini_auth');
  const token = stored ? JSON.parse(stored).token : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  getCards: () => request('GET', '/cards'),
  getMyCards: () => request('GET', '/cards/my'),
  updateCard: (cardId, quantity) => request('PUT', `/cards/my/${cardId}`, { quantity }),
  deleteCard: (cardId) => request('DELETE', `/cards/my/${cardId}`),
  getTradeOverview: () => request('GET', '/trades/overview'),
  getTradeMatch: (userId) => request('GET', `/trades/match/${userId}`),
  getProposalCount: () => request('GET', '/proposals/count'),
  getProposals: () => request('GET', '/proposals'),
  sendProposal: (toUserId, giveCardIds, getCardIds) =>
    request('POST', '/proposals', { toUserId, giveCardIds, getCardIds }),
  acceptProposal: (id) => request('PUT', `/proposals/${id}/accept`),
  rejectProposal: (id) => request('PUT', `/proposals/${id}/reject`),
  cancelProposal: (id) => request('DELETE', `/proposals/${id}`),
  markTraded: (id, autoUpdate) => request('PUT', `/proposals/${id}/traded`, { autoUpdate }),
  getMessages: (id) => request('GET', `/proposals/${id}/messages`),
  sendMessage: (id, message) => request('POST', `/proposals/${id}/messages`, { message }),
};
