import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Navbar() {
  const { auth, logout } = useAuth();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!auth) return;
    api.getProposalCount()
      .then(({ pending }) => setPendingCount(pending))
      .catch(() => {});

    const interval = setInterval(() => {
      api.getProposalCount()
        .then(({ pending }) => setPendingCount(pending))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [auth, pathname]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">Panini WC 2026</div>
      <div className="navbar-links">
        <Link className={`nav-link${pathname === '/' ? ' active' : ''}`} to="/">
          My Collection
        </Link>
        <Link className={`nav-link${pathname === '/trades' ? ' active' : ''}`} to="/trades">
          Find Trades
          {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </Link>
      </div>
      <div className="navbar-user">
        <span className="navbar-username">{auth?.username}</span>
        <button className="btn btn-sm btn-ghost" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
