import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ messages: 0, blocs: 0, resolutions: 0 });

  useEffect(() => {
    if (!user) return;

    const fetchOverview = async () => {
      // Get recent messages count for committee
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_group', user.committee);

      // Get blocs count (Chairs see all in committee, Delegates see their own)
      let blocCount = 0;
      if (user.role === 'Chair') {
        const { count } = await supabase.from('blocs').select('*', { count: 'exact', head: true }).eq('committee', user.committee);
        blocCount = count || 0;
      } else {
        const { count } = await supabase.from('bloc_members').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        blocCount = count || 0;
      }

      setStats({ messages: msgCount || 0, blocs: blocCount, resolutions: 0 }); // Resolutions placeholder for now
    };

    fetchOverview();
  }, [user]);

  if (!user) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>Welcome, <span style={{ color: 'var(--accent-orange)' }}>{user.email.split('@')[0]}</span></h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
        Status: {user.role} | Committee: {user.committee}
      </p>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <h3>Committee Activity</h3>
          <p style={numberStyle}>{stats.messages}</p>
          <p style={{ color: 'var(--text-muted)' }}>Messages logged</p>
        </div>
        <div style={cardStyle}>
          <h3>Active Blocs</h3>
          <p style={numberStyle}>{stats.blocs}</p>
          <p style={{ color: 'var(--text-muted)' }}>Blocs accessible</p>
        </div>
        <div style={cardStyle}>
          <h3>Resolutions</h3>
          <p style={numberStyle}>{stats.resolutions}</p>
          <p style={{ color: 'var(--text-muted)' }}>In progress</p>
        </div>
      </div>
    </div>
  );
}

// Styles
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '20px'
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-panel)',
  padding: '25px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  textAlign: 'center'
};

const numberStyle: React.CSSProperties = {
  fontSize: '48px',
  fontWeight: 'bold',
  color: 'var(--accent-orange)',
  margin: '10px 0'
};