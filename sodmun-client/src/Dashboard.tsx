import React, { useEffect, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const IconGlobe = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const IconLock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const IconFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;

export default function Dashboard() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [blocs, setBlocs] = useState<any[]>([]);
  const [resolutions, setResolutions] = useState<any[]>([]);
  const [eligibleDelegates, setEligibleDelegates] = useState<any[]>([]);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;

  useEffect(() => {
    if (authUser) fetchDashboardData();
  }, [authUser]);

  const fetchDashboardData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;

    setProfile(userData);

    // --- LOOPHOLE FIX 1: THE INTELLIGENCE FEED ---
    // Rule: Everyone sees Global Committee. Everyone sees DMs ONLY if they are a participant.
    // Logic:recipient_group matches committee OR contains my ID.
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, users!inner(role, delegation, committee)')
      .eq('users.committee', userData.committee) // Strictly isolate by committee
      .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`)
      .order('timestamp', { ascending: false })
      .limit(30);
    
    if (msgs) setAllChats(msgs);

    // --- LOOPHOLE FIX 2: BLOC OVERSIGHT ---
    // Rule: Chairs see all Blocs in THEIR committee. Delegates see only Blocs they JOINED.
    let blocData;
    if (userData.role !== 'Delegate') {
      const { data } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      blocData = data || [];
    } else {
      const { data: memberOf } = await supabase
        .from('bloc_members')
        .select('bloc_id, blocs(*)')
        .eq('user_id', authUser?.id);
      
      // Filter the joined blocs to ensure they belong to this committee
      blocData = memberOf?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [];
    }
    setBlocs(blocData);

    // --- LOOPHOLE FIX 3: RESOLUTION SECURITY ---
    // Rule: Chairs see every draft in committee. Delegates see only their Bloc's drafts.
    if (blocData.length > 0) {
      const { data: res } = await supabase
        .from('resolutions')
        .select('*, blocs!inner(committee)')
        .eq('blocs.committee', userData.committee) // Force committee match
        .in('bloc_id', blocData.map(b => b.id));
      
      if (res) setResolutions(res);
    }

    // --- LOOPHOLE FIX 4: DELEGATE LIST ---
    // Strictly filter out any non-delegate roles from the "Form Bloc" selection
    const { data: delegatesOnly } = await supabase
      .from('users')
      .select('id, delegation')
      .eq('committee', userData.committee)
      .eq('role', 'Delegate')
      .neq('id', authUser?.id);
    
    if (delegatesOnly) setEligibleDelegates(delegatesOnly);
  };

  const getOfficialTitle = (u: any) => {
    if (!u) return "System";
    return u.role === 'Delegate' ? u.delegation : `${u.role} of ${u.committee}`;
  };

  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <h1 className="delegation-brand">{profile?.delegation || profile?.role}</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', fontSize: '12px' }}>
            {profile?.role} | {profile?.committee}
          </p>
          <button className="logout-btn" onClick={logout}>Disconnect</button>
        </div>
        {!isChair && (
            <button className="primary-btn" onClick={() => navigate('/chat')}>New Bloc</button>
        )}
      </div>

      <div className="main-grid">
        <div className="panel" style={{ height: 'fit-content' }}>
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconGlobe /> Intelligence Feed
          </span>
          <div style={{ maxHeight: '700px', overflowY: 'auto' }}>
            {allChats.map(m => {
              const isDM = m.recipient_group.startsWith('dm_');
              return (
                <div key={m.id} className="chat-row" style={{ borderLeft: isDM ? '4px solid #fff' : '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="u-name" style={{ color: isDM ? '#fff' : 'var(--accent)' }}>{getOfficialTitle(m.users)}</span>
                    {isDM && <span style={{ fontSize: '10px', fontWeight: 900, background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>DM</span>}
                  </div>
                  <p className="u-text" style={{ color: isDM ? '#ccc' : '#999', marginTop: '5px' }}>{m.content}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="panel">
            <span className="label"><IconLock /> {isChair ? 'Committee Alliances' : 'My Alliances'}</span>
            <div style={{ display: 'grid', gap: '10px' }}>
              {blocs.map(b => (
                <div key={b.id} className="bloc-card" onClick={() => navigate('/chat')}>
                  <div className="bloc-dot" />
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <span className="label"><IconFile /> {isChair ? 'Committee Drafts' : 'My Resolutions'}</span>
            <div style={{ display: 'grid', gap: '10px' }}>
              {resolutions.map(r => (
                <div key={r.id} className="bloc-card" style={{ border: '1px solid #222' }} onClick={() => navigate('/resolutions')}>
                  <IconFile />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}