import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

// --- PURE RICH TEXT BLOCK COMPONENT ---
const EditableBlock = ({ block, index, commitBlocks, blocks, handleKeyDown, getPrefix }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (editorRef.current.innerHTML !== block.html) {
        editorRef.current.innerHTML = block.html || '';
      }
    }
  }, [block.html]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const updated = blocks.map((b: any) => b.id === block.id 
      ? { ...b, html: e.currentTarget.innerHTML, text: e.currentTarget.textContent || '' } 
      : b
    );
    commitBlocks(updated);
  };

  return (
    <div className="mun-row" style={{ marginLeft: block.type === 'point' ? `${block.indent * 40}px` : '0px' }}>
      {block.type === 'point' && <div className="mun-prefix">{getPrefix(index)}</div>}
      <div className={`mun-wrapper format-${block.type}`}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="mun-rich-text"
          spellCheck={false}
          data-placeholder={block.type === 'heading' ? 'Resolution Heading...' : 'Type text... (Press Tab to make a list)'}
          onInput={handleInput}
          onKeyDown={(e) => handleKeyDown(e, index, block.id, editorRef.current)}
        />
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD ---
export default function Resolutions() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [resolutions, setResolutions] = useState<any[]>([]);
  const [activeRes, setActiveRes] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState('All changes saved');

  const [isResModal, setIsResModal] = useState(false);
  const [myBlocs, setMyBlocs] = useState<any[]>([]);
  const [newResTitle, setNewResTitle] = useState('');
  const [selectedBlocId, setSelectedBlocId] = useState('');

  // Save Engine Refs
  const pendingBlocks = useRef(blocks);
  const activeResRef = useRef(activeRes);
  const lastSaveTime = useRef(Date.now());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs updated for the unmount safety net
  useEffect(() => { pendingBlocks.current = blocks; }, [blocks]);
  useEffect(() => { activeResRef.current = activeRes; }, [activeRes]);

  useEffect(() => {
    if (authUser) fetchCoreData();
  }, [authUser]);

  // Emergency Save if user closes tab while typing
  useEffect(() => {
    const handleUnload = () => {
      if (activeResRef.current && pendingBlocks.current.length > 0) {
        supabase.from('resolutions').update({ content: JSON.stringify(pendingBlocks.current) }).eq('id', activeResRef.current.id);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload(); // Also fire when navigating away within the app
    };
  }, []);

  // Realtime Sync
  useEffect(() => {
    if (!activeRes) return;
    const channel = supabase.channel(`res_${activeRes.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'resolutions', filter: `id=eq.${activeRes.id}` },
        (payload) => {
          try {
            if (payload.new.title !== activeRes.title) {
              setActiveRes((prev: any) => ({ ...prev, title: payload.new.title }));
              setResolutions(prev => prev.map(r => r.id === activeRes.id ? { ...r, title: payload.new.title } : r));
            }
            const incoming = typeof payload.new.content === 'string' ? JSON.parse(payload.new.content) : payload.new.content;
            if (Array.isArray(incoming) && JSON.stringify(incoming) !== JSON.stringify(blocks)) {
              setBlocks(incoming);
            }
          } catch(e) {}
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRes, blocks]);

  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (userData) {
      setProfile(userData);
      const { data: blocs } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const filteredBlocs = blocs?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [];
      setMyBlocs(filteredBlocs);
      if (filteredBlocs.length > 0) {
        const { data: res } = await supabase.from('resolutions').select('*').in('bloc_id', filteredBlocs.map(b => b.id));
        if (res) setResolutions(res);
      }
    }
  };

  const handleCreateResolution = async () => {
    if (!newResTitle.trim() || !selectedBlocId) return;
    const initialContent = JSON.stringify([{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);

    const { data: res } = await supabase.from('resolutions').insert([{ 
        title: newResTitle, bloc_id: parseInt(selectedBlocId), committee: profile?.committee, content: initialContent 
    }]).select().single();

    if (res) {
      setResolutions([res, ...resolutions]);
      setActiveRes(res);
      setBlocks([{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);
      setIsResModal(false);
      setNewResTitle('');
    }
  };

  const openResolution = (res: any) => {
    setActiveRes(res);
    setSyncStatus('All changes saved');
    try {
      let parsed = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
      setBlocks(Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);
    } catch (e) {
      setBlocks([{ id: Date.now().toString(), type: 'heading', html: res.content || '', text: res.content || '', indent: 0 }]);
    }
  };

  // --- THE NEW THROTTLED SAVE ENGINE ---
  const executeDbSave = async (dataToSave: any[]) => {
    lastSaveTime.current = Date.now();
    if (activeResRef.current) {
      await supabase.from('resolutions').update({ content: JSON.stringify(dataToSave) }).eq('id', activeResRef.current.id);
      setSyncStatus('All changes saved');
    }
  };

  const commitBlocks = (updated: any[]) => {
    setBlocks(updated);
    setSyncStatus('Saving...');
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    const timeSinceLastSave = Date.now() - lastSaveTime.current;
    
    // If the user is typing continuously, force a save every 1.5 seconds anyway
    if (timeSinceLastSave > 1500) {
      executeDbSave(updated);
    } else {
      // Otherwise, wait for a 400ms pause in typing
      saveTimeoutRef.current = setTimeout(() => {
        executeDbSave(updated);
      }, 400);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setActiveRes({ ...activeRes, title: newTitle });
    setResolutions(prev => prev.map(r => r.id === activeRes.id ? { ...r, title: newTitle } : r));
    setSyncStatus('Saving...');
    
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      await supabase.from('resolutions').update({ title: newTitle }).eq('id', activeRes.id);
      setSyncStatus('All changes saved');
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, id: string, el: HTMLDivElement | null) => {
    const block = blocks[index];

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const updated = [...blocks];
      if (updated[index].type === 'paragraph') {
        updated[index].type = 'point';
        updated[index].indent = 0;
      } else if (updated[index].type === 'point' && updated[index].indent < 2) {
        updated[index].indent += 1;
      }
      commitBlocks(updated);
    }
    else if (e.key === 'Tab' && e.shiftKey && block.type === 'point') {
      e.preventDefault();
      const updated = [...blocks];
      if (updated[index].indent > 0) {
        updated[index].indent -= 1;
      } else {
        updated[index].type = 'paragraph';
      }
      commitBlocks(updated);
    }
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = Date.now().toString();
      let newType = block.type === 'point' ? 'point' : 'paragraph';

      const newBlock = { id: newId, type: newType, html: '', text: '', indent: block.type === 'point' ? block.indent : 0 };
      const updated = [...blocks];
      updated.splice(index + 1, 0, newBlock);
      commitBlocks(updated);
      
      setTimeout(() => {
        const nextNodes = document.querySelectorAll('.mun-rich-text');
        if (nextNodes[index + 1]) (nextNodes[index + 1] as HTMLElement).focus();
      }, 10);
    }
    else if (e.key === 'Backspace' && (el?.textContent === '' || el?.innerHTML === '<br>')) {
      e.preventDefault();
      if (block.type === 'point' && block.indent > 0) {
        const updated = [...blocks];
        updated[index].indent -= 1;
        commitBlocks(updated);
      } else if (block.type === 'point' && block.indent === 0) {
        const updated = [...blocks];
        updated[index].type = 'paragraph';
        commitBlocks(updated);
      } else if (blocks.length > 1) {
        const updated = blocks.filter((b: any) => b.id !== id);
        commitBlocks(updated);
        setTimeout(() => {
          const prevNodes = document.querySelectorAll('.mun-rich-text');
          if (prevNodes[index - 1]) {
            const node = prevNodes[index - 1] as HTMLElement;
            node.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            if (node.childNodes.length > 0) {
              range.setStart(node, node.childNodes.length);
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }
        }, 10);
      }
    }
  };

  const getPrefix = (currentIndex: number) => {
    const block = blocks[currentIndex];
    if (block.type !== 'point') return '';

    const currentIndent = block.indent;
    let count = 1;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (blocks[i].type !== 'point') continue;
      if (blocks[i].indent < currentIndent) break;
      if (blocks[i].indent === currentIndent) count++;
    }
    
    const romanize = (num: number) => ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][num] || num.toString();
    if (currentIndent === 0) return `${count}.`;
    if (currentIndent === 1) return `${String.fromCharCode(96 + count)}.`;
    if (currentIndent === 2) return `${romanize(count)}.`;
    return '*';
  };

  if (activeRes) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          .mun-page {
            background: #0d0d0d; width: 100%; max-width: 900px; min-height: 100vh;
            border: 1px solid #1a1a1a; border-radius: 16px; padding: 80px; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.8); display: flex; flex-direction: column; margin: 0 auto;
          }
          .mun-title-input {
            width: 100%; text-align: center; background: transparent; border: none;
            color: #fff; font-size: 32px; font-weight: 900; font-family: 'Nunito', sans-serif;
            text-transform: uppercase; outline: none; padding: 0; margin-bottom: 20px;
          }
          .mun-title-input::placeholder { color: #333; }
          .mun-divider { border: 0; height: 1px; background: #222; margin-bottom: 40px; }
          .mun-row { display: flex; align-items: flex-start; margin-bottom: 8px; transition: margin-left 0.1s ease-in-out; }
          .mun-prefix { width: 45px; padding-top: 4px; color: var(--accent); font-weight: 800; font-size: 16px; flex-shrink: 0; text-align: right; padding-right: 15px; user-select: none; }
          .mun-wrapper { flex: 1; min-height: 26px; }
          
          .mun-rich-text { 
            width: 100%; min-height: 26px; padding: 4px 0; font-family: 'Nunito', sans-serif !important; 
            line-height: 1.6; font-size: 16px; color: #fff; outline: none; white-space: pre-wrap; word-break: break-word;
          }
          .mun-rich-text:empty:before { content: attr(data-placeholder); color: #444; pointer-events: none; display: block; }
          .format-heading .mun-rich-text { font-size: 24px; font-weight: 800; color: var(--accent); text-transform: uppercase; }
          .mun-rich-text b, .mun-rich-text strong { font-weight: 900; color: #fff; }
          .mun-rich-text i, .mun-rich-text em { font-style: italic; color: #ccc; }
        `}</style>

        <div className="top-bar" style={{ padding: '20px 40px', marginBottom: 0, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button className="logout-btn" style={{ marginTop: 0 }} onClick={() => setActiveRes(null)}>← Back</button>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{activeRes.title}</h2>
              <span style={{ fontSize: '12px', color: syncStatus === 'Saving...' ? '#888' : 'var(--accent)', transition: '0.2s' }}>
                {syncStatus} | Press Tab for numbering
              </span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '60px 20px', display: 'flex', justifyContent: 'center' }}>
          <div className="mun-page">
            <input 
              className="mun-title-input"
              value={activeRes.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="DOCUMENT TITLE"
              spellCheck={false}
            />
            <hr className="mun-divider" />

            {blocks.map((block, index) => (
              <EditableBlock 
                key={block.id} 
                block={block} 
                index={index} 
                commitBlocks={commitBlocks}
                blocks={blocks}
                handleKeyDown={handleKeyDown} 
                getPrefix={getPrefix} 
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <h1 className="delegation-brand">RESOLUTIONS</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>{profile?.committee} | Drafting</p>
        </div>
        <button className="primary-btn" onClick={() => setIsResModal(true)}>New Resolution</button>
      </div>

      <div className="main-grid">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <span className="label">Drafts Repository</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {resolutions.map(r => (
              <div key={r.id} onClick={() => openResolution(r)} className="bloc-card" style={{ cursor: 'pointer' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '5px' }}>{r.title}</h3>
                  <span style={{ fontSize: '11px', color: '#666', fontWeight: 700 }}>BLOC ID: {r.bloc_id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isResModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '20px' }}>Initialize Draft</h2>
            <input className="dark-input" style={{ minHeight: '56px' }} value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="Title (e.g. Working Paper 1.1)" />
            <select className="dark-input" style={{ minHeight: '56px' }} value={selectedBlocId} onChange={e => setSelectedBlocId(e.target.value)}>
              <option value="">Link to Alliance...</option>
              {myBlocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button className="primary-btn" style={{ flex: 1, height: '56px' }} onClick={handleCreateResolution}>Initialize</button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0, height: '56px' }} onClick={() => setIsResModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}