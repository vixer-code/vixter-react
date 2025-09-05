import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { generateDownloadSignedUrl, generateWatermarkUrl } from '@/lib/r2';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { 
      key, 
      watermarked = false, // For pack content that needs watermarking
      expiresIn = 3600 
    } = body;

    // Validate required fields
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: key' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    let downloadUrl: string;
    let resultKey: string;

    if (watermarked) {
      // Generate watermarked URL for pack content
      const watermarkResult = await generateWatermarkUrl(key, user.uid, expiresIn);
      downloadUrl = watermarkResult.downloadUrl;
      resultKey = watermarkResult.key;
    } else {
      // Generate regular download URL
      downloadUrl = await generateDownloadSignedUrl(key, expiresIn);
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
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  } catch (error) {
    console.error('Error generating download URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate download URL' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  }
});
