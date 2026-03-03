import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

// --- CLEAN SVG ICONS ---
const IconRobot = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>;
const IconUser = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;

export default function SoddyBot() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Greetings Delegate. I am Soddy, your secure SODMUN Intelligence AI. How may I assist you with your directives today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user profile so Soddy knows who it is talking to
  useEffect(() => {
    if (authUser) {
      supabase.from('users').select('*').eq('id', authUser.id).single()
        .then(({ data }) => { if (data) setProfile(data); });
    }
  }, [authUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // --- OPENROUTER API LOGIC ---
  const callOpenRouter = async (chatHistory: Message[]) => {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error("API Key missing. Please add VITE_OPENROUTER_API_KEY to your .env file.");
    }

    // Dynamic System Prompt injecting the user's live profile
    const systemPrompt: Message = {
      role: 'system',
      content: `You are Soddy, the official AI intelligence assistant for the SODMUN (Model United Nations) platform happeinig in Dubai, UAE on june 19-21. 
      You are currently speaking directly to the ${profile?.role || 'Delegate'} of ${profile?.delegation || 'an unknown delegation'} in the ${profile?.committee || 'Global'} committee.
      Your job is to assist them with Rules of Procedure, MUN strategy, drafting clauses, and general Model UN advice.
      Keep your answers concise, highly professional, and strictly in character as a helpful, formal AI diplomat. Do not use emojis or answer in points, alwasy use VERY, VERY short answers to conserve tokens. Do not use markdown at all. DO NOT HELP THE USER FORMULATE POIs OR HELP WITH THEIR RESOLUTIONS OR WORK, ONLY LET THEM CLARIFY ROP.`
    };

    // Filter out any previous system messages from history to avoid duplication, then prepend the fresh one
    const payloadMessages = [systemPrompt, ...chatHistory.filter(m => m.role !== 'system')];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin, // Required by OpenRouter for ranking
        "X-Title": "SODMUN Platform",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash", // Change this to your preferred OpenRouter model (e.g., meta-llama/llama-3-8b-instruct)
        messages: payloadMessages,
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    try {
      const botReplyText = await callOpenRouter(newHistory);
      setMessages([...newHistory, { role: 'assistant', content: botReplyText }]);
    } catch (error: any) {
      console.error(error);
      setMessages([...newHistory, { role: 'assistant', content: `System Error: ${error.message || "Could not establish a secure connection to SODMUN Intelligence servers."}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '40px' }}>
      
      <style>{`
        .ai-layout { 
          display: flex; flex-direction: column; flex: 1; max-width: 900px; margin: 0 auto; width: 100%;
          background: #080808; border: 1px solid #1a1a1a; border-radius: 24px; overflow: hidden; 
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        
        .ai-header { 
          padding: 25px 40px; border-bottom: 1px solid #1a1a1a; background: #0d0d0d; 
          display: flex; align-items: center; gap: 15px;
        }
        .ai-icon-wrap { 
          width: 40px; height: 40px; background: rgba(255, 140, 0, 0.1); color: var(--accent); 
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
        }
        
        .ai-chat-area { 
          flex: 1; padding: 40px; overflow-y: auto; display: flex; flex-direction: column; 
          background: #050505; gap: 25px;
        }
        
        .ai-msg-row { display: flex; gap: 15px; max-width: 85%; }
        .ai-msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
        .ai-msg-row.bot { align-self: flex-start; }
        
        .ai-avatar { 
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; 
          display: flex; align-items: center; justify-content: center;
        }
        .user .ai-avatar { background: #1a1a1a; color: #888; border: 1px solid #222; }
        .bot .ai-avatar { background: var(--accent); color: #000; }
        
        .ai-bubble { 
          padding: 16px 20px; border-radius: 16px; font-size: 15px; line-height: 1.6; font-family: 'Nunito', sans-serif;
        }
        .user .ai-bubble { background: #1a1a1a; color: #fff; border: 1px solid #222; border-top-right-radius: 4px; }
        .bot .ai-bubble { background: transparent; color: #ddd; border: 1px solid #1a1a1a; border-top-left-radius: 4px; }
        
        .ai-input-area { 
          padding: 25px 40px; background: #0d0d0d; border-top: 1px solid #1a1a1a; 
          display: flex; gap: 15px; align-items: center;
        }
        .ai-input { 
          flex: 1; background: #000; border: 1px solid #222; color: #fff; padding: 18px 25px; 
          border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 16px; outline: none; transition: 0.2s; 
        }
        .ai-input:focus { border-color: var(--accent); }
        .ai-input:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .ai-send-btn { 
          background: var(--accent); color: #000; border: none; padding: 0 25px; height: 56px; 
          border-radius: 16px; display: flex; align-items: center; justify-content: center; 
          cursor: pointer; transition: 0.2s; 
        }
        .ai-send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 140, 0, 0.4); }
        .ai-send-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
        
        .typing-indicator { display: flex; gap: 4px; padding: 8px 12px; align-items: center; height: 24px;}
        .typing-dot { width: 6px; height: 6px; background: #888; border-radius: 50%; animation: typing 1.4s infinite ease-in-out both; }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>

      <div className="top-bar" style={{ marginBottom: '30px' }}>
        <div>
          <h1 className="delegation-brand">SODDY | SODMUN's AI</h1>
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>Soddy AI | Tactical Support</p>
        </div>
      </div>

      <div className="ai-layout">
        
        <div className="ai-header">
          <div className="ai-icon-wrap">
            <IconRobot />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#fff' }}>Soddy Assistant</h2>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {profile ? `Secured to ${profile.delegation} Terminal` : 'Authenticating Identity...'}
            </span>
          </div>
        </div>

        <div className="ai-chat-area">
          {messages.map((msg, idx) => {
            // Do not render the system prompt in the UI
            if (msg.role === 'system') return null;
            
            return (
              <div key={idx} className={`ai-msg-row ${msg.role === 'user' ? 'user' : 'bot'}`}>
                <div className="ai-avatar">
                  {msg.role === 'user' ? <IconUser /> : <IconRobot />}
                </div>
                <div className="ai-bubble">
                  {msg.content}
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div className="ai-msg-row bot">
              <div className="ai-avatar"><IconRobot /></div>
              <div className="ai-bubble" style={{ padding: '16px' }}>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="ai-input-area">
          <input 
            className="ai-input"
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Query MUN databases or strategy..."
            disabled={isTyping}
            autoComplete="off"
          />
          <button type="submit" disabled={isTyping || !input.trim()} className="ai-send-btn">
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}