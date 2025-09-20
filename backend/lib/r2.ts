import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize R2 client (Cloudflare R2 is S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const KYC_BUCKET_NAME = process.env.R2_KYC_BUCKET_NAME || 'vixter-kyc-private';
const PACK_CONTENT_BUCKET_NAME = process.env.R2_PACK_CONTENT_BUCKET_NAME || 'vixter-pack-content-private';

export interface MediaUploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface SignedUrlResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface WatermarkUrlResult {
  downloadUrl: string;
  key: string;
  expires: number;
}

/**
 * Generate a signed URL for uploading media to R2
 */
export async function generateUploadSignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600, // 1 hour
  bucketName?: string
): Promise<SignedUrlResult> {
  const bucket = bucketName || BUCKET_NAME;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  
  // Only generate public URL for public bucket
  let publicUrl = '';
  if (bucket === BUCKET_NAME) {
    const baseUrl = process.env.R2_PUBLIC_URL || 'https://media.vixter.com.br';
    // Ensure the URL has the correct protocol
    const normalizedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    publicUrl = `${normalizedUrl}/${key}`;
  }

  return {
    uploadUrl,
    key,
    publicUrl,
  };
}

/**
 * Generate a signed URL for downloading media from R2
 */
export async function generateDownloadSignedUrl(
  key: string,
  expiresIn: number = 3600, // 1 hour
  bucketName?: string
): Promise<string> {
  const bucket = bucketName || BUCKET_NAME;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a watermarked URL for pack content (unique per user)
 */
export async function generateWatermarkUrl(
  originalKey: string,
  userId: string,
  expiresIn: number = 3600 // 1 hour
): Promise<WatermarkUrlResult> {
  // For now, we'll use the original key from pack content bucket
  // In the future, this could generate a watermarked version
  const watermarkedKey = `watermarked/${userId}/${originalKey}`;
  
  const downloadUrl = await generatePackContentDownloadSignedUrl(watermarkedKey, expiresIn);
  
  return {
    downloadUrl,
    key: watermarkedKey,
    expires: Date.now() + (expiresIn * 1000),
  };
}

/**
 * Delete media from R2
 */
export async function deleteMedia(key: string, bucketName?: string): Promise<boolean> {
  try {
    const bucket = bucketName || BUCKET_NAME;
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting media from R2:', error);
    return false;
  }
}

/**
 * Generate a unique key for media files
 */
export function generateMediaKey(
  userId: string,
  type: 'pack' | 'service' | 'profile' | 'message',
  itemId?: string,
  originalName?: string
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName ? originalName.split('.').pop() : 'bin';
  
  if (itemId) {
    return `${type}s/${itemId}/${timestamp}_${randomId}.${extension}`;
  }
  
  return `${type}s/${userId}/${timestamp}_${randomId}.${extension}`;
}

/**
 * Generate a unique key for pack content (for watermarking)
 */
export function generatePackContentKey(
  packId: string,
  userId: string,
  originalName?: string
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName ? originalName.split('.').pop() : 'bin';
  
  return `packs/${packId}/content/${userId}/${timestamp}_${randomId}.${extension}`;
}

/**
 * Generate a key for pack content with user/pack organization
 * Structure: pack-content/{userId}/{packId}/{filename}
 */
export function generatePackContentKeyOrganized(
  userId: string,
  packId: string,
  originalName?: string
): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName ? originalName.split('.').pop() : 'bin';
  const filename = originalName ? 
    `${timestamp}_${randomId}_${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}` : 
    `${timestamp}_${randomId}.${extension}`;
  
  return `pack-content/${userId}/${packId}/${filename}`;
}

/**
 * Generate a signed URL for uploading KYC documents to private bucket
 */
export async function generateKycUploadSignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<Omit<SignedUrlResult, 'publicUrl'>> {
  const command = new PutObjectCommand({
    Bucket: KYC_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

  return {
    uploadUrl,
    key,
  };
}

/**
 * Generate a signed URL for downloading KYC documents from private bucket
 */
export async function generateKycDownloadSignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  return await generateDownloadSignedUrl(key, expiresIn, KYC_BUCKET_NAME);
}

/**
 * Delete KYC document from private bucket
 */
export async function deleteKycDocument(key: string): Promise<boolean> {
  return await deleteMedia(key, KYC_BUCKET_NAME);
}

/**
 * Generate a signed URL for uploading pack content to private bucket
 */
export async function generatePackContentUploadSignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour
): Promise<Omit<SignedUrlResult, 'publicUrl'>> {
  const command = new PutObjectCommand({
    Bucket: PACK_CONTENT_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

  return {
    uploadUrl,
    key,
  };
}

/**
 * Generate a signed URL for downloading pack content from private bucket
 */
export async function generatePackContentDownloadSignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  return await generateDownloadSignedUrl(key, expiresIn, PACK_CONTENT_BUCKET_NAME);
}

/**
 * Delete pack content from private bucket
 */
export async function deletePackContent(key: string): Promise<boolean> {
  return await deleteMedia(key, PACK_CONTENT_BUCKET_NAME);
}

export default r2Client;
