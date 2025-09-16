import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generateKycDownloadSignedUrl } from '@/lib/r2';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { key, expiresIn = 3600 } = body;

    // Validate required fields
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: key' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Validate that the key belongs to the requesting user
    if (!key.startsWith(`KYC/${user.uid}/`)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You can only access your own KYC documents' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Generate signed URL for downloading KYC document
    const downloadUrl = await generateKycDownloadSignedUrl(key, expiresIn);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          downloadUrl,
          key,
          expiresIn,
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  } catch (error) {
    console.error('Error generating KYC download URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate download URL' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  }
});

