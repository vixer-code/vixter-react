import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { GoogleAuth } from 'google-auth-library';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  // Check if we have the private key (it might be in FIREBASE_PROJECT_ID due to Vercel config)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (privateKey && clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
    const serviceAccount = {
      projectId: 'vixter-451b3',
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail: clientEmail,
    };

    initializeApp({
      credential: cert(serviceAccount),
      projectId: 'vixter-451b3',
    });
  } else {
    console.warn('Firebase Admin SDK credentials not found, skipping initialization');
  }
}

// Initialize Firestore only if Firebase Admin is initialized
let db: any = null;
try {
  db = getFirestore();
} catch (error) {
  console.warn('Firestore not available:', error);
}

export async function GET(request: NextRequest) {
  try {
    console.log('Stream endpoint called:', request.url);
    
    const { searchParams } = new URL(request.url);
    const packId = searchParams.get('packId');
    const orderId = searchParams.get('orderId');
    const contentKey = searchParams.get('contentKey');
    const username = searchParams.get('username');
    const token = searchParams.get('token');

    // Get token from Authorization header if available
    const authHeader = request.headers.get('authorization');
    const userToken = authHeader?.replace('Bearer ', '') || token;

    console.log('Parameters:', { packId, orderId, contentKey, username, token: userToken ? 'present' : 'missing' });
    console.log('Token length:', userToken ? userToken.length : 0);
    console.log('Token start:', userToken ? userToken.substring(0, 50) + '...' : 'missing');
    console.log('Token end:', userToken ? '...' + userToken.substring(userToken.length - 50) : 'missing');

    if (!packId || !orderId || !contentKey || !username || !userToken) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify user access by checking Firebase token
    try {
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(userToken);
      console.log('User verified:', decodedToken.uid);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Call Cloud Function to get watermarked content
    const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';
    
    // Ensure contentKey has the correct format for R2
    const formattedContentKey = contentKey.startsWith('pack-content/') 
      ? contentKey 
      : `pack-content/${contentKey}`;
    
    const params = new URLSearchParams({
      packId,
      orderId,
      contentKey: formattedContentKey,
      username,
      token: userToken
    });

    console.log('Calling Cloud Function:', `${cloudFunctionUrl}?${params.toString()}`);
    
    // Get service-to-service authentication token
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(cloudFunctionUrl);
    const serviceToken = await client.idTokenProvider.fetchIdToken(cloudFunctionUrl);
    
    console.log('Service token obtained:', serviceToken ? 'present' : 'missing');
    
    // Call Cloud Function with service-to-service authentication
    const cloudFunctionResponse = await fetch(`${cloudFunctionUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceToken}`, // Service-to-service token
        'X-Serverless-Authorization': `Bearer ${userToken}` // User token for validation
      }
    });

    console.log('Cloud Function response status:', cloudFunctionResponse.status);

    if (!cloudFunctionResponse.ok) {
      throw new Error(`Cloud Function error: ${cloudFunctionResponse.status}`);
    }

    // Get the content type and data
    const contentType = cloudFunctionResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = cloudFunctionResponse.headers.get('content-length');
    const contentData = await cloudFunctionResponse.arrayBuffer();

    // Determine if it's a video for proper streaming headers
    const isVideo = contentType.startsWith('video/');
    const isAudio = contentType.startsWith('audio/');
    const isImage = contentType.startsWith('image/');

    // Set appropriate headers based on content type
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Range'
    };

    // Add content length if available
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Add video-specific headers for proper streaming
    if (isVideo) {
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Disposition'] = 'inline';
    }

    // Add audio-specific headers
    if (isAudio) {
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Disposition'] = 'inline';
    }

    // Add image-specific headers
    if (isImage) {
      headers['Content-Disposition'] = 'inline';
    }

    // Return the content with proper headers
    return new NextResponse(contentData, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error streaming pack content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function verifyUserAccess(token: string, packId: string, orderId: string, username: string) {
  try {
    // Verify Firebase ID token
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user has a valid pack order for this pack
    const packOrderQuery = db.collection('packOrders')
      .where('buyerId', '==', userId)
      .where('packId', '==', packId);

    const packOrders = await packOrderQuery.get();

    if (packOrders.empty) {
      return null;
    }

    // Check if any order has valid status
    const validOrders = packOrders.docs.filter((doc: any) => {
      const status = doc.data().status;
      return ['COMPLETED', 'CONFIRMED', 'AUTO_RELEASED', 'APPROVED'].includes(status);
    });

    if (validOrders.length === 0) {
      return null;
    }

    return {
      userId,
      username: decodedToken.email?.split('@')[0] || username,
      packOrder: validOrders[0].id
    };

  } catch (error) {
    console.error('Error verifying user access:', error);
    return null;
  }
}
