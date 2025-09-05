import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { deleteMedia } from '@/lib/r2';

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const DELETE = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { key } = body;

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

    // Delete media from R2
    const success = await deleteMedia(key);

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete media' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          key,
          deleted: true,
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  } catch (error) {
    console.error('Error deleting media:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete media' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      }
    );
  }
});
