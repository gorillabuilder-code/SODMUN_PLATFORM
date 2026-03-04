import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

// --- FLOATING TOOLBAR COMPONENT ---
const FloatingToolbar = ({ position, onAction }: any) => {
  if (!position) return null;
  return (
    <div 
      className="mun-floating-toolbar" 
      style={{ 
        position: 'fixed', // Changed to fixed for easier calculation above cursor
        top: position.top, 
        left: position.left,
        transform: 'translateY(-100%)', // Lift it above the calculated point
        marginTop: '-10px' // Breathing room
      }}
      onMouseDown={(e) => e.preventDefault()} 
    >
      <button onClick={() => onAction('bold')}>B</button>
      <button onClick={() => onAction('italic')}>I</button>
      <button onClick={() => onAction('underline')}>U</button>
      <div className="toolbar-divider" />
      <button onClick={() => onAction('hilite')} title="Highlight (Ctrl+H)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
      </button>
    </div>
  );
};

// --- PURE RICH TEXT BLOCK COMPONENT ---
const EditableBlock = ({ block, index, commitBlocks, blocks, handleKeyDown, getPrefix, isChair }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<any>(null);

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

  const handleMouseUp = () => {
    if (!isChair) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPos({
        top: rect.top, // Fixed positioning handles the "above" logic via CSS transform
        left: rect.left + (rect.width / 2) - 60
      });
    } else {
      setToolbarPos(null);
    }
  };

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
        const updated = blocks.map((b: any) => b.id === block.id 
            ? { ...b, html: editorRef.current!.innerHTML, text: editorRef.current!.textContent || '' } 
            : b
        );
        commitBlocks(updated);
    }
    setToolbarPos(null);
  };

  const handleFormatAction = (action: string) => {
    if (action === 'hilite') {
      const isHighlighted = document.queryCommandValue("backColor") === "rgba(255, 140, 0, 0.3)";
      document.execCommand("backColor", false, isHighlighted ? "transparent" : "rgba(255, 140, 0, 0.3)");
      applyFormat('styleWithCSS');
    } else {
      applyFormat(action);
    }
  };

  const handleLocalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isChair && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      handleFormatAction('hilite');
    }
    handleKeyDown(e, index, block.id, editorRef.current);
  };

  const handlePrefixClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editorRef.current) {
      editorRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(editorRef.current, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  return (
    <div 
      className={`mun-row ${block.highlighted ? 'chair-highlight' : ''}`} 
      style={{ marginLeft: block.type === 'point' ? `${block.indent * 40}px` : '0px' }}
      onClick={focusEditor}
    >
      <FloatingToolbar position={toolbarPos} onAction={handleFormatAction} />
      {block.type === 'point' ? (
        <div className="mun-prefix" onClick={handlePrefixClick} style={{ cursor: 'text', zIndex: 1, position: 'relative' }}>
          {getPrefix(index)}
        </div>
      ) : (
        isChair && <div className="chair-selector" onClick={(e) => { e.stopPropagation(); }}>●</div>
      )}
      <div className={`mun-wrapper format-${block.type}`}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="mun-rich-text"
          spellCheck={false}
          data-placeholder={block.type === 'heading' ? 'Resolution Heading...' : 'Type text...'}
          onInput={handleInput}
          onMouseUp={handleMouseUp}
          onKeyDown={handleLocalKeyDown}
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
  
  const [presentationMode, setPresentationMode] = useState(false);
  const [blocFilter, setBlocFilter] = useState('all');

  const pendingBlocks = useRef(blocks);
  const activeResRef = useRef(activeRes);
  const lastSaveTime = useRef(Date.now());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;

  useEffect(() => { pendingBlocks.current = blocks; }, [blocks]);
  useEffect(() => { activeResRef.current = activeRes; }, [activeRes]);

  useEffect(() => {
    if (authUser) fetchCoreData();
  }, [authUser]);

  useEffect(() => {
    const handleUnload = () => {
      if (activeResRef.current && pendingBlocks.current.length > 0) {
        supabase.from('resolutions').update({ content: JSON.stringify(pendingBlocks.current) }).eq('id', activeResRef.current.id);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

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
      let blocQuery = supabase.from('blocs').select('*').eq('committee', userData.committee);
      const { data: allBlocs } = await blocQuery;
      
      if (userData.role !== 'Delegate') {
        setMyBlocs(allBlocs || []);
        const { data: res } = await supabase.from('resolutions').select('*, blocs(name)').eq('committee', userData.committee);
        if (res) setResolutions(res);
      } else {
        const { data: memberOf } = await supabase.from('bloc_members').select('bloc_id').eq('user_id', authUser?.id);
        const myIds = memberOf?.map(b => b.bloc_id) || [];
        setMyBlocs(allBlocs?.filter(b => myIds.includes(b.id)) || []);
        if (myIds.length > 0) {
          const { data: res } = await supabase.from('resolutions').select('*, blocs(name)').in('bloc_id', myIds);
          if (res) setResolutions(res);
        }
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
      openResolution(res);
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
      setBlocks([{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);
    }
  };

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
    if (timeSinceLastSave > 1500) {
      executeDbSave(updated);
    } else {
      saveTimeoutRef.current = setTimeout(() => executeDbSave(updated), 400);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setActiveRes({ ...activeRes, title: newTitle });
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
      if (updated[index].type === 'paragraph') { updated[index].type = 'point'; updated[index].indent = 0; }
      else if (updated[index].type === 'point' && updated[index].indent < 2) { updated[index].indent += 1; }
      commitBlocks(updated);
    }
    else if (e.key === 'Tab' && e.shiftKey && block.type === 'point') {
      e.preventDefault();
      const updated = [...blocks];
      if (updated[index].indent > 0) { updated[index].indent -= 1; } 
      else { updated[index].type = 'paragraph'; }
      commitBlocks(updated);
    }
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (block.type === 'point' && (el?.textContent === '' || el?.innerHTML === '<br>')) {
        const updated = [...blocks];
        if (block.indent > 0) { updated[index].indent -= 1; } 
        else { updated[index].type = 'paragraph'; }
        commitBlocks(updated);
        return;
      }

      const newBlock = { id: Date.now().toString(), type: block.type === 'point' ? 'point' : 'paragraph', html: '', text: '', indent: block.type === 'point' ? block.indent : 0 };
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
        const updated = [...blocks]; updated[index].indent -= 1; commitBlocks(updated);
      } else if (block.type === 'point' && block.indent === 0) {
        const updated = [...blocks]; updated[index].type = 'paragraph'; commitBlocks(updated);
      } else if (blocks.length > 1 && index > 0) {
        const updated = blocks.filter((b: any) => b.id !== id);
        commitBlocks(updated);
        setTimeout(() => {
          const prevNodes = document.querySelectorAll('.mun-rich-text');
          if (prevNodes[index - 1]) {
            const node = prevNodes[index - 1] as HTMLElement;
            node.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(node);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
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

  const filteredResolutions = blocFilter === 'all' 
    ? resolutions 
    : resolutions.filter(r => r.bloc_id?.toString() === blocFilter);

  if (activeRes) {
    return (
      <div style={{ minHeight: '100vh', background: presentationMode ? '#fff' : '#050505', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          .mun-page {
            background: ${presentationMode ? '#fff' : '#0d0d0d'}; width: 100%; max-width: 900px; min-height: 100vh;
            border: ${presentationMode ? 'none' : '1px solid #1a1a1a'}; border-radius: 16px; padding: 80px; 
            box-shadow: ${presentationMode ? 'none' : '0 20px 60px rgba(0,0,0,0.8)'}; display: flex; flex-direction: column; margin: 0 auto;
          }
          .mun-title-input {
            width: 100%; text-align: center; background: transparent; border: none;
            color: ${presentationMode ? '#000' : '#fff'}; 
            font-size: ${presentationMode ? '64px' : '32px'}; 
            font-weight: 900; font-family: 'Nunito', sans-serif;
            text-transform: uppercase; outline: none; padding: 0; margin-bottom: 20px;
          }
          .mun-divider { border: 0; height: 1px; background: ${presentationMode ? '#eee' : '#222'}; margin-bottom: 40px; }
          .mun-row { display: flex; align-items: flex-start; margin-bottom: 8px; position: relative; cursor: text; }
          .chair-highlight { 
             background: rgba(255, 140, 0, 0.15); 
             border-left: 3px solid var(--accent); padding-left: 5px; 
          }
          
          .chair-selector { position: absolute; left: -30px; top: 8px; color: #333; cursor: pointer; font-size: 10px; }
          .chair-selector:hover { color: var(--accent); }
          .mun-prefix { width: 45px; padding-top: 4px; color: var(--accent); font-weight: 800; font-size: 16px; flex-shrink: 0; text-align: right; padding-right: 15px; user-select: none; }
          .mun-rich-text { 
            width: 100%; min-height: 1.6em; min-width: 50px; padding: 4px 0; font-family: 'Nunito', sans-serif !important; 
            line-height: 1.6; font-size: ${presentationMode ? '24px' : '18px'}; 
            color: ${presentationMode ? '#000' : '#fff'}; outline: none; white-space: pre-wrap;
          }

          .mun-floating-toolbar {
            display: flex; gap: 5px; background: #222; border: 1px solid #444;
            padding: 5px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          }
          .mun-floating-toolbar button {
            background: transparent; border: none; color: #fff; width: 28px; height: 28px;
            font-family: serif; font-weight: 800; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center;
          }
          .mun-floating-toolbar button:hover { background: #333; color: var(--accent); }
          .toolbar-divider { width: 1px; background: #444; margin: 0 5px; }

          .format-heading .mun-rich-text { font-size: ${presentationMode ? '36px' : '24px'}; font-weight: 800; color: var(--accent); text-transform: uppercase; }
        `}</style>

        {!presentationMode && (
          <div className="top-bar" style={{ padding: '15px 40px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button className="logout-btn" style={{ marginTop: 0 }} onClick={() => setActiveRes(null)}>← BACK</button>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{activeRes.title}</h2>
                  <span style={{ fontSize: '11px', color: 'var(--accent)' }}>{syncStatus}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {isChair && <button className="primary-btn" onClick={() => setPresentationMode(true)}>PRESENTATION MODE</button>}
              </div>
            </div>
          </div>
        )}

        {presentationMode && (
          <button onClick={() => setPresentationMode(false)} style={{ position: 'fixed', top: '20px', right: '20px', padding: '10px 20px', background: '#000', color: '#fff', borderRadius: '8px', zIndex: 100, border: 'none', fontWeight: 900, cursor: 'pointer' }}>EXIT</button>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: presentationMode ? '40px' : '60px 20px', display: 'flex', justifyContent: 'center' }}>
          <div className="mun-page">
            <input className="mun-title-input" value={activeRes.title} onChange={(e) => handleTitleChange(e.target.value)} spellCheck={false} />
            <hr className="mun-divider" />
            {blocks.map((block, index) => (
              <EditableBlock key={block.id} block={block} index={index} commitBlocks={commitBlocks} blocks={blocks} handleKeyDown={handleKeyDown} getPrefix={getPrefix} isChair={isChair} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <h1 className="delegation-brand">{isChair ? 'CHAIR OVERWATCH' : 'RESOLUTIONS'}</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>{profile?.committee} | Drafting</p>
        </div>
        {!isChair && <button className="primary-btn" onClick={() => setIsResModal(true)}>New Resolution</button>}
      </div>

      <div className="main-grid">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span className="label">Documents Repository</span>
            {isChair && (
              <select className="dark-input" style={{ width: '220px', margin: 0, minHeight: '38px', fontSize: '12px' }} value={blocFilter} onChange={(e) => setBlocFilter(e.target.value)}>
                <option value="all">Filter by Alliances...</option>
                {myBlocs.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredResolutions.map(r => (
              <div key={r.id} onClick={() => openResolution(r)} className="bloc-card" style={{ cursor: 'pointer' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '5px' }}>{r.title}</h3>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>{r.blocs?.name || 'Independent'}</span>
              </div>
            ))}
            {filteredResolutions.length === 0 && <p style={{ color: '#333', fontSize: '13px' }}>No drafts match your current filter.</p>}
          </div>
        </div>
      </div>

      {isResModal && (
        <div className="overlay">
          <div className="modal">
            <h2 style={{ marginBottom: '20px', fontWeight: 900 }}>INITIALIZE DOCUMENT</h2>
            <input className="dark-input" style={{ minHeight: '56px' }} value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="e.g. Working Paper 1.1" />
            <select className="dark-input" style={{ minHeight: '56px' }} value={selectedBlocId} onChange={e => setSelectedBlocId(e.target.value)}>
              <option value="">Select Alliance...</option>
              {myBlocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button className="primary-btn" style={{ flex: 1, height: '56px' }} onClick={handleCreateResolution}>CREATE</button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0, height: '56px' }} onClick={() => setIsResModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}