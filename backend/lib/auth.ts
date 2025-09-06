import { NextRequest } from 'next/server';
import { auth } from './firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
}

/**
 * Verify Firebase ID token from request headers
 */
export async function verifyFirebaseToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return null;
    }

    // Verify the token with Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);
    
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await verifyFirebaseToken(request);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(request, user);
  };
}

/**
 * CORS headers for API responses
 */
export function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://vixter-react.vercel.app',
    'https://vixter-react-llyd.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '') ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCors(request: NextRequest): Response {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}
