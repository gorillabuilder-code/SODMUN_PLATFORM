import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Dashboard from './Dashboard';
import Chat from './Chat';
import Resolutions from './Resolutions';
import SoddyBot from './SoddyBot';
import Schedule from './Schedule';
import logo from './assets/logo.png';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ color: 'var(--accent-orange)', padding: '20px' }}>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AppShell = () => {
  const { user, logout } = useAuth();

  return (
    <Router>
      {user && (
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img src={logo} alt="SODMUN Logo" style={{ height: '40px' }} />
            <nav style={{ display: 'flex', gap: '15px' }}>
              <Link to="/" style={linkStyle}>Dashboard</Link>
              <Link to="/chat" style={linkStyle}>Chat</Link>
              <Link to="/resolutions" style={linkStyle}>Resolutions</Link>
              <Link to="/soddy" style={linkStyle}>Soddy (AI)</Link>
              <Link to="/schedule" style={linkStyle}>Schedule</Link>
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          </div>
        </header>
      )}

      <main style={mainStyle}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/resolutions" element={<ProtectedRoute><Resolutions /></ProtectedRoute>} />
          <Route path="/soddy" element={<ProtectedRoute><SoddyBot /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        </Routes>
      </main>
    </Router>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

// Inline styles for the shell to save space
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 20px',
  backgroundColor: 'var(--bg-panel)',
  borderBottom: '1px solid var(--border-color)'
};

const linkStyle: React.CSSProperties = {
  color: 'var(--text-main)',
  textDecoration: 'none',
  fontWeight: 600
};

const mainStyle: React.CSSProperties = {
  padding: '20px',
  height: 'calc(100vh - 65px)',
  overflowY: 'auto'
};