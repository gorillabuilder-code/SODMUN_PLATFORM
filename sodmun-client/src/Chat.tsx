import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './api';

type Message = { id: number; sender_id: string; content: string; timestamp: string };
type Bloc = { id: number; name: string };

export default function Chat() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState<string>(user?.committee || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch accessible Blocs based on Role
    const fetchBlocs = async () => {
      if (user.role === 'Chair') {
        const { data } = await supabase.from('blocs').select('id, name').eq('committee', user.committee);
        if (data) setBlocs(data);
      } else {
        const { data } = await supabase.from('bloc_members').select('bloc_id, blocs(id, name)').eq('user_id', user.id);
        if (data) setBlocs(data.map((b: any) => b.blocs));
      }
    };
    fetchBlocs();
  }, [user]);

  useEffect(() => {
    if (!activeChannel) return;

    // 2. Fetch history for active channel
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('recipient_group', activeChannel)
        .order('timestamp', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    // 3. Supabase Realtime Subscription for this channel
    const channel = supabase.channel(`room:${activeChannel}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `recipient_group=eq.${activeChannel}` 
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_group: activeChannel,
      content: input.trim()
    });
    setInput('');
  };

  if (!user) return null;

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <h3 style={{ marginBottom: '15px', color: 'var(--accent-orange)' }}>Channels</h3>
        <div 
          style={{ ...channelItemStyle, backgroundColor: activeChannel === user.committee ? 'var(--border-color)' : 'transparent' }}
          onClick={() => setActiveChannel(user.committee)}
        >
          # Main Committee
        </div>
        
        <h4 style={{ marginTop: '20px', marginBottom: '10px', color: 'var(--text-muted)' }}>Blocs {user.role === 'Chair' ? '(Monitoring)' : ''}</h4>
        {blocs.map(bloc => (
          <div 
            key={bloc.id}
            style={{ ...channelItemStyle, backgroundColor: activeChannel === `bloc_${bloc.id}` ? 'var(--border-color)' : 'transparent' }}
            onClick={() => setActiveChannel(`bloc_${bloc.id}`)}
          >
            # {bloc.name}
          </div>
        ))}
      </div>

      {/* Main Chat Area */}
      <div style={chatAreaStyle}>
        <div style={messageListStyle}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} style={{ ...messageWrapperStyle, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...messageBubbleStyle, backgroundColor: isMe ? 'var(--accent-orange)' : 'var(--bg-panel)' }}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={inputFormStyle}>
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={`Message ${activeChannel.startsWith('bloc_') ? 'Bloc' : 'Committee'}...`}
            style={inputStyle}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = { display: 'flex', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' };
const sidebarStyle: React.CSSProperties = { width: '250px', backgroundColor: 'var(--bg-panel)', padding: '20px', borderRight: '1px solid var(--border-color)', overflowY: 'auto' };
const channelItemStyle: React.CSSProperties = { padding: '10px', borderRadius: '4px', cursor: 'pointer', marginBottom: '5px', transition: 'background 0.2s' };
const chatAreaStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-dark)' };
const messageListStyle: React.CSSProperties = { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' };
const messageWrapperStyle: React.CSSProperties = { display: 'flex', width: '100%' };
const messageBubbleStyle: React.CSSProperties = { padding: '10px 15px', borderRadius: '8px', maxWidth: '70%', wordBreak: 'break-word' };
const inputFormStyle: React.CSSProperties = { display: 'flex', padding: '15px', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', gap: '10px' };
const inputStyle: React.CSSProperties = { flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'white' };