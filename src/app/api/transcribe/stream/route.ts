import { NextRequest } from 'next/server';
import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const transcribe = new AWS.TranscribeService();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        while (true) {
          const response = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobId }).promise();
          const job = response.TranscriptionJob;
          const status = job?.TranscriptionJobStatus;

          send({ type: 'status', status, job });

          if (status === 'COMPLETED') {
            const uri = job?.Transcript?.TranscriptFileUri;
            if (uri) {
              const res = await fetch(uri);
              const data = await res.json();
              send({ type: 'completed', transcript: data.results.transcripts[0].transcript });
            }
            break;
          } else if (status === 'FAILED') {
            send({ type: 'failed', error: job?.FailureReason || 'Transcription failed' });
            break;
          }

          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (error: any) {
        send({ type: 'error', error: error.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
