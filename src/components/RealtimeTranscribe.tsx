'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function RealtimeTranscribe() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('id-ID');
  const [autoStopEnabled, setAutoStopEnabled] = useState(true);
  const [silenceThreshold, setSilenceThreshold] = useState(3); // seconds
  const [silenceDetected, setSilenceDetected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioTimeRef = useRef<number>(Date.now());

  const languages = [
    { value: 'id-ID', label: 'Indonesian' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'es-US', label: 'Spanish (US)' },
  ];

  // Calculate RMS (Root Mean Square) to detect audio level
  const calculateRMS = (audioData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  };

  // Check for silence and auto-stop
  const checkSilence = useCallback((rms: number) => {
    const SILENCE_RMS_THRESHOLD = 0.01; // Adjust this threshold as needed
    const now = Date.now();

    if (rms < SILENCE_RMS_THRESHOLD) {
      // Audio is silent
      if (!silenceTimerRef.current && autoStopEnabled) {
        // Start silence timer
        silenceTimerRef.current = setTimeout(() => {
          setSilenceDetected(true);
          stopRecording();
        }, silenceThreshold * 1000);
      }
    } else {
      // Audio is not silent - reset timer
      lastAudioTimeRef.current = now;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  }, [autoStopEnabled, silenceThreshold]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setPartialTranscript('');
      setSilenceDetected(false);

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
            setPartialTranscript(data.text);
          } else {
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
      
      // Use ScriptProcessorNode for audio processing
      const bufferSize = 4096;
      const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate audio level for silence detection
        const rms = calculateRMS(inputData);
        checkSilence(rms);

        if (ws.readyState === WebSocket.OPEN) {
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
      workletNodeRef.current = scriptProcessor;

      setIsRecording(true);
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, [language, checkSilence]);

  const stopRecording = useCallback(() => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Realtime Transcription</h2>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>{error}</p>
        </div>
      )}

      {silenceDetected && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#92400e' }}>Auto-stopped: No speech detected for {silenceThreshold} seconds</p>
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

        {/* Auto-stop settings */}
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <input
              type="checkbox"
              id="autoStop"
              checked={autoStopEnabled}
              onChange={(e) => setAutoStopEnabled(e.target.checked)}
              disabled={isRecording}
            />
            <label htmlFor="autoStop" style={{ fontWeight: '500' }}>Auto-stop on silence</label>
          </div>
          
          {autoStopEnabled && (
            <div style={{ marginLeft: '24px' }}>
              <label style={{ fontSize: '14px', color: '#64748b' }}>
                Silence threshold: {silenceThreshold} seconds
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={silenceThreshold}
                onChange={(e) => setSilenceThreshold(parseInt(e.target.value))}
                disabled={isRecording}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          )}
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
            {autoStopEnabled && (
              <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>
                (Auto-stop after {silenceThreshold}s silence)
              </span>
            )}
          </div>
        )}
      </div>

      {(transcript || partialTranscript) && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Transcript</h3>
            {transcript && (
              <button
                onClick={handleDownload}
                style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Download TXT
              </button>
            )}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', minHeight: '100px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {transcript}
              <span style={{ color: '#94a3b8' }}>{partialTranscript}</span>
            </p>
          </div>
        </div>
      )}

      {/* Documentation */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>How Auto-Stop Works</h2>
        <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '6px', fontSize: '14px' }}>
          <p style={{ margin: '0 0 8px 0' }}>This feature uses <strong>RMS (Root Mean Square)</strong> to calculate audio amplitude:</p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Continuously monitors audio level from microphone</li>
            <li>When amplitude drops below threshold (silence detected)</li>
            <li>Starts a countdown timer</li>
            <li>If silence continues for X seconds → auto-stop</li>
            <li>If user speaks again → timer resets</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
