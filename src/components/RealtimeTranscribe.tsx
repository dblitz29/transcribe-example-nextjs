'use client';

import { useState, useRef, useCallback } from 'react';

export default function RealtimeTranscribe() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('id-ID');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const languages = [
    { value: 'id-ID', label: 'Indonesian' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'es-US', label: 'Spanish (US)' },
  ];

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setPartialTranscript('');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Connect to WebSocket
      const ws = new WebSocket(`ws://${window.location.host}/ws/transcribe`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'start', language, sampleRate: 48000 }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          if (data.isPartial) {
            // Replace partial transcript (it's cumulative from server)
            setPartialTranscript(data.text);
          } else {
            // Append final transcript
            setTranscript((prev) => prev + (prev ? ' ' : '') + data.text);
            setPartialTranscript('');
          }
        } else if (data.type === 'error') {
          setError(data.error);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      // Create AudioContext for PCM conversion
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode (deprecated but widely supported)
      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32 to Int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send as base64
          const uint8Array = new Uint8Array(pcmData.buffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);
          ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      workletNodeRef.current = scriptProcessor as any;

      setIsRecording(true);
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, [language]);

  const stopRecording = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsRecording(false);
    setPartialTranscript('');
  }, []);

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Realtime Transcription</h2>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>{error}</p>
        </div>
      )}

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isRecording}
            style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            {languages.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: isRecording ? '#dc2626' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>

        {isRecording && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <span style={{ color: '#dc2626' }}>● Recording...</span>
          </div>
        )}
      </div>

      {(transcript || partialTranscript) && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Transcript</h3>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', minHeight: '100px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {transcript}
              <span style={{ color: '#94a3b8' }}>{partialTranscript}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
