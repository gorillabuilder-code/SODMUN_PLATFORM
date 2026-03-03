import React from 'react';
import scheduleImg from './assets/schedule.png';

export default function Schedule() {
  return (
    <div style={containerStyle}>
      <h2 style={{ color: 'var(--accent-orange)', marginBottom: '30px' }}>Conference Schedule</h2>
      <div style={imageWrapperStyle}>
        <img 
          src={scheduleImg} 
          alt="SODMUN Schedule" 
          style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} 
        />
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  height: '100%',
  backgroundColor: 'var(--bg-dark)'
};

const imageWrapperStyle: React.CSSProperties = {
  maxWidth: '800px',
  width: '100%',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '10px',
  backgroundColor: 'var(--bg-panel)'
};