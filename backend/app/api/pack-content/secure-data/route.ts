import { NextRequest } from 'next/server';
import { requireAuth, getCorsHeaders, handleCors, AuthenticatedUser } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { generateSignedUrl } from '@/lib/signed-urls';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

export const POST = requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { packId, orderId, userId } = body;

    // Validate required fields
    if (!packId || !orderId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: packId, orderId, userId' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify user is requesting their own data
    if (user.uid !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User ID mismatch' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Get the Firebase ID token from the request
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split('Bearer ')[1] || '';

    // Verify pack order exists and user has access
    const orderRef = db.collection('packOrders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return new Response(
        JSON.stringify({ error: 'Pack order not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return new Response(
        JSON.stringify({ error: 'Pack order data not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify order belongs to user and is for the correct pack
    if (orderData.buyerId !== userId || orderData.packId !== packId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Order does not belong to user or pack mismatch' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Verify order is completed/approved (not pending)
    if (orderData.status !== 'COMPLETED' && orderData.status !== 'APPROVED') {
      return new Response(
        JSON.stringify({ error: 'Pack order not completed or approved yet' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    // Get pack data with full content
    const packRef = db.collection('packs').doc(packId);
    const packSnap = await packRef.get();

    if (!packSnap.exists) {
      return new Response(
        JSON.stringify({ error: 'Pack not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
    }

    const packData = packSnap.data();
    if (!packData) {
      return new Response(
        JSON.stringify({ error: 'Pack data not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
        }
      );
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
            vendorInfo.vendorUsername = vendorData.username || 'vendor';
          }
        }
      } catch (error) {
        console.warn('Error loading vendor info:', error);
      }
    }

    // Get user's real username from Firestore
    let username = 'user';
    try {
      const userRef = db.collection('users').doc(user.uid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        username = userData?.username || userData?.displayName || user.email?.split('@')[0] || 'user';
      } else {
        // Fallback to email if user document doesn't exist
        username = user.email?.split('@')[0] || 'user';
      }
    } catch (error) {
      console.warn('Error loading user info:', error);
      username = user.email?.split('@')[0] || 'user';
    }

    // Generate JWT tokens and simple URLs for each content item
    const contentWithUrls = [];
    const cloudFunctionUrl = 'https://packcontentaccess-6twxbx5ima-ue.a.run.app';

    // Process packContent
    if (packData.packContent && Array.isArray(packData.packContent)) {
      for (const contentItem of packData.packContent) {
        if (contentItem.key) {
          try {
            const jwtToken = await generateSignedUrl(
              user.uid,
              username,
              packId,
              orderId,
              contentItem.key,
              vendorInfo.vendorId || '',
              vendorInfo.vendorUsername,
              2 // 2 minutes expiration
            );
            
            contentWithUrls.push({
              ...contentItem,
              secureUrl: cloudFunctionUrl, // Cloud Function URL
              jwtToken: jwtToken, // JWT token for Authorization header
              requiresAuth: true
            });
          } catch (error) {
            console.error('Error generating JWT token for content:', contentItem.key, error);
            // Fallback to direct content key (for debugging)
            contentWithUrls.push({
              ...contentItem,
              secureUrl: `#error-${contentItem.key}`,
              requiresAuth: false
            });
          }
        }
      }
    }

    // Process content (legacy field)
    if (packData.content && Array.isArray(packData.content)) {
      for (const contentItem of packData.content) {
        if (contentItem.key) {
          try {
            const jwtToken = await generateSignedUrl(
              user.uid,
              username,
              packId,
              orderId,
              contentItem.key,
              vendorInfo.vendorId || '',
              vendorInfo.vendorUsername,
              2 // 2 minutes expiration
            );
            
            contentWithUrls.push({
              ...contentItem,
              secureUrl: cloudFunctionUrl, // Cloud Function URL
              jwtToken: jwtToken, // JWT token for Authorization header
              requiresAuth: true
            });
          } catch (error) {
            console.error('Error generating JWT token for content:', contentItem.key, error);
            // Fallback to direct content key (for debugging)
            contentWithUrls.push({
              ...contentItem,
              secureUrl: `#error-${contentItem.key}`,
              requiresAuth: false
            });
          }
        }
      }
    }

    // Add sample images with direct public URLs (they're in public bucket)
    if (packData.sampleImages && Array.isArray(packData.sampleImages)) {
      for (const sampleImage of packData.sampleImages) {
        if (sampleImage.publicUrl || sampleImage.url) {
          // Ensure absolute URL with protocol
          const rawUrl = (sampleImage.publicUrl || sampleImage.url) as string;
          const absoluteUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
            ? rawUrl
            : `https://${rawUrl.replace(/^\/+/, '')}`;
          contentWithUrls.push({
            key: sampleImage.key || `sample-${Date.now()}`,
            name: sampleImage.name || 'Imagem de Amostra',
            type: sampleImage.type || 'image/jpeg',
            size: sampleImage.size || 0,
            secureUrl: absoluteUrl, // Use direct public URL
            isSample: true,
            contentId: `sample-${sampleImage.key || Date.now()}` // Add contentId for consistency
          });
        }
      }
    }

    // Add sample videos with direct public URLs (they're in public bucket)
    if (packData.sampleVideos && Array.isArray(packData.sampleVideos)) {
      for (const sampleVideo of packData.sampleVideos) {
        if (sampleVideo.publicUrl || sampleVideo.url) {
          // Ensure absolute URL with protocol
          const rawUrl = (sampleVideo.publicUrl || sampleVideo.url) as string;
          const absoluteUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
            ? rawUrl
            : `https://${rawUrl.replace(/^\/+/, '')}`;
          contentWithUrls.push({
            key: sampleVideo.key || `sample-video-${Date.now()}`,
            name: sampleVideo.name || 'Vídeo de Amostra',
            type: sampleVideo.type || 'video/mp4',
            size: sampleVideo.size || 0,
            secureUrl: absoluteUrl, // Use direct public URL
            isSample: true,
            contentId: `sample-video-${sampleVideo.key || Date.now()}` // Add contentId for consistency
          });
        }
      }
    }

    // Return secure pack data with pre-generated URLs
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: packId,
          title: packData.title || 'Pack',
          coverImage: packData.coverImage,
          description: packData.description,
          price: packData.price,
          category: packData.category,
          contentWithUrls, // Pre-generated secure URLs + sample content with public URLs
          vendorInfo
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  } catch (error) {
    console.error('Error loading secure pack data:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load secure pack data' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request.headers.get('origin')) }
      }
    );
  }
});
