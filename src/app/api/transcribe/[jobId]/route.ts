import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const transcribe = new AWS.TranscribeService();

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;
    const response = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobId }).promise();

    if (response.TranscriptionJob?.TranscriptionJobStatus !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Job not completed' });
    }

    const uri = response.TranscriptionJob.Transcript?.TranscriptFileUri;
    if (!uri) return NextResponse.json({ success: false, error: 'Transcript not found' });

    const res = await fetch(uri);
    const data = await res.json();

    return NextResponse.json({ success: true, transcript: data.results.transcripts[0].transcript });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
