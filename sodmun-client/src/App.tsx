import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from './api';
import Login from './Login';
import Dashboard from './Dashboard';
import Chat from './Chat';
import Resolutions from './Resolutions';
import SoddyBot from './SoddyBot';
import Schedule from './Schedule';
import Scoring from './Scoring';
import Loader from './Loader'; // Ensure this file exists
import logo from './assets/logo.png';

// --- CLEAN SVG ICONS ---
const IconDash = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>;
const IconChat = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconDocs = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconBot = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>;
const IconCal = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
const IconCommand = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>;

// --- FULL SCREEN LOADER ---
const LoadingScreen = ({ label }: { label: string }) => (
  <div style={{
    height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#000',
    position: 'fixed', top: 0, left: 0, zIndex: 9999
  }}>
    <Loader />
    <div style={{ 
      marginTop: '20px', color: '#FF8C00', fontWeight: 900, 
      letterSpacing: '3px', textTransform: 'uppercase', fontSize: '12px' 
    }}>
      {label}...
    </div>
  </div>
);

// --- NAV ITEM COMPONENT ---
const NavItem = ({ to, icon, label, isChairLink = false }: { to: string, icon: React.ReactNode, label: string, isChairLink?: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${isActive ? 'active' : ''} ${isChairLink ? 'chair-link' : ''}`}>
      <span className="nav-icon">{icon}</span>
      {label}
    </Link>
  );
};

// --- ROUTE GUARDS ---
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen label="Authenticating" />;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const ChairRoute = ({ children, role, roleLoading }: { children: React.ReactNode, role: string | null, roleLoading: boolean }) => {
  if (roleLoading) return <LoadingScreen label="Verifying Clearance" />;
  const isStaff = role !== 'Delegate' && role !== null;
  return isStaff ? <>{children}</> : <Navigate to="/" />;
};

const AppShell = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (user) {
      supabase.from('users').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          setRole(data?.role || 'Delegate');
          setRoleLoading(false);
        });
    } else {
      setRole(null);
      setRoleLoading(false);
    }
  }, [user]);

  const showCommandCenter = role !== 'Delegate' && role !== null;

  return (
    <div className="app-container">
      <style>{`
        .app-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #000; }
        .sidebar { width: 260px; background: #0a0a0a; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; padding: 30px 20px; z-index: 100; }
        .sidebar-logo-container { display: flex; align-items: center; gap: 15px; margin-bottom: 40px; padding: 0 10px; }
        .sidebar-logo { height: 55px; }
        .nav-menu { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .nav-link { display: flex; align-items: center; gap: 15px; padding: 14px 16px; color: #888; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 12px; transition: 0.2s; border: 1px solid transparent; }
        .nav-icon { display: flex; align-items: center; justify-content: center; color: inherit; }
        .nav-link:hover { color: #fff; background: #111; }
        .nav-link.active { background: rgba(255,140,0,0.1); color: #FF8C00; border-color: rgba(255,140,0,0.2); }
        .chair-link { margin-top: 20px; color: #FF8C00; border: 1px dashed rgba(255,140,0,0.3); }
        .chair-link:hover { background: #FF8C00; color: #000; border-style: solid; }
        .chair-link.active { background: #FF8C00; color: #000; box-shadow: 0 0 15px rgba(255,140,0,0.3); }
        .main-content { flex: 1; height: 100vh; overflow-y: auto; background: #000; position: relative; }
      `}</style>

      {user && (
        <aside className="sidebar">
          <div className="sidebar-logo-container">
            <img src={logo} alt="SODMUN" className="sidebar-logo" />
          </div>
          <nav className="nav-menu">
            <NavItem to="/" icon={<IconDash />} label="Dashboard" />
            <NavItem to="/chat" icon={<IconChat />} label="Communications" />
            <NavItem to="/resolutions" icon={<IconDocs />} label="Resolutions" />
            <NavItem to="/soddy" icon={<IconBot />} label="Soddy AI" />
            <NavItem to="/schedule" icon={<IconCal />} label="Schedule" />
            
            {showCommandCenter && (
              <>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#FF8C00', textTransform: 'uppercase', marginTop: '30px', marginBottom: '5px', paddingLeft: '10px' }}>
                  Chair Access
                </span>
                <NavItem to="/scoring" icon={<IconCommand />} label="Scoring Sheet" isChairLink={true} />
              </>
            )}
          </nav>
        </aside>
      )}

      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/resolutions" element={<ProtectedRoute><Resolutions /></ProtectedRoute>} />
          <Route path="/soddy" element={<ProtectedRoute><SoddyBot /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/scoring" element={
            <ProtectedRoute>
              <ChairRoute role={role} roleLoading={roleLoading}>
                <Scoring />
              </ChairRoute>
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  );
}