import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generatePackContentDownloadSignedUrl } from '@/lib/r2';

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

    // Validate that it's a pack content key (new organized structure)
    if (!key.startsWith('pack-content/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid key: Must be a pack content key' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Validate that the key belongs to the requesting user
    if (!key.startsWith(`pack-content/${user.uid}/`)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You can only access your own pack content' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // TODO: Add purchase verification here
    // For now, we'll allow access, but in production you should verify:
    // 1. User has purchased this pack
    // 2. Pack is still active
    // 3. User has permission to access this content

    // Generate signed URL for downloading pack content
    const downloadUrl = await generatePackContentDownloadSignedUrl(key, expiresIn);

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
    console.error('Error generating pack content download URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate download URL' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  }
});
