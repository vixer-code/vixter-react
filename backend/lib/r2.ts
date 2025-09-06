import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
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
  expiresIn: number = 3600 // 1 hour
): Promise<SignedUrlResult> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

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
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
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
  // For now, we'll use the original key
  // In the future, this could generate a watermarked version
  const watermarkedKey = `watermarked/${userId}/${originalKey}`;
  
  const downloadUrl = await generateDownloadSignedUrl(watermarkedKey, expiresIn);
  
  return {
    downloadUrl,
    key: watermarkedKey,
    expires: Date.now() + (expiresIn * 1000),
  };
}

/**
 * Delete media from R2
 */
export async function deleteMedia(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
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
 * Rename/move media file in R2 (copy to new location and delete original)
 */
export async function renameMedia(oldKey: string, newKey: string): Promise<boolean> {
  try {
    // Copy the file to the new location
    const copyCommand = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${oldKey}`,
      Key: newKey,
    });

    await r2Client.send(copyCommand);

    // Delete the original file
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: oldKey,
    });

    await r2Client.send(deleteCommand);
    
    return true;
  } catch (error) {
    console.error('Error renaming media in R2:', error);
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

export default r2Client;
