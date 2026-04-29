# AWS Transcribe - Next.js Integration

This project shows how to integrate AWS Transcribe with Next.js.

## Features

- **File Upload Transcription** - Upload audio/video files for batch transcription
- **Realtime Microphone Transcription** - Live transcription from browser microphone using WebSocket

## Structure

```
aws-transcribe-nextjs/
├── server.js                   # Custom Next.js server with WebSocket
├── simple-example.js           # Standalone Node.js (no Next.js)
├── src/
│   ├── app/
│   │   ├── api/transcribe/     # API routes for file upload
│   │   └── page.tsx            # Main page with tabs
│   └── components/
│       ├── TranscribeForm.tsx  # File upload UI
│       └── RealtimeTranscribe.tsx # Realtime mic UI
└── README.md
```

## Quick Start

```bash
cd aws-transcribe-nextjs
npm install
cp .env.local.example .env.local
# Edit .env.local with your AWS credentials
npm run dev
```

Open http://localhost:3000

## Configuration

Edit `.env.local`:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-1
S3_BUCKET=your-bucket-name
```

## Usage

### File Upload Mode

1. Select audio/video file (MP3, WAV, FLAC, MP4, MOV, AVI, MKV)
2. Enable "Auto-detect language" or choose specific language
3. Click "Start Transcription"
4. Wait for completion (typically 30-60 seconds)
5. View and download transcript

### Realtime Microphone Mode

1. Click "Realtime Mic" tab
2. Select language
3. Click "Start Recording"
4. Allow microphone access when prompted
5. Speak into your microphone
6. Transcript appears in real-time
7. Click "Stop Recording" when done

## API Endpoints

### POST /api/transcribe

Start transcription job (file upload).

**Form Data:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `file` | Yes | Audio/video file to transcribe |
| `identifyLanguage` | No | Auto-detect language (true/false, default: true) |
| `language` | No | Specific language code (en-US, id-ID, etc.) |

**Example:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3" \
  -F "identifyLanguage=true" \
  -F "language=id-ID"
```

### GET /api/transcribe?jobId={id}

Check job status.

### GET /api/transcribe/{jobId}

Get transcript text.

### GET /api/transcribe/stream?jobId={id}

Server-Sent Events stream for job status updates.

### WebSocket /ws/transcribe

Realtime transcription from microphone.

**Messages:**

Client → Server:
```json
{ "type": "start", "language": "id-ID", "sampleRate": 48000 }
{ "type": "audio", "audio": "<base64-encoded-pcm-audio>" }
{ "type": "stop" }
```

Server → Client:
```json
{ "type": "transcript", "text": "Hello world", "isPartial": true }
{ "type": "transcript", "text": "Hello world", "isPartial": false }
{ "type": "error", "error": "Error message" }
```

## Standalone Node.js Example

If you want to use AWS Transcribe without Next.js:

```bash
node simple-example.js
```

**Configuration in `simple-example.js`:**
```javascript
const SETTINGS = {
  identifyLanguage: true,      // Auto-detect language
  language: 'id-ID',           // Language code (if identifyLanguage=false)
};
```

## Supported Formats

**Audio:** MP3, WAV, FLAC, M4A, OGG, AMR, WEBM  
**Video:** MP4, MOV, AVI, MKV, WEBM

## Architecture

### File Upload Flow

```
1. User uploads file → Next.js API
2. Next.js uploads to S3
3. Next.js starts Transcribe job
4. Transcribe processes audio
5. Result saved to S3
6. Next.js fetches and returns transcript
```

### Realtime Flow

```
1. Browser captures microphone (MediaStream)
2. AudioContext converts to PCM 16-bit
3. WebSocket sends audio chunks to server
4. Server streams to AWS Transcribe Streaming
5. AWS returns partial/final transcripts
6. Server sends results back to browser via WebSocket
```

## Requirements

- Node.js 18+
- AWS Account with Transcribe and S3 access
- For realtime: Region must support Transcribe Streaming (us-east-1, us-west-2, eu-west-1, ap-southeast-1, etc.)

## References

- [AWS Transcribe Documentation](https://docs.aws.amazon.com/transcribe/)
- [AWS Transcribe Streaming](https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html)
- [AWS Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)

## .gitignore

The following files are ignored in Git:

- `.env`, `.env.local` - Contains AWS credentials (NEVER commit!)
- `node_modules/` - Dependencies
- `.next/`, `out/` - Build artifacts
- `*.log` - Log files
