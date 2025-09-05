import { requireAuth, getCorsHeaders, handleCors } from '../../lib/auth';
import { generateDownloadSignedUrl, generateWatermarkUrl } from '../../lib/r2';

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
      key, 
      watermarked = false, // For pack content that needs watermarking
      expiresIn = 3600 
    } = req.body;

    // Validate required fields
    if (!key) {
      return res.status(400).json({ 
        error: 'Missing required field: key' 
      });
    }

    let downloadUrl;
    let resultKey;

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

    res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        key: resultKey,
        watermarked,
        expiresIn,
      }
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
}
