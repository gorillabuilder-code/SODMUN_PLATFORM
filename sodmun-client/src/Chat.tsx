import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

// --- ICONS ---
const IconGlobe = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const IconLock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

export default function Chat() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isChair, setIsChair] = useState(false);
  const [channels, setChannels] = useState<{ blocs: any[], dms: any[] }>({ blocs: [], dms: [] });
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<string>(''); 
  const [activeRoomName, setActiveRoomName] = useState<string>('Global Committee');
  
  const [isBlocModal, setIsBlocModal] = useState(false);
  const [isDMModal, setIsDMModal] = useState(false);
  const [newBlocName, setNewBlocName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef(activeRoom); 

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // Initial Load
  useEffect(() => {
    if (authUser) initializeChat();
  }, [authUser]);

  const initializeChat = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);
    setIsChair(userData.role !== 'Delegate');
    setActiveRoom(userData.committee); // Only set this once on login
    refreshSidebar(userData);
  };

  // Separate Refresh Logic (Prevents room resets)
  const refreshSidebar = async (userData = profile) => {
    if (!userData) return;
    const { data: peers } = await supabase.from('users').select('*').eq('committee', userData.committee);
    if (peers) setCommitteeUsers(peers);

    if (userData.role !== 'Delegate') {
      const { data: allBlocs } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      const { data: dmRooms } = await supabase.from('messages').select('recipient_group').ilike('recipient_group', 'dm_%');
      const uniqueDMs = Array.from(new Set(dmRooms?.map(m => m.recipient_group)));
      const mappedDMs = uniqueDMs.map(roomId => {
        const ids = roomId.replace('dm_', '').split('_');
        return { roomId, name: ids.map(id => {
            const u = peers?.find(p => p.id === id);
            return u ? (u.delegation || `${u.role}-${u.committee}`) : (id === authUser?.id ? 'You' : 'Unknown');
        }).join(' ↔ ') };
      });
      setChannels({ blocs: allBlocs || [], dms: mappedDMs });
    } else {
      const { data: blocs } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const { data: myDMs } = await supabase.from('messages').select('recipient_group').ilike('recipient_group', `%${authUser?.id}%`).filter('recipient_group', 'ilike', 'dm_%');
      const uniqueDMs = Array.from(new Set(myDMs?.map(m => m.recipient_group)));
      const mappedDMs = uniqueDMs.map(roomId => {
        const otherId = roomId.replace('dm_', '').split('_').find(id => id !== authUser?.id);
        const peer = peers?.find(p => p.id === otherId);
        return { roomId, name: peer ? (peer.delegation || `${peer.role}-${peer.committee}`) : 'Direct Signal' };
      });
      setChannels({ blocs: blocs?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [], dms: mappedDMs });
    }
  };

  useEffect(() => {
    if (!activeRoom) return;
    fetchMessages(activeRoom);
  }, [activeRoom]);

  const fetchMessages = async (id: string) => {
    const { data } = await supabase.from('messages').select('*, users(*)').eq('recipient_group', id).order('timestamp', { ascending: true });
    if (data) { setMessages(data); scrollToBottom(); }
  };

  useEffect(() => {
    const channel = supabase.channel('chat_v2').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
      // Only append to screen if it's the room we are in
      if (payload.new.recipient_group === activeRoomRef.current) {
        const { data: sender } = await supabase.from('users').select('*').eq('id', payload.new.sender_id).single();
        setMessages(prev => [...prev, { ...payload.new, users: sender }]);
        scrollToBottom();
      }
      // Silently refresh sidebar if a new DM starts elsewhere
      if (payload.new.recipient_group.startsWith('dm_')) {
          refreshSidebar();
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const scrollToBottom = () => { setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom) return;
    const content = input; setInput(''); 
    await supabase.from('messages').insert([{ sender_id: authUser?.id, content, recipient_group: activeRoom }]);
  };

  const startDM = (peer: any) => {
    const roomId = `dm_${[authUser?.id, peer.id].sort().join('_')}`;
    const roomName = peer.delegation || `${peer.role}-${peer.committee}`;
    switchRoom(roomId, roomName);
    setIsDMModal(false);
  };

  const handleCreateBloc = async () => {
    if (!newBlocName.trim() || selectedUsers.length === 0) return;
    const { data: bloc } = await supabase.from('blocs').insert([{ name: newBlocName, committee: profile?.committee }]).select().single();
    if (bloc) {
      await supabase.from('bloc_members').insert([authUser?.id, ...selectedUsers].map(uid => ({ user_id: uid, bloc_id: bloc.id })));
      refreshSidebar(); 
      setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]);
      switchRoom(`bloc_${bloc.id}`, bloc.name);
    }
  };

  const switchRoom = (id: string, name: string) => { setActiveRoom(id); setActiveRoomName(name); setMessages([]); };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '40px' }}>
      <style>{`
        .chat-layout { display: flex; flex: 1; background: #080808; border: 1px solid #1a1a1a; border-radius: 24px; overflow: hidden; }
        .chat-sidebar { width: 340px; background: #0d0d0d; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; padding: 30px 20px; }
        .chat-main { flex: 1; display: flex; flex-direction: column; background: #050505; }
        .channel-btn { padding: 12px 16px; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 700; transition: 0.2s; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .channel-btn.active { background: var(--accent); color: #000; }
        .channel-btn.inactive { background: transparent; color: #888; }
        .channel-btn.inactive:hover { background: #111; color: #fff; }
        .chat-bubble-wrap { display: flex; flex-direction: column; margin-bottom: 20px; max-width: 75%; }
        .chat-bubble-wrap.me { align-self: flex-end; align-items: flex-end; }
        .chat-bubble-wrap.them { align-self: flex-start; align-items: flex-start; }
        .chat-sender { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; color: #555; }
        .chat-bubble { padding: 12px 18px; border-radius: 16px; font-size: 15px; line-height: 1.4; }
        .me .chat-bubble { background: var(--accent); color: #000; border-bottom-right-radius: 2px; }
        .them .chat-bubble { background: #181818; color: #fff; border-bottom-left-radius: 2px; border: 1px solid #222; }
        .chat-input-area { padding: 20px 30px; background: #0d0d0d; border-top: 1px solid #1a1a1a; display: flex; gap: 12px; }
        .chat-input { flex: 1; background: #000; border: 1px solid #222; color: #fff; padding: 15px; border-radius: 12px; outline: none; font-family: 'Nunito', sans-serif; }
        .chat-send-btn { background: var(--accent); border: none; padding: 0 20px; border-radius: 12px; cursor: pointer; font-weight: 900; }
        .plus-btn { background: #111; border: 1px solid #222; color: var(--accent); width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <div className="top-bar" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="delegation-brand">COMMUNICATIONS</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>{profile?.committee} NETWORK</p>
        </div>
      </div>

      <div className="chat-layout">
        <div className="chat-sidebar">
          <span className="label">Public</span>
          <div className={`channel-btn ${activeRoom === profile?.committee ? 'active' : 'inactive'}`} onClick={() => switchRoom(profile?.committee, 'Global Committee')}>
            <IconGlobe /> Global Committee
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
            <span className="label" style={{ margin: 0 }}>Bloc Alliances</span>
            <button className="plus-btn" onClick={() => setIsBlocModal(true)}><IconPlus /></button>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {channels.blocs.map(b => (
              <div key={b.id} className={`channel-btn ${activeRoom === `bloc_${b.id}` ? 'active' : 'inactive'}`} onClick={() => switchRoom(`bloc_${b.id}`, b.name)}>
                <IconLock /> {b.name}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
            <span className="label" style={{ margin: 0 }}>Direct Messages</span>
            <button className="plus-btn" onClick={() => setIsDMModal(true)}><IconPlus /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {channels.dms.map(dm => (
              <div key={dm.roomId} title={dm.name} className={`channel-btn ${activeRoom === dm.roomId ? 'active' : 'inactive'}`} onClick={() => switchRoom(dm.roomId, dm.name)}>
                <IconMessage /> {dm.name}
              </div>
            ))}
          </div>
        </div>

        <div className="chat-main">
          <div style={{ padding: '20px 30px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>{activeRoomName}</h2>
          </div>
          <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble-wrap ${m.sender_id === authUser?.id ? 'me' : 'them'}`}>
                <span className="chat-sender">{m.users?.role} {m.users?.delegation || m.users?.committee}</span>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
          <form onSubmit={sendMessage} className="chat-input-area">
            <input className="chat-input" value={input} onChange={e => setInput(e.target.value)} placeholder={`Broadcast to ${activeRoomName}...`} />
            <button type="submit" className="chat-send-btn"><IconSend /></button>
          </form>
        </div>
      </div>

      {/* MODALS */}
      {isDMModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '15px' }}>Initialize Signal</h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #222', padding: '10px', borderRadius: '12px', background: '#000' }}>
              {committeeUsers.filter(u => u.id !== authUser?.id).map(u => (
                <div key={u.id} onClick={() => startDM(u)} 
                  style={{ padding: '12px', cursor: 'pointer', borderRadius: '8px', borderBottom: '1px solid #111', color: '#fff', fontWeight: 700, fontSize: '13px' }}>
                  <span style={{ color: u.role !== 'Delegate' ? 'var(--accent)' : '#fff' }}>{u.role.toUpperCase()}</span> — {u.delegation || u.committee}
                </div>
              ))}
            </div>
            <button className="logout-btn" style={{ width: '100%', marginTop: '15px' }} onClick={() => setIsDMModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isBlocModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '15px' }}>Establish Alliance</h2>
            <input className="dark-input" style={{ width: '100%', marginBottom: '15px' }} value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Alliance Name" />
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #222', padding: '10px', borderRadius: '12px', marginBottom: '15px' }}>
              {committeeUsers.filter(u => u.role === 'Delegate').map(u => (
                <div key={u.id} onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} 
                  style={{ padding: '10px', cursor: 'pointer', borderRadius: '8px', background: selectedUsers.includes(u.id) ? 'var(--accent)' : 'transparent', color: selectedUsers.includes(u.id) ? '#000' : '#fff', fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>
                  {u.delegation}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="primary-btn" style={{ flex: 1 }} onClick={handleCreateBloc}>Initialize</button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0 }} onClick={() => setIsBlocModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}