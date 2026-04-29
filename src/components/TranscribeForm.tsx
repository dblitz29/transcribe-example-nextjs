'use client';

import { useState } from 'react';

export default function TranscribeForm() {
  const [file, setFile] = useState<File | null>(null);
  const [identifyLanguage, setIdentifyLanguage] = useState(true);
  const [language, setLanguage] = useState('id-ID');
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const languages = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'id-ID', label: 'Indonesian' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'es-US', label: 'Spanish (US)' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setJobId(null);
    setTranscript('');
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('identifyLanguage', identifyLanguage.toString());
    if (!identifyLanguage) formData.append('language', language);

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId);
      setStatus('processing');
      pollTranscription(data.jobId);
    } catch (err: any) {
      setError(err.message);
      setIsUploading(false);
    }
  };

  const pollTranscription = (id: string) => {
    const eventSource = new EventSource(`/api/transcribe/stream?jobId=${id}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setStatus(data.status.toLowerCase());
      } else if (data.type === 'completed') {
        setTranscript(data.transcript);
        setStatus('completed');
        setIsUploading(false);
        eventSource.close();
      } else if (data.type === 'failed' || data.type === 'error') {
        setError(data.error || 'Transcription failed');
        setStatus('failed');
        setIsUploading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('Connection lost');
      setIsUploading(false);
      eventSource.close();
    };
  };

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${jobId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Transcribe</h1>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>{error}</p>
        </div>
      )}

      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>File Audio/Video</label>
            <input
              type="file"
              accept=".mp3,.wav,.flac,.m4a,.mp4,.mov,.avi,.mkv"
              onChange={handleFileChange}
              disabled={isUploading}
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Support: MP3, WAV, FLAC, M4A, MP4, MOV, AVI, MKV</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="identifyLanguage"
              checked={identifyLanguage}
              onChange={(e) => setIdentifyLanguage(e.target.checked)}
              disabled={isUploading}
            />
            <label htmlFor="identifyLanguage" style={{ fontWeight: '500' }}>Auto-detect language</label>
          </div>

          {!identifyLanguage && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Select Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isUploading}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                {languages.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isUploading}
            style={{
              padding: '10px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: !file || isUploading ? 'not-allowed' : 'pointer',
              opacity: !file || isUploading ? 0.6 : 1
            }}
          >
            {isUploading ? 'Processing...' : 'Start Transcription'}
          </button>
        </form>
      </div>

      {(status === 'processing' || status === 'completed' || status === 'failed') && (
        <div style={{ marginTop: '20px' }}>
          {status === 'processing' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '16px', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontWeight: '600', color: '#1e40af' }}>Transcription in progress...</p>
              <p style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>Job ID: {jobId}</p>
            </div>
          )}

          {status === 'completed' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Transcript Ready</h2>
                <button
                  onClick={handleDownload}
                  style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Download TXT
                </button>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', maxHeight: '300px', overflow: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px', fontFamily: 'monospace' }}>{transcript}</pre>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '16px', borderRadius: '6px' }}>
              <p style={{ margin: 0, color: '#991b1b' }}>Transcription failed. Please try again.</p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>API Documentation</h2>
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px', color: '#cbd5e1' }}>
          <div><span style={{ color: '#4ade80' }}>POST</span> <span style={{ color: '#60a5fa' }}>api/transcribe</span></div>
          <div style={{ marginLeft: '16px' }}>
            <p style={{ margin: '4px 0', color: '#94a3b8' }}>Form Data:</p>
            <ul style={{ margin: '8px 0', paddingLeft: '16px', color: '#94a3b8' }}>
              <li><code style={{ background: '#334155', padding: '2px 4px', borderRadius: '3px', color: '#fbbf24' }}>file</code> (required)</li>
              <li><code style={{ background: '#334155', padding: '2px 4px', borderRadius: '3px', color: '#fbbf24' }}>identifyLanguage</code> - true/false</li>
              <li><code style={{ background: '#334155', padding: '2px 4px', borderRadius: '3px', color: '#fbbf24' }}>language</code> - en-US, id-ID</li>
            </ul>
          </div>
          <div><span style={{ color: '#4ade80' }}>GET</span> <span style={{ color: '#60a5fa' }}>api/transcribe?jobId={jobId || '{jobId}'}</span></div>
          <div><span style={{ color: '#4ade80' }}>GET</span> <span style={{ color: '#60a5fa' }}>api/transcribe/{jobId || '{jobId}'}</span></div>
        </div>
      </div>
    </div>
  );
}
