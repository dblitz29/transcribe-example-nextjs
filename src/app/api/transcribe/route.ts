import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const transcribe = new AWS.TranscribeService();
const s3 = new AWS.S3();

/**
 * POST /api/transcribe
 * Start transcription job
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const identifyLanguage = formData.get('identifyLanguage') === 'true';
    const language = formData.get('language') as string;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const formats: Record<string, string> = { mp3: 'mp3', wav: 'wav', flac: 'flac', m4a: 'mp4', mp4: 'mp4', mov: 'mp4', avi: 'avi', mkv: 'mkv' };
    if (!ext || !formats[ext]) {
      return NextResponse.json(
        { error: 'Invalid file. Supported: mp3, wav, flac, m4a, mp4, mov, avi, mkv' },
        { status: 400 }
      );
    }

    // Upload to S3
    const fileName = `transcribe/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    await s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }).promise();

    // Start transcription
    const jobName = `transcribe-${Date.now()}`;
    const params: any = {
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: `s3://${process.env.S3_BUCKET}/${fileName}` },
      MediaFormat: formats[ext],
      Settings: { ShowSpeakerLabels: false },
    };

    if (identifyLanguage) {
      params.IdentifyLanguage = true;
      params.LanguageOptions = ['en-US', 'id-ID', 'ja-JP', 'es-US', 'fr-FR', 'de-DE', 'pt-BR'];
    } else {
      if (!language) return NextResponse.json({ error: 'Language is required' }, { status: 400 });
      params.LanguageCode = language;
    }

    const response = await transcribe.startTranscriptionJob(params).promise();

    return NextResponse.json({
      success: true,
      jobId: response.TranscriptionJob?.TranscriptionJobName,
      status: response.TranscriptionJob?.TranscriptionJobStatus,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/transcribe
 * Check job status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const response = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobId }).promise();

    return NextResponse.json({ success: true, job: response.TranscriptionJob });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
