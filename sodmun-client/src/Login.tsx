import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import logo from './assets/logo.png';
import munImg from './assets/mun.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // If user is already logged in, push them to dashboard immediately
  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="auth-container">
      {/* EMBEDDED PREMIUM CSS 
        Using position: fixed and inset: 0 guarantees absolutely zero scrolling or jitter.
      */}
      <style>{`
        .auth-container { 
          position: fixed; inset: 0; /* Locks to exact screen boundaries */
          display: flex; background-color: #000; 
          font-family: 'Nunito', sans-serif; z-index: 9999;
        }
        
        .auth-left { 
          flex: 1; display: flex; flex-direction: column; justify-content: center; 
          align-items: center; padding: 40px; background: #050505; 
          border-right: 1px solid #1a1a1a; box-sizing: border-box;
        }
        
        .auth-right { 
          flex: 1; position: relative; display: flex; align-items: center; 
          justify-content: center; background: #0a0a0a; padding: 40px; 
          box-sizing: border-box;
        }
        
        .auth-box { width: 100%; max-width: 420px; }
        
        .auth-logo { height: 65px; margin-bottom: 35px; }
        .auth-title { font-size: 36px; font-weight: 900; color: #fff; margin: 0 0 10px 0; letter-spacing: -1px; text-transform: uppercase; }
        .auth-subtitle { color: #888; font-size: 16px; margin-bottom: 40px; font-weight: 600; }
        
        .auth-input-group { display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px; }
        .auth-input { 
          width: 100%; min-height: 56px; background: #0d0d0d; border: 1px solid #222; color: #fff; 
          padding: 0 20px; border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 16px; 
          outline: none; transition: 0.2s; box-sizing: border-box;
        }
        .auth-input:focus { border-color: var(--accent); background: #111; }
        .auth-input::placeholder { color: #555; font-weight: 600; }
        
        .auth-btn { 
          width: 100%; min-height: 56px; background: var(--accent); color: #000; 
          border: none; border-radius: 16px; font-weight: 900; font-size: 16px; 
          text-transform: uppercase; cursor: pointer; transition: 0.2s; 
        }
        .auth-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255, 140, 0, 0.4); }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .auth-error { 
          color: #ff4d4d; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.3); 
          padding: 16px; border-radius: 12px; margin-bottom: 25px; font-weight: 700; font-size: 14px; 
        }

        .auth-image-wrapper { 
          width: 100%; height: 100%; border-radius: 24px; overflow: hidden; 
          position: relative; box-shadow: 0 30px 60px rgba(0,0,0,0.8); border: 1px solid #1a1a1a; 
        }
        .auth-image { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.8) contrast(1.1); }
        .auth-image-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(5,5,5,0.9) 100%); }
      `}</style>

      {/* Left Panel: Login Form */}
      <div className="auth-left">
        <div className="auth-box">
          <img src={logo} alt="SODMUN Logo" className="auth-logo" />
          <h1 className="auth-title">Login</h1>
          <p className="auth-subtitle">Access the SODMUN Live Intelligence Platform.</p>
          
          {error && <div className="auth-error">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="auth-input-group">
              <input 
                type="email" 
                placeholder="Delegation Email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="auth-input" 
                required 
              />
              <input 
                type="password" 
                placeholder="Passcode" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="auth-input" 
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="auth-btn">
              {loading ? 'Authenticating...' : 'Enter Platform'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Right Panel: Premium Image Display */}
      <div className="auth-right">
        <div className="auth-image-wrapper">
          <img src={munImg} alt="Model UN Environment" className="auth-image" />
          <div className="auth-image-overlay"></div>
        </div>
      </div>
    </div>
  );
}