import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Collection from './pages/Collection.jsx';
import Trades from './pages/Trades.jsx';

function ProtectedRoute({ children }) {
  const { auth } = useAuth();
  return auth ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { auth } = useAuth();
  return (
    <>
      {auth && <Navbar />}
      <Routes>
        <Route path="/login" element={auth ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={auth ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><Collection /></ProtectedRoute>} />
        <Route path="/trades" element={<ProtectedRoute><Trades /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
