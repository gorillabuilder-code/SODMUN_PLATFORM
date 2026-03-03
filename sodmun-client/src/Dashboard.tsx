import React, { useEffect, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

// --- CLEAN SVG ICONS ---
const IconGlobe = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const IconLock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const IconFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;

export default function Dashboard() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [myBlocs, setMyBlocs] = useState<any[]>([]);
  const [blocResolutions, setBlocResolutions] = useState<any[]>([]);
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  const [activeDMs, setActiveDMs] = useState<any[]>([]);

  const [isBlocModal, setIsBlocModal] = useState(false);
  const [blocName, setBlocName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  useEffect(() => {
    if (authUser) {
      fetchDashboardData();
    }
  }, [authUser]);

  const fetchDashboardData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();

    if (userData) {
      setProfile(userData);

      // 1. Fetch Committee AND Direct Messages for the Intelligence Feed
      // We select role, delegation, and committee to build the full official title
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, users(role, delegation, committee)')
        .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`)
        .order('timestamp', { ascending: false })
        .limit(20);

      // 2. Fetch My Blocs
      const { data: blocs } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const filteredBlocs = blocs?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [];

      // 3. Fetch Resolutions for Blocs
      if (filteredBlocs.length > 0) {
        const blocIds = filteredBlocs.map(b => b.id);
        const { data: res } = await supabase.from('resolutions').select('*').in('bloc_id', blocIds);
        if (res) setBlocResolutions(res);
      }

      // 4. Fetch Peers (needed for DM resolving and creating blocs)
      const { data: peers } = await supabase.from('users').select('id, role, delegation, committee').eq('committee', userData.committee).neq('id', authUser?.id);

      // 5. Process DMs for the sidebar explicitly
      if (msgs && peers) {
        const dms = msgs.filter(m => m.recipient_group.startsWith('dm_'));
        const uniqueDMs: any[] = [];
        const seenRooms = new Set();

        dms.forEach(msg => {
          if (!seenRooms.has(msg.recipient_group)) {
            seenRooms.add(msg.recipient_group);
            const otherId = msg.recipient_group.replace('dm_', '').split('_').find((id: string) => id !== authUser?.id);
            const peer = peers.find(p => p.id === otherId);
            
            if (peer) {
              uniqueDMs.push({
                roomId: msg.recipient_group,
                peerData: peer,
                lastMessage: msg.content,
                isMe: msg.sender_id === authUser?.id
              });
            }
          }
        });
        setActiveDMs(uniqueDMs);
      }

      if (msgs) setAllChats(msgs);
      setMyBlocs(filteredBlocs);
      if (peers) setCommitteeUsers(peers);
    }
  };

  const handleCreateBloc = async () => {
    if (!blocName || selectedUsers.length === 0) return;
    const { data: bloc } = await supabase.from('blocs').insert([{ name: blocName, committee: profile?.committee }]).select().single();

    if (bloc) {
      await supabase.from('bloc_members').insert(
        [authUser?.id, ...selectedUsers].map(uid => ({ user_id: uid, bloc_id: bloc.id }))
      );
      setMyBlocs([...myBlocs, bloc]);
      setIsBlocModal(false);
      setBlocName('');
      setSelectedUsers([]);
    }
  };

  // Format the official title string
  const getOfficialTitle = (u: any) => {
    if (!u) return "System Override";
    return `${u.role || 'Delegate'} of ${u.delegation || 'Unknown'}, ${u.committee || ''}`;
  };

  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <h1 className="delegation-brand">{profile?.delegation || "..."}</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase' }}>
            {profile?.role} | {profile?.committee}
          </p>
          <button className="logout-btn" onClick={logout}>Disconnect</button>
        </div>
        <button className="primary-btn" onClick={() => setIsBlocModal(true)}>Form New Bloc</button>
      </div>

      <div className="main-grid">
        {/* Left: Intelligence Feed */}
        <div className="panel" style={{ height: 'fit-content' }}>
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconGlobe /> Live Intelligence
          </span>
          <div style={{ maxHeight: '700px', overflowY: 'auto', paddingRight: '10px' }}>
            {allChats.map(m => {
              const isDM = m.recipient_group.startsWith('dm_');
              const isIncomingDM = isDM && m.sender_id !== authUser?.id;

              return (
                <div 
                  key={m.id} 
                  className="chat-row" 
                  style={{ 
                    cursor: 'pointer', 
                    borderLeft: isDM ? '4px solid #fff' : '4px solid var(--accent)',
                    background: isIncomingDM ? 'rgba(255,255,255,0.05)' : 'var(--bg-input)'
                  }} 
                  onClick={() => navigate('/chat')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="u-name" style={{ color: isDM ? '#fff' : 'var(--accent)' }}>
                      {getOfficialTitle(m.users)}
                    </span>
                    {isDM && <span style={{ fontSize: '10px', fontWeight: 800, background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>DIRECT</span>}
                  </div>
                  
                  {/* The Greeting for Incoming DMs */}
                  {isIncomingDM && (
                    <p style={{ fontSize: '12px', color: '#888', fontStyle: 'italic', marginBottom: '4px', marginTop: '2px' }}>
                      Pinging your terminal directly...
                    </p>
                  )}
                  
                  <p className="u-text" style={{ color: isDM ? '#fff' : '#999' }}>{m.content}</p>
                </div>
              );
            })}
            {allChats.length === 0 && <p style={{ color: '#333', fontSize: '13px' }}>No intelligence broadcasts yet.</p>}
          </div>
        </div>

        {/* Right: Bento Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div className="panel">
            <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconLock /> Secure Alliances
            </span>
            <div style={{ display: 'grid', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '10px' }}>
              {myBlocs.map(b => (
                <div key={b.id} className="bloc-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/chat')}>
                  <div className="bloc-dot" />
                  <span>{b.name}</span>
                </div>
              ))}
              {myBlocs.length === 0 && <p style={{ color: '#333', fontSize: '13px' }}>No active alliances.</p>}
            </div>
          </div>


          <div className="panel">
            <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconFile /> Alliance Resolutions
            </span>
            <div style={{ display: 'grid', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '10px' }}>
              {blocResolutions.map(r => (
                <div key={r.id} className="bloc-card" style={{ cursor: 'pointer', border: '1px solid #222', gap: '12px' }} onClick={() => navigate('/resolutions')}>
                  <IconFile />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{r.title}</span>
                </div>
              ))}
              {blocResolutions.length === 0 && <p style={{ color: '#333', fontSize: '13px' }}>No shared drafts found.</p>}
            </div>
          </div>

        </div>
      </div>

      {/* Bloc Creation Modal */}
      {isBlocModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '20px', fontWeight: 800 }}>Establish Alliance</h2>
            <input 
              className="dark-input" 
              style={{ width: '100%', marginBottom: '20px', minHeight: '56px' }} 
              placeholder="Alliance Name" 
              value={blocName} 
              onChange={e => setBlocName(e.target.value)} 
            />
            <p style={{fontSize: '11px', fontWeight: 700, color: '#444', marginBottom: '10px', textTransform: 'uppercase'}}>Add Delegates</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #222', padding: '10px', borderRadius: '16px', marginBottom: '20px', background: '#000' }}>
              {committeeUsers.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} 
                  style={{ 
                    padding: '12px', 
                    cursor: 'pointer', 
                    borderRadius: '12px',
                    background: selectedUsers.includes(u.id) ? 'var(--accent)' : 'transparent', 
                    color: selectedUsers.includes(u.id) ? '#000' : '#fff',
                    marginBottom: '4px',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}
                >
                  {getOfficialTitle(u)}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" style={{ flex: 1, minHeight: '56px' }} onClick={handleCreateBloc}>Initialize</button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0, minHeight: '56px' }} onClick={() => setIsBlocModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}