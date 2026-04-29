require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} = require('@aws-sdk/client-transcribe-streaming');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// AWS Transcribe Streaming Client
const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Audio queue per connection
class AudioQueue {
  constructor() {
    this.queue = [];
    this.waiting = null;
  }

  push(chunk) {
    if (this.waiting) {
      this.waiting(chunk);
      this.waiting = null;
    } else {
      this.queue.push(chunk);
    }
  }

  stop() {
    if (this.waiting) {
      this.waiting(null);
      this.waiting = null;
    }
    this.stopped = true;
  }

  async get() {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }
    if (this.stopped) {
      return null;
    }
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  async *generator() {
    while (true) {
      const chunk = await this.get();
      if (chunk === null) break;
      yield { AudioEvent: { AudioChunk: chunk } };
    }
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    let audioQueue = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'start') {
          audioQueue = new AudioQueue();

          const params = {
            LanguageCode: message.language || 'id-ID',
            MediaEncoding: 'pcm',
            MediaSampleRateHertz: message.sampleRate || 48000,
            AudioStream: audioQueue.generator(),
          };

          // Run transcription in background
          (async () => {
            try {
              const command = new StartStreamTranscriptionCommand(params);
              const response = await transcribeClient.send(command);
              
              // Track utterances
              const utterances = new Map();

              for await (const event of response.TranscriptResultStream) {
                if (event.TranscriptEvent) {
                  const results = event.TranscriptEvent.Transcript?.Results || [];
                  for (const result of results) {
                    const transcript = result.Alternatives?.[0]?.Transcript;
                    const resultId = result.ResultId || '';
                    
                    if (transcript) {
                      if (result.IsPartial) {
                        // Update partial utterance
                        utterances.set(resultId, transcript);
                      } else {
                        // Final result - remove from partials
                        utterances.delete(resultId);
                        ws.send(JSON.stringify({
                          type: 'transcript',
                          text: transcript,
                          isPartial: false,
                        }));
                      }
                      
                      // Send current partials combined
                      const allPartials = Array.from(utterances.values()).join(' ');
                      if (allPartials) {
                        ws.send(JSON.stringify({
                          type: 'transcript',
                          text: allPartials,
                          isPartial: true,
                        }));
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error('Transcribe error:', err);
              ws.send(JSON.stringify({ type: 'error', error: err.message }));
            }
          })();
        } else if (message.type === 'audio' && audioQueue) {
          const buffer = Buffer.from(message.audio, 'base64');
          audioQueue.push(buffer);
        } else if (message.type === 'stop' && audioQueue) {
          audioQueue.stop();
          audioQueue = null;
        }
      } catch (err) {
        console.error('Message error:', err);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      if (audioQueue) {
        audioQueue.stop();
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready at ws://${hostname}:${port}/ws/transcribe`);
  });
});
