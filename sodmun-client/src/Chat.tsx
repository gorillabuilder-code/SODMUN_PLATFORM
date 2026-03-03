import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

// --- CLEAN SVG ICONS ---
const IconGlobe = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const IconLock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;

export default function Chat() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [myBlocs, setMyBlocs] = useState<any[]>([]);
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  
  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [activeRoom, setActiveRoom] = useState<string>(''); 
  const [activeRoomName, setActiveRoomName] = useState<string>('Global Committee');
  
  // Modal State
  const [isBlocModal, setIsBlocModal] = useState(false);
  const [newBlocName, setNewBlocName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef(activeRoom); 

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  useEffect(() => {
    if (authUser) fetchCoreData();
  }, [authUser]);

  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (userData) {
      setProfile(userData);
      setActiveRoom(userData.committee); 

      const { data: blocs } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const filteredBlocs = blocs?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [];
      setMyBlocs(filteredBlocs);

      const { data: peers } = await supabase.from('users').select('id, role, delegation, committee').eq('committee', userData.committee);
      if (peers) setCommitteeUsers(peers);
    }
  };

  useEffect(() => {
    if (!activeRoom) return;
    fetchMessages(activeRoom);
  }, [activeRoom]);

  const fetchMessages = async (roomIdentifier: string) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, users(role, delegation, committee)')
      .eq('recipient_group', roomIdentifier)
      .order('timestamp', { ascending: true })
      .limit(50);
    
    if (msgs) {
      setMessages(msgs);
      scrollToBottom();
    }
  };

  useEffect(() => {
    if (!activeRoom) return;
    
    const channel = supabase.channel('chat_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new;
        
        if (newMsg.recipient_group === activeRoomRef.current) {
          const { data: sender } = await supabase.from('users').select('role, delegation, committee').eq('id', newMsg.sender_id).single();
          const completeMsg = { ...newMsg, users: sender || { delegation: 'System' } };
          
          setMessages(prev => [...prev, completeMsg]);
          scrollToBottom();
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom) return;

    const msgContent = input;
    setInput(''); 

    await supabase.from('messages').insert([{ 
      sender_id: authUser?.id, 
      content: msgContent, 
      recipient_group: activeRoom 
    }]);
  };

  const handleCreateBloc = async () => {
    if (!newBlocName.trim() || selectedUsers.length === 0) return;
    const { data: bloc } = await supabase.from('blocs').insert([{ name: newBlocName, committee: profile?.committee }]).select().single();

    if (bloc) {
      await supabase.from('bloc_members').insert(
        [authUser?.id, ...selectedUsers].map(uid => ({ user_id: uid, bloc_id: bloc.id }))
      );
      setMyBlocs([...myBlocs, bloc]);
      setIsBlocModal(false);
      setNewBlocName('');
      setSelectedUsers([]);
      switchRoom(`bloc_${bloc.id}`, bloc.name);
    }
  };

  const switchRoom = (roomId: string, roomName: string) => {
    setActiveRoom(roomId);
    setActiveRoomName(roomName);
    setMessages([]); 
  };

  const getDMRoomId = (peerId: string) => {
    if (!authUser?.id) return '';
    const sortedIds = [authUser.id, peerId].sort();
    return `dm_${sortedIds[0]}_${sortedIds[1]}`;
  };

  // Format the official title string
  const getOfficialTitle = (u: any) => {
    if (!u) return "System Override";
    return `${u.role || 'Delegate'} of ${u.delegation || 'Unknown'}, ${u.committee || ''}`;
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '40px' }}>
      
      <style>{`
        .chat-layout { display: flex; flex: 1; background: #080808; border: 1px solid #1a1a1a; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .chat-sidebar { width: 340px; background: #0d0d0d; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; padding: 30px 20px; }
        .chat-main { flex: 1; display: flex; flex-direction: column; background: #050505; }
        
        .channel-btn { padding: 14px 16px; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 700; transition: 0.2s; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; }
        .channel-btn.active { background: var(--accent); color: #000; }
        .channel-btn.inactive { background: transparent; color: #888; border: 1px solid transparent; }
        .channel-btn.inactive:hover { background: #111; color: #fff; border-color: #222; }
        
        .chat-bubble-wrap { display: flex; flex-direction: column; margin-bottom: 20px; max-width: 70%; }
        .chat-bubble-wrap.me { align-self: flex-end; align-items: flex-end; }
        .chat-bubble-wrap.them { align-self: flex-start; align-items: flex-start; }
        
        .chat-sender { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; color: #666; }
        .chat-bubble { padding: 14px 20px; border-radius: 16px; font-size: 15px; line-height: 1.5; }
        .me .chat-bubble { background: var(--accent); color: #000; font-weight: 600; border-bottom-right-radius: 4px; }
        .them .chat-bubble { background: #1a1a1a; color: #fff; border-bottom-left-radius: 4px; border: 1px solid #222; }

        .chat-input-area { padding: 25px 40px; background: #0d0d0d; border-top: 1px solid #1a1a1a; display: flex; gap: 15px; align-items: center; }
        .chat-input { flex: 1; background: #000; border: 1px solid #222; color: #fff; padding: 18px 25px; border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 16px; outline: none; transition: 0.2s; }
        .chat-input:focus { border-color: var(--accent); }
        .chat-send-btn { background: var(--accent); color: #000; border: none; padding: 0 25px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .chat-send-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 140, 0, 0.4); }
      `}</style>

      <div className="top-bar" style={{ marginBottom: '30px' }}>
        <div>
          <h1 className="delegation-brand">COMMUNICATIONS</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>{profile?.committee} | Secure Network</p>
        </div>
      </div>

      <div className="chat-layout">
        <div className="chat-sidebar">
          
          {/* Global Channel */}
          <span className="label" style={{ marginBottom: '15px' }}>Public Channels</span>
          <div 
            className={`channel-btn ${activeRoom === profile?.committee ? 'active' : 'inactive'}`}
            onClick={() => switchRoom(profile?.committee, 'Global Committee')}
          >
            <IconGlobe /> Global Committee
          </div>

          {/* Secure Alliances */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', marginBottom: '15px' }}>
            <span className="label" style={{ margin: 0 }}>Secure Alliances</span>
            <button onClick={() => setIsBlocModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 800 }}>+ NEW</button>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
            {myBlocs.map(b => (
              <div 
                key={b.id}
                className={`channel-btn ${activeRoom === `bloc_${b.id}` ? 'active' : 'inactive'}`}
                onClick={() => switchRoom(`bloc_${b.id}`, b.name)}
              >
                <IconLock /> {b.name}
              </div>
            ))}
            {myBlocs.length === 0 && <p style={{ color: '#444', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>No alliances formed yet.</p>}
          </div>

          {/* Direct Messages */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px', marginBottom: '15px' }}>
            <span className="label" style={{ margin: 0 }}>Direct Messages</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            {committeeUsers.map(u => {
              if (u.id === authUser?.id) return null; 
              const roomId = getDMRoomId(u.id);
              return (
                <div 
                  key={u.id}
                  className={`channel-btn ${activeRoom === roomId ? 'active' : 'inactive'}`}
                  onClick={() => switchRoom(roomId, getOfficialTitle(u))}
                >
                  <IconMessage /> {u.delegation}
                </div>
              );
            })}
          </div>

        </div>

        <div className="chat-main">
          <div style={{ padding: '25px 40px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{activeRoomName}</h2>
            <span style={{ fontSize: '12px', color: '#666' }}>End-to-End Encrypted</span>
          </div>

          <div style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', color: '#444', fontWeight: 800 }}>NO MESSAGES IN THIS CHANNEL YET</div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.sender_id === authUser?.id;
                return (
                  <div key={i} className={`chat-bubble-wrap ${isMe ? 'me' : 'them'}`}>
                    <span className="chat-sender">{isMe ? 'You' : getOfficialTitle(m.users)}</span>
                    <div className="chat-bubble">{m.content}</div>
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-area">
            <input 
              className="chat-input" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder={`Message ${activeRoomName}...`} 
              autoComplete="off"
            />
            <button type="submit" className="chat-send-btn">
              <IconSend />
            </button>
          </form>
        </div>
      </div>

      {isBlocModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '20px' }}>Establish Alliance</h2>
            <input className="dark-input" style={{ minHeight: '56px', width: '100%', marginBottom: '20px' }} value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Alliance Name (e.g. NATO)" />
            
            <p style={{ fontSize: '11px', fontWeight: 800, color: '#444', marginBottom: '8px', textTransform: 'uppercase' }}>Select Delegates</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #222', padding: '10px', borderRadius: '16px', marginBottom: '20px', background: '#000' }}>
              {committeeUsers.map(u => {
                if (u.id === authUser?.id) return null; 
                return (
                  <div 
                    key={u.id} 
                    onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} 
                    style={{ 
                      padding: '12px', cursor: 'pointer', borderRadius: '12px',
                      background: selectedUsers.includes(u.id) ? 'var(--accent)' : 'transparent', 
                      color: selectedUsers.includes(u.id) ? '#000' : '#fff',
                      marginBottom: '4px', fontWeight: 700, fontSize: '13px'
                    }}
                  >
                    {getOfficialTitle(u)}
                  </div>
                )
              })}
            </div>
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="primary-btn" style={{ flex: 1, height: '56px' }} onClick={handleCreateBloc}>Initialize</button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0, height: '56px' }} onClick={() => setIsBlocModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}