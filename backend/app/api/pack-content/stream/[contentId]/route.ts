import { NextRequest } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { auth } from '@/lib/firebase-admin';
import { getServiceAccountCredentials } from '@/config/service-account';

export const dynamic = 'force-dynamic';

// CORS headers
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    'https://vixter-react.vercel.app',
    'https://vixter.com.br',
    'https://www.vixter.com.br',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin'))
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { contentId: string } }
) {
  try {
    console.log('Stream request for contentId:', params.contentId);

    // Decode contentId to get packId, orderId, and contentKey
    let packId: string, orderId: string, contentKey: string;
    try {
      const decoded = Buffer.from(params.contentId, 'base64url').toString('utf-8');
      const [decodedPackId, decodedOrderId, decodedContentKey] = decoded.split('-');
      packId = decodedPackId;
      orderId = decodedOrderId;
      contentKey = decodedContentKey;
    } catch (error) {
      console.error('Error decoding contentId:', error);
      return new Response('Invalid content ID', { 
        status: 400,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Verify user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    const token = authHeader.split('Bearer ')[1];
    let user;
    try {
      user = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return new Response('Invalid token', { 
        status: 401,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Initialize Firestore
    const db = getFirestore();

    // Verify pack order exists and user has access
    const orderRef = db.collection('packOrders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return new Response('Pack order not found', { 
        status: 404,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return new Response('Order data not found', { 
        status: 404,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Verify user owns this order
    if (orderData.buyerId !== user.uid) {
      return new Response('Access denied', { 
        status: 403,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Verify order is valid
    const validStatuses = ['COMPLETED', 'CONFIRMED', 'AUTO_RELEASED', 'APPROVED'];
    if (!validStatuses.includes(orderData.status)) {
      return new Response('Order not completed', { 
        status: 403,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Verify pack matches order
    if (orderData.packId !== packId) {
      return new Response('Pack mismatch', { 
        status: 400,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Get pack data
    const packRef = db.collection('packs').doc(packId);
    const packSnap = await packRef.get();

    if (!packSnap.exists) {
      return new Response('Pack not found', { 
        status: 404,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    const packData = packSnap.data();
    if (!packData) {
      return new Response('Pack data not found', { 
        status: 404,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Find the content item
    const allContent = [
      ...(packData.packContent || []),
      ...(packData.content || [])
    ];
    
    const contentItem = allContent.find(item => item.key === contentKey);
    if (!contentItem) {
      return new Response('Content not found', { 
        status: 404,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

    // Get vendor info for watermarking
    const vendorId = packData.authorId || packData.creatorId;
    let vendorInfo = {
      vendorId,
      vendorUsername: 'vendor'
    };

    if (vendorId) {
      try {
        const vendorRef = db.collection('users').doc(vendorId);
        const vendorSnap = await vendorRef.get();
        if (vendorSnap.exists) {
          const vendorData = vendorSnap.data();
          if (vendorData) {
            vendorInfo = {
              vendorId,
              vendorUsername: vendorData.username || 'vendor'
            };
          }
        }
      } catch (error) {
        console.warn('Error loading vendor info:', error);
      }
    }

    // Call Cloud Function with service-to-service authentication
    const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';
    
    try {
      const credentials = getServiceAccountCredentials();
      const { GoogleAuth } = await import('google-auth-library');
      
      const authClient = new GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: credentials.projectId,
          private_key: credentials.privateKey,
          client_email: credentials.clientEmail,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const client = await authClient.getIdTokenClient(cloudFunctionUrl);
      const serviceToken = await client.idTokenProvider.fetchIdToken(cloudFunctionUrl);

      // Prepare Cloud Function request
      const cloudFunctionParams = new URLSearchParams({
        packId,
        orderId,
        contentKey,
        username: user.email?.split('@')[0] || 'user',
        token: token
      });

      const cloudFunctionResponse = await fetch(
        `${cloudFunctionUrl}?${cloudFunctionParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${serviceToken}`,
            'X-Serverless-Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!cloudFunctionResponse.ok) {
        console.error('Cloud Function error:', cloudFunctionResponse.status, cloudFunctionResponse.statusText);
        return new Response('Error processing content', { 
          status: cloudFunctionResponse.status,
          headers: getCorsHeaders(request.headers.get('origin'))
        });
      }

      // Stream the response from Cloud Function
      const contentType = cloudFunctionResponse.headers.get('content-type') || 'application/octet-stream';
      const contentLength = cloudFunctionResponse.headers.get('content-length');
      const acceptRanges = cloudFunctionResponse.headers.get('accept-ranges');
      const contentDisposition = cloudFunctionResponse.headers.get('content-disposition');

      const headers = new Headers({
        'Content-Type': contentType,
        ...getCorsHeaders(request.headers.get('origin'))
      });

      if (contentLength) headers.set('Content-Length', contentLength);
      if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
      if (contentDisposition) headers.set('Content-Disposition', contentDisposition);

      return new Response(cloudFunctionResponse.body, {
        status: 200,
        headers
      });

    } catch (error) {
      console.error('Error calling Cloud Function:', error);
      return new Response('Error processing content', { 
        status: 500,
        headers: getCorsHeaders(request.headers.get('origin'))
      });
    }

  } catch (error) {
    console.error('Error streaming pack content:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: getCorsHeaders(request.headers.get('origin'))
    });
  }
}
