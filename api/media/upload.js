import { requireAuth, getCorsHeaders, handleCors } from '../../lib/auth';
import { generateUploadSignedUrl, generateMediaKey } from '../../lib/r2';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      type, 
      contentType, 
      originalName, 
      itemId, // packId or serviceId
      expiresIn = 3600 
    } = req.body;

    // Validate required fields
    if (!type || !contentType) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, contentType' 
      });
    }

    // Validate type
    const validTypes = ['pack', 'service', 'profile', 'message'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be one of: pack, service, profile, message' 
      });
    }

    // Generate unique key for the media file
    const key = generateMediaKey(user.uid, type, itemId, originalName);

    // Generate signed URL for upload
    const signedUrlResult = await generateUploadSignedUrl(key, contentType, expiresIn);

    res.status(200).json({
      success: true,
      data: {
        uploadUrl: signedUrlResult.uploadUrl,
        key: signedUrlResult.key,
        publicUrl: signedUrlResult.publicUrl,
        expiresIn,
      }
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
