import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generatePackContentDownloadSignedUrl, generateWatermarkUrl } from '@/lib/r2';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { 
      key, 
      userId = null, 
      packId = null, 
      orderId = null,
      watermarked = false,
      expiresIn = 3600 
    } = body;

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

    let downloadUrl: string;
    let resultKey: string;

    if (watermarked && userId) {
      // Generate watermarked URL for pack content
      const watermarkResult = await generateWatermarkUrl(key, userId, expiresIn);
      downloadUrl = watermarkResult.downloadUrl;
      resultKey = watermarkResult.key;
    } else {
      // Generate regular download URL for pack content
      downloadUrl = await generatePackContentDownloadSignedUrl(key, expiresIn);
      resultKey = key;
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          downloadUrl,
          key: resultKey,
          watermarked,
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
