'use client';

import { useState } from 'react';
import TranscribeForm from '../components/TranscribeForm';
import RealtimeTranscribe from '../components/RealtimeTranscribe';

export default function Home() {
  const [mode, setMode] = useState<'file' | 'realtime'>('file');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => setMode('file')}
          style={{
            padding: '8px 16px',
            background: mode === 'file' ? '#2563eb' : '#e2e8f0',
            color: mode === 'file' ? '#fff' : '#1e293b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          File Upload
        </button>
        <button
          onClick={() => setMode('realtime')}
          style={{
            padding: '8px 16px',
            background: mode === 'realtime' ? '#2563eb' : '#e2e8f0',
            color: mode === 'realtime' ? '#fff' : '#1e293b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Realtime Mic
        </button>
      </div>
      {mode === 'file' ? <TranscribeForm /> : <RealtimeTranscribe />}
    </div>
  );
}
