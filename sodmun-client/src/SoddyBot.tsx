import React, { useState, useRef, useEffect } from 'react';
import { askSoddy } from './api';

type Message = { role: 'user' | 'assistant'; content: string };

export default function SoddyBot() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Greetings Delegate! I am Soddy, your official SODMUN AI assistant. How can I help you with the Rules of Procedure today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    try {
      // Send the entire conversation history to the bot for context
      const botReply = await askSoddy(newHistory);
      setMessages([...newHistory, { role: 'assistant', content: botReply.content }]);
    } catch (error) {
      setMessages([...newHistory, { role: 'assistant', content: "Error: Could not reach Soddy's servers." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2>🤖 Soddy (MUN Assistant)</h2>
      </div>
      
      <div style={chatAreaStyle}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '15px' }}>
            <div style={{ ...bubbleStyle, backgroundColor: msg.role === 'user' ? 'var(--accent-orange)' : 'var(--bg-panel)', border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' }}>
            <div style={{ ...bubbleStyle, backgroundColor: 'var(--bg-panel)', fontStyle: 'italic', color: 'var(--text-muted)' }}>Soddy is typing...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={inputFormStyle}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Ask a question about MUN rules..."
          style={inputStyle}
          disabled={isTyping}
        />
        <button type="submit" disabled={isTyping}>Ask</button>
      </form>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', maxWidth: '800px', margin: '0 auto' };
const headerStyle: React.CSSProperties = { padding: '15px 20px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' };
const chatAreaStyle: React.CSSProperties = { flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: 'var(--bg-dark)' };
const bubbleStyle: React.CSSProperties = { padding: '12px 18px', borderRadius: '8px', maxWidth: '80%', lineHeight: '1.4' };
const inputFormStyle: React.CSSProperties = { display: 'flex', padding: '15px', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', gap: '10px' };
const inputStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-dark)', color: 'white', outline: 'none' };