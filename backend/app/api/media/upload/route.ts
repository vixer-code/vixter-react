import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generateUploadSignedUrl, generateMediaKey } from '@/lib/r2';

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
    const validTypes = ['pack', 'service', 'profile', 'message', 'kyc'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be one of: pack, service, profile, message, kyc' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Use custom key if provided, otherwise generate one
    const { key: customKey } = body;
    const key = customKey || generateMediaKey(user.uid, type, itemId, originalName);

    // Generate signed URL for upload
    const signedUrlResult = await generateUploadSignedUrl(key, contentType, expiresIn);

    // For KYC documents, don't return public URL - they should be private
    const responseData: any = {
      uploadUrl: signedUrlResult.uploadUrl,
      key: signedUrlResult.key,
      expiresIn,
    };

    // Only return publicUrl for non-KYC types
    if (type !== 'kyc') {
      responseData.publicUrl = signedUrlResult.publicUrl;
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