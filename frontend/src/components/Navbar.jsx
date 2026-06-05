import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Navbar() {
  const { auth, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span>Panini WC 2026</span>
      </div>
      <div className="navbar-links">
        <Link className={`nav-link${pathname === '/' ? ' active' : ''}`} to="/">
          My Collection
        </Link>
        <Link className={`nav-link${pathname === '/trades' ? ' active' : ''}`} to="/trades">
          Find Trades
        </Link>
      </div>
      <div className="navbar-user">
        <span className="navbar-username">{auth?.username}</span>
        <button className="btn btn-sm btn-ghost" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
