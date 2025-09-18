import { SignJWT } from 'jose';
import { getServiceAccountCredentials } from '@/config/service-account';

// Secret key for signing URLs (use service account private key)
const getSecretKey = () => {
  const credentials = getServiceAccountCredentials();
  return new TextEncoder().encode(credentials.private_key || 'fallback-secret');
};

export interface SignedUrlPayload {
  userId: string;
  username: string;
  packId: string;
  orderId: string;
  contentKey: string;
  vendorId: string;
  vendorUsername: string;
  exp: number;
  iat: number;
  [key: string]: any; // Add index signature for JWT compatibility
}

/**
 * Generate a signed URL for accessing pack content
 * @param userId - User ID who purchased the pack
 * @param username - Username for watermarking
 * @param packId - Pack ID
 * @param orderId - Order ID
 * @param contentKey - Content key in R2
 * @param vendorId - Vendor ID for watermarking
 * @param vendorUsername - Vendor username for watermarking
 * @param expiresInMinutes - URL expiration time in minutes (default: 2)
 * @returns Signed URL with JWT token
 */
export async function generateSignedUrl(
  userId: string,
  username: string,
  packId: string,
  orderId: string,
  contentKey: string,
  vendorId: string,
  vendorUsername: string,
  expiresInMinutes: number = 2
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInMinutes * 60);

  const payload: SignedUrlPayload = {
    userId,
    username,
    packId,
    orderId,
    contentKey,
    vendorId,
    vendorUsername,
    exp,
    iat: now
  };

  const secretKey = getSecretKey();
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secretKey);

  // Return only the JWT token (not the full URL)
  return jwt;
}

/**
 * Verify and decode a signed URL token
 * @param token - JWT token from signed URL
 * @returns Decoded payload or null if invalid
 */
export async function verifySignedUrl(token: string): Promise<SignedUrlPayload | null> {
  try {
    const { jwtVerify } = await import('jose');
    const secretKey = getSecretKey();
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256']
    });

    return payload as SignedUrlPayload;
  } catch (error) {
    console.error('Failed to verify signed URL:', error);
    return null;
  }
}
