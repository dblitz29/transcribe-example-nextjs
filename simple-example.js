// Simple AWS Transcribe Example
// Run: node simple-example.js

const AWS = require('aws-sdk');
const fs = require('fs');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const transcribe = new AWS.TranscribeService();
const s3 = new AWS.S3();

// ===== CONFIGURATION =====
const FILE_PATH = './audio.mp3';  // Change this to your file path
const S3_BUCKET = process.env.S3_BUCKET;

// Transcription settings
const SETTINGS = {
  identifyLanguage: true,      // Auto-detect language (true) or specify (false)
  language: 'id-ID',           // Language code (used if identifyLanguage=false)
};

async function main() {
  // 1. Upload file to S3
  console.log('Uploading file to S3...');
  const fileBuffer = fs.readFileSync(FILE_PATH);
  const fileName = `transcribe/${Date.now()}-simple-test.mp3`;
  
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: fileName,
    Body: fileBuffer,
  }).promise();
  
  console.log('Upload complete!');
  
  // 2. Start transcription
  const jobName = `simple-transcribe-${Date.now()}`;
  const s3Uri = `s3://${S3_BUCKET}/${fileName}`;
  
  console.log('Starting transcription...');
  console.log('S3 URI:', s3Uri);
  console.log('Settings:', SETTINGS);
  
  const params = {
    TranscriptionJobName: jobName,
    Media: { MediaFileUri: s3Uri },
    MediaFormat: 'mp3',
    Settings: { ShowSpeakerLabels: false },
  };
  
  if (SETTINGS.identifyLanguage) {
    params.IdentifyLanguage = true;
    params.LanguageOptions = ['en-US', 'id-ID', 'ja-JP', 'es-US', 'fr-FR', 'de-DE', 'pt-BR'];
  } else {
    params.LanguageCode = SETTINGS.language;
  }
  
  const response = await transcribe.startTranscriptionJob(params).promise();
  console.log('Job started:', response.TranscriptionJob.TranscriptionJobName);
  
  // 3. Wait for completion
  console.log('Waiting for transcription...');
  let jobStatus;
  
  do {
    await new Promise(r => setTimeout(r, 5000));
    const status = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobName }).promise();
    jobStatus = status.TranscriptionJob.TranscriptionJobStatus;
    console.log('Status:', jobStatus);
  } while (jobStatus === 'IN_PROGRESS');
  
  if (jobStatus === 'COMPLETED') {
    // 4. Get transcript
    const uri = response.TranscriptionJob.Transcript.TranscriptFileUri;
    const result = await fetch(uri);
    const data = await result.json();
    
    console.log('\n' + '='.repeat(50));
    console.log('TRANSCRIPT:');
    console.log(data.results.transcripts[0].transcript);
    console.log('='.repeat(50));
  } else {
    console.log('Transcription failed:', response.TranscriptionJob.FailureReason);
  }
}

main().catch(console.error);
