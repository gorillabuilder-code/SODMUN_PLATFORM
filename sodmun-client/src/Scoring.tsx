import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

const IconCommand = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>;

const INITIAL_ROWS = 100;
const COLS = 20;
const DEFAULT_COL_WIDTH = 180;
const DEFAULT_ROW_HEIGHT = 45; // Fixed: Expressed default height
const COL_LABELS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));

export default function Scoring() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [grid, setGrid] = useState<string[][]>([]);
  const [syncStatus, setSyncStatus] = useState('Standby');
  
  // Layout state with strict defaults
  const [colWidths, setColWidths] = useState<number[]>(new Array(COLS).fill(DEFAULT_COL_WIDTH));
  const [rowHeights, setRowHeights] = useState<number[]>(new Array(INITIAL_ROWS).fill(DEFAULT_ROW_HEIGHT));

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef<boolean>(false);

  useEffect(() => {
    if (authUser) fetchCoreData();
  }, [authUser]);

  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (userData) {
      setProfile(userData);
      const { data: roster } = await supabase.from('users').select('delegation').eq('committee', userData.committee).eq('role', 'Delegate').order('delegation', { ascending: true });
      const { data: sheetData } = await supabase.from('scoring_sheets').select('*').eq('committee', userData.committee).single();

      let finalGrid: string[][];
      let widths = [...colWidths];
      let heights = [...rowHeights];

      if (sheetData?.grid) {
        finalGrid = sheetData.grid;
        roster?.forEach((d, i) => {
          const targetRow = i + 1;
          if (finalGrid[targetRow] && (!finalGrid[targetRow][0] || finalGrid[targetRow][0] === "")) {
            finalGrid[targetRow][0] = d.delegation;
          }
        });

        // SAFETY RAIL: Force minimums if metadata is corrupted or too small
        if (sheetData.metadata?.colWidths && sheetData.metadata.colWidths.length > 0) {
            widths = sheetData.metadata.colWidths.map((w: number) => w < 50 ? DEFAULT_COL_WIDTH : w);
        }
        if (sheetData.metadata?.rowHeights && sheetData.metadata.rowHeights.length > 0) {
            heights = sheetData.metadata.rowHeights.map((h: number) => h < 30 ? DEFAULT_ROW_HEIGHT : h);
        }
      } else {
        finalGrid = Array.from({ length: INITIAL_ROWS }, (_, rIdx) => Array.from({ length: COLS }, (_, cIdx) => (cIdx === 0 && rIdx > 0 && roster?.[rIdx - 1]) ? roster[rIdx - 1].delegation : ''));
        finalGrid[0][0] = "DELEGATION";
      }
      
      setGrid(finalGrid);
      setColWidths(widths);
      setRowHeights(heights);
      setSyncStatus('Saved');
    }
  };

  const atomicPush = async (newGrid: string[][], widths: number[], heights: number[]) => {
    if (!profile?.committee) return;
    await supabase.from('scores').upsert({ // Fixed: consistent table name reference
      committee: profile.committee,
      grid: newGrid,
      metadata: { colWidths: widths, rowHeights: heights },
      last_updated_at: new Date().toISOString()
    });
    setSyncStatus('Ready');
    isTypingRef.current = false;
  };

  const debouncedPush = (newGrid: string[][], widths: number[], heights: number[]) => {
    setSyncStatus('Saving...');
    isTypingRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => atomicPush(newGrid, widths, heights), 800);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    const newGrid = [...grid];
    newGrid[r] = [...newGrid[r]];
    newGrid[r][c] = val;
    setGrid(newGrid);
    debouncedPush(newGrid, colWidths, rowHeights);
  };

  const handleResize = (type: 'col' | 'row', index: number, size: number) => {
    if (type === 'col') {
      const newWidths = [...colWidths];
      newWidths[index] = Math.max(80, size); 
      setColWidths(newWidths);
      debouncedPush(grid, newWidths, rowHeights);
    } else {
      const newHeights = [...rowHeights];
      newHeights[index] = Math.max(35, size);
      setRowHeights(newHeights);
      debouncedPush(grid, colWidths, newHeights);
    }
  };

  return (
    <div className="sheet-master">
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap" rel="stylesheet" />
      
      <style>{`
        .sheet-master { 
          display: flex; flex-direction: column; height: 100vh; background: #000; overflow: hidden; 
          font-family: 'Nunito', sans-serif !important; 
        }
        .toolbar { padding: 12px 30px; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; align-items: center; background: #080808; flex-shrink: 0; }
        
        .sheet-viewport { flex: 1; overflow: auto; background: #000; }
        .table-root { border-collapse: collapse; table-layout: fixed; width: max-content; border: none; }
        
        .td-cell { 
          border: 1px solid #222; padding: 0 !important; margin: 0 !important;
          position: relative; background: #000;
          height: 100%; /* Force cell to respect TR height */
        }

        .cell-textarea { 
          position: absolute; top: 0; left: 0;
          width: 100% !important; height: 100% !important;
          min-height: 35px; /* Minimum fallback height */
          background: transparent !important; border: none !important; 
          color: #fff !important; padding: 10px !important; 
          font-family: 'Nunito', sans-serif !important; font-size: 14px !important; 
          outline: none !important; resize: none !important; border-radius: 0 !important; 
          box-sizing: border-box !important; display: block !important; margin: 0 !important;
          line-height: 1.4;
        }

        .cell-textarea:focus { 
          background: rgba(255, 140, 0, 0.1) !important; 
          box-shadow: inset 0 0 0 1px #FF8C00 !important; z-index: 50;
        }
        
        .th-cell { 
          position: sticky; top: 0; background: #0d0d0d; z-index: 100; border: 1px solid #222; 
          color: #555; font-size: 11px; height: 35px; font-weight: 900; text-transform: uppercase; 
        }
        .resizer-v { position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 110; transition: background 0.2s; }
        .resizer-v:hover { background: #FF8C00; }
        .resizer-h { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; cursor: row-resize; z-index: 110; transition: background 0.2s; }
        .resizer-h:hover { background: #FF8C00; }
        
        .sticky-label { position: sticky; left: 0; background: #0d0d0d; z-index: 90; border: 1px solid #222; color: #444; font-size: 10px; text-align: center; width: 45px; font-weight: 900; }
        .sticky-col-1 { position: sticky; left: 45px; z-index: 91; background: #0a0a0a; border-right: 2px solid #222 !important; }
        
        .header-input { font-weight: 900 !important; color: #FF8C00 !important; text-align: center; }
        .delegation-input { font-weight: 800; color: #fff; }
      `}</style>

      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <IconCommand />
          <h1 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', margin: 0 }}>SCORING SHEETS | {profile?.committee}</h1>
          <span style={{ fontSize: '10px', color: '#FF8C00', fontWeight: 900 }}>[{syncStatus.toUpperCase()}]</span>
        </div>
      </div>

      <div className="sheet-viewport">
        <table className="table-root">
          <thead>
            <tr>
              <th className="th-cell" style={{ width: '45px' }}>#</th>
              {COL_LABELS.map((l, i) => (
                <th key={l} className={`th-cell ${i === 0 ? 'sticky-col-1' : ''}`} style={{ width: `${colWidths[i]}px` }}>
                  {l}
                  <div className="resizer-v" onMouseDown={(e) => {
                    const startX = e.pageX;
                    const startW = colWidths[i];
                    const onMove = (mE: MouseEvent) => handleResize('col', i, startW + (mE.pageX - startX));
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                  }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rIdx) => (
              <tr key={rIdx} style={{ height: `${rowHeights[rIdx]}px` }}>
                <td className="sticky-label">
                  {rIdx + 1}
                  <div className="resizer-h" onMouseDown={(e) => {
                    const startY = e.pageY;
                    const startH = rowHeights[rIdx];
                    const onMove = (mE: MouseEvent) => handleResize('row', rIdx, startH + (mE.pageY - startY));
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                  }} />
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className={`td-cell ${cIdx === 0 ? 'sticky-col-1' : ''}`}>
                    <textarea 
                      className={`cell-textarea ${rIdx === 0 ? 'header-input' : ''} ${cIdx === 0 ? 'delegation-input' : ''}`} 
                      value={cell || ''} 
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      spellCheck="false"
                      placeholder={rIdx === 0 ? "LABEL..." : ""}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}