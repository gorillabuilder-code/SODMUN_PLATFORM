import React, { useState } from 'react';
import { supabase } from './api';
import logo from './assets/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <img src={logo} alt="SODMUN Logo" style={{ width: '150px', marginBottom: '20px' }} />
        <h2 style={{ marginBottom: '20px', color: 'var(--accent-orange)' }}>Delegate Portal</h2>
        
        {error && <div style={{ color: '#ff4444', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
          <button type="submit" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  backgroundColor: 'var(--bg-dark)'
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  padding: '40px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  width: '100%',
  maxWidth: '400px',
  textAlign: 'center'
};

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-dark)',
  color: 'var(--text-main)',
  fontFamily: 'Nunito, sans-serif'
};