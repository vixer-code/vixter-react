const admin = require('firebase-admin');
const crypto = require('crypto');

/**
 * Utility functions for pack content security and access control
 */

/**
 * Generate a secure, time-limited access token for pack content
 */
function generateSecureAccessToken(userId, packId, orderId, expiresIn = 3600) {
  const payload = {
    userId,
    packId,
    orderId,
    timestamp: Date.now(),
    expiresIn
  };

  const secret = process.env.PACK_ACCESS_SECRET || 'default-secret-key';
  const token = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return token;
}

/**
 * Verify and decode secure access token
 */
function verifySecureAccessToken(token, userId, packId, orderId) {
  try {
    const secret = process.env.PACK_ACCESS_SECRET || 'default-secret-key';
    const expectedToken = generateSecureAccessToken(userId, packId, orderId);
    
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expectedToken, 'hex')
    );
  } catch (error) {
    console.error('Error verifying secure access token:', error);
    return false;
  }
}

/**
 * Validate pack order ownership and status
 */
async function validatePackOrderAccess(userId, packId, orderId = null) {
  try {
    const db = admin.firestore();
    
    let query = db.collection('packOrders')
      .where('buyerId', '==', userId)
      .where('packId', '==', packId)
      .where('status', 'in', ['COMPLETED', 'CONFIRMED', 'AUTO_RELEASED']);

    // If specific orderId is provided, filter by it
    if (orderId) {
      query = query.where('__name__', '==', orderId);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return {
        valid: false,
        reason: 'No valid pack order found'
      };
    }

    const packOrder = snapshot.docs[0].data();
    
    // Additional validations
    const orderTimestamp = packOrder.timestamps?.createdAt;
    if (orderTimestamp) {
      const orderDate = orderTimestamp.toDate();
      const now = new Date();
      const daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
      
      // Optional: Check for expiration (e.g., 90 days)
      if (daysDiff > 90) {
        return {
          valid: false,
          reason: 'Pack access expired'
        };
      }
    }

    return {
      valid: true,
      packOrder: {
        id: snapshot.docs[0].id,
        ...packOrder
      }
    };

  } catch (error) {
    console.error('Error validating pack order access:', error);
    return {
      valid: false,
      reason: 'Database error'
    };
  }
}

/**
 * Generate secure content URL with access token
 */
function generateSecureContentUrl(baseUrl, userId, packId, orderId, contentKey, watermark, username) {
  const accessToken = generateSecureAccessToken(userId, packId, orderId);
  
  const params = new URLSearchParams({
    packId,
    contentKey,
    watermark: watermark || username,
    username,
    orderId,
    token: accessToken
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Rate limiting for pack content access
 */
class PackAccessRateLimit {
  constructor() {
    this.accessLog = new Map();
    this.maxRequestsPerMinute = 60;
    this.maxRequestsPerHour = 300;
  }

  checkRateLimit(userId, packId) {
    const now = Date.now();
    const key = `${userId}:${packId}`;
    
    if (!this.accessLog.has(key)) {
      this.accessLog.set(key, {
        minute: [],
        hour: []
      });
    }

    const userLog = this.accessLog.get(key);
    
    // Clean old entries
    userLog.minute = userLog.minute.filter(time => now - time < 60000);
    userLog.hour = userLog.hour.filter(time => now - time < 3600000);

    // Check limits
    if (userLog.minute.length >= this.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded: too many requests per minute'
      };
    }

    if (userLog.hour.length >= this.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded: too many requests per hour'
      };
    }

    // Log the access
    userLog.minute.push(now);
    userLog.hour.push(now);

    return {
      allowed: true
    };
  }
}

// Global rate limiter instance
const rateLimiter = new PackAccessRateLimit();

module.exports = {
  generateSecureAccessToken,
  verifySecureAccessToken,
  validatePackOrderAccess,
  generateSecureContentUrl,
  rateLimiter
};
