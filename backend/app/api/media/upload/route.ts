import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generateUploadSignedUrl, generateMediaKey, generateKycUploadSignedUrl, generatePackContentUploadSignedUrl, generatePackContentKeyOrganized } from '@/lib/r2';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { 
      type, 
      contentType, 
      originalName, 
      itemId, // packId or serviceId
      expiresIn = 3600 
    } = body;

    // Validate required fields
    if (!type || !contentType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, contentType' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Validate type
    const validTypes = ['pack', 'service', 'profile', 'message', 'kyc', 'pack-content'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be one of: pack, service, profile, message, kyc, pack-content' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Use custom key if provided, otherwise generate one
    const { key: customKey } = body;
    let key;
    
    if (customKey) {
      key = customKey;
    } else if (type === 'pack-content') {
      // Use organized structure for pack content
      key = generatePackContentKeyOrganized(user.uid, itemId, originalName);
    } else {
      key = generateMediaKey(user.uid, type, itemId, originalName);
    }

    let responseData: any;

    // For KYC documents, use private bucket
    if (type === 'kyc') {
      const signedUrlResult = await generateKycUploadSignedUrl(key, contentType, expiresIn);
      responseData = {
        uploadUrl: signedUrlResult.uploadUrl,
        key: signedUrlResult.key,
        expiresIn,
        // No publicUrl for KYC documents
      };
    } else if (type === 'pack-content') {
      // For pack content, use private bucket
      const signedUrlResult = await generatePackContentUploadSignedUrl(key, contentType, expiresIn);
      responseData = {
        uploadUrl: signedUrlResult.uploadUrl,
        key: signedUrlResult.key,
        expiresIn,
        // No publicUrl for pack content
      };
    } else {
      // For other media types (pack covers, service media, etc.), use public bucket
      const signedUrlResult = await generateUploadSignedUrl(key, contentType, expiresIn);
      responseData = {
        uploadUrl: signedUrlResult.uploadUrl,
        key: signedUrlResult.key,
        publicUrl: signedUrlResult.publicUrl,
        expiresIn,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate upload URL' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  }
});