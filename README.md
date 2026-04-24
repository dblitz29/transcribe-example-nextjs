# AWS Transcribe - Next.js Integration

This project shows how to integrate AWS Transcribe with Next.js.

## Structure

```
aws-transcribe-nextjs/
├── simple-example.js          # Standalone Node.js (no Next.js)
├── src/
│   ├── app/
│   │   ├── api/transcribe/    # API routes
│   │   └── page.tsx           # Simple Next.js page
│   └── components/
│       └── TranscribeForm.tsx # Full-featured UI
└── README.md
```

## Quick Start (Next.js)

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

1. Select audio/video file (MP3, WAV, FLAC, MP4, MOV, AVI, MKV)
2. Enable "Auto-detect language" or choose specific language
3. Click "Start Transcription"
4. Wait for completion (typically 30-60 seconds)
5. View and download transcript

## API Endpoints

### POST /api/transcribe

Start transcription job.

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

## Flow

```
1. User uploads file → Next.js API
2. Next.js uploads to S3
3. Next.js starts Transcribe job
4. Transcribe processes audio
5. Result saved to S3
6. Next.js fetches and returns transcript
```

## References

- [AWS Transcribe Documentation](https://docs.aws.amazon.com/transcribe/)
- [AWS Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)

## .gitignore

The following files are ignored in Git:

- `.env`, `.env.local` - Contains AWS credentials (NEVER commit!)
- `node_modules/` - Dependencies
- `.next/`, `out/` - Build artifacts
- `*.log` - Log files
