import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from './api';
import { useAuth } from './AuthContext';

type Resolution = { id: number; title: string; content: string; bloc_id: number };
type Bloc = { id: number; name: string };

export default function Resolutions() {
  const { user } = useAuth();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [activeRes, setActiveRes] = useState<Resolution | null>(null);
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to our Node.js Socket server
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    return () => { newSocket.close(); };
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchResolutions = async () => {
      // Get blocs the user belongs to
      const { data: blocMembers } = await supabase.from('bloc_members').select('bloc_id').eq('user_id', user.id);
      if (!blocMembers || blocMembers.length === 0) return;
      
      const blocIds = blocMembers.map(bm => bm.bloc_id);

      // Fetch resolutions for those blocs
      const { data: resData } = await supabase.from('resolutions').select('*').in('bloc_id', blocIds);
      if (resData) setResolutions(resData);
    };

    fetchResolutions();
  }, [user]);

  useEffect(() => {
    if (!socket || !activeRes) return;

    // Join a specific socket room for this document
    const roomName = `res_${activeRes.id}`;
    socket.emit('join_room', roomName);

    // Listen for edits from other delegates
    socket.on('resolution_updated', (newContent: string) => {
      setContent(newContent);
    });

    return () => {
      socket.off('resolution_updated');
    };
  }, [socket, activeRes]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    // Broadcast to others immediately
    if (socket && activeRes) {
      socket.emit('edit_resolution', { roomId: `res_${activeRes.id}`, content: newText });
    }
  };

  const saveResolution = async () => {
    if (!activeRes) return;
    await supabase.from('resolutions').update({ content, last_updated: new Date() }).eq('id', activeRes.id);
    alert('Resolution saved successfully!');
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar List */}
      <div style={sidebarStyle}>
        <h3 style={{ color: 'var(--accent-orange)', marginBottom: '15px' }}>Draft Resolutions</h3>
        {resolutions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No resolutions found for your blocs.</p>
        ) : (
          resolutions.map(res => (
            <div 
              key={res.id} 
              style={{ ...resItemStyle, backgroundColor: activeRes?.id === res.id ? 'var(--border-color)' : 'transparent' }}
              onClick={() => { setActiveRes(res); setContent(res.content); }}
            >
              📄 {res.title}
            </div>
          ))
        )}
      </div>

      {/* Editor Area */}
      <div style={editorAreaStyle}>
        {activeRes ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2>{activeRes.title}</h2>
              <button onClick={saveResolution}>Save to Database</button>
            </div>
            <textarea
              value={content}
              onChange={handleContentChange}
              style={textAreaStyle}
              placeholder="Start drafting your resolution clauses here..."
            />
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
            Select a resolution from the sidebar to start collaborating.
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = { display: 'flex', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' };
const sidebarStyle: React.CSSProperties = { width: '250px', backgroundColor: 'var(--bg-panel)', padding: '20px', borderRight: '1px solid var(--border-color)', overflowY: 'auto' };
const resItemStyle: React.CSSProperties = { padding: '10px', borderRadius: '4px', cursor: 'pointer', marginBottom: '5px', transition: 'background 0.2s' };
const editorAreaStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', backgroundColor: 'var(--bg-dark)' };
const textAreaStyle: React.CSSProperties = { flex: 1, backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', fontSize: '16px', fontFamily: 'Nunito, sans-serif', resize: 'none', outline: 'none' };