import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// CORS configuration for private buckets
const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: [
        'Content-Type',
        'Content-MD5',
        'x-amz-content-sha256',
        'x-amz-date',
        'x-amz-user-agent',
        'x-amz-meta-*'
      ],
      AllowedMethods: ['PUT', 'POST', 'GET'],
      AllowedOrigins: [
        'https://vixter.com',
        'https://www.vixter.com',
        'https://vixter.com.br',
        'https://www.vixter.com.br',
        'https://vixter-react.vercel.app',
        'https://vixter-react.vercel.app/*',
        'https://vixter-react.vercel.app/vixies',
        'https://vixter-react.vercel.app/vixink',
        'https://vixter-react-llyd.vercel.app',
        'https://vixter-react-llyd.vercel.app/*'
      ],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600
    }
  ]
};

async function configureCorsForBucket(bucketName) {
  try {
    console.log(`Configurando CORS para bucket: ${bucketName}`);
    
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsConfiguration
    });

    await r2Client.send(command);
    console.log(`✅ CORS configurado com sucesso para ${bucketName}`);
  } catch (error) {
    console.error(`❌ Erro ao configurar CORS para ${bucketName}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando configuração de CORS para buckets privados...\n');

  // Configure CORS for KYC bucket
  const kycBucket = process.env.R2_KYC_BUCKET_NAME || 'vixter-kyc-private';
  await configureCorsForBucket(kycBucket);

  // Configure CORS for Pack Content bucket
  const packContentBucket = process.env.R2_PACK_CONTENT_BUCKET_NAME || 'vixter-pack-content-private';
  await configureCorsForBucket(packContentBucket);

  console.log('\n✨ Configuração de CORS concluída!');
  console.log('\n📋 Resumo das configurações:');
  console.log('• Headers permitidos: Content-Type, Content-MD5, x-amz-content-sha256, x-amz-date, x-amz-user-agent, x-amz-meta-*');
  console.log('• Métodos permitidos: PUT, POST, GET');
  console.log('• Origens permitidas: vixter.com, vixter-react.vercel.app, vixter-react-llyd.vercel.app');
  console.log('• Max Age: 3600 segundos (1 hora)');
}

main().catch(console.error);
