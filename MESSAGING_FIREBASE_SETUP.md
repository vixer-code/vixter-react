# Firebase Setup for Enhanced Messaging System

This document outlines the Firebase configuration needed to support the enhanced messaging system with service notifications and media support.

## 1. Firebase Realtime Database Structure

### Messages Collection
```
messages/
  {conversationId}/
    {messageId}/
      senderId: string          // User ID of sender
      type: string             // 'text', 'image', 'video', 'audio', 'file', 'service_notification'
      content: string          // Message text content
      mediaUrl?: string        // URL for media files
      mediaInfo?: {            // Media metadata
        name: string,
        size: number,
        type: string,
        storagePath: string
      }
      serviceOrderData?: {     // For service notifications
        id: string,
        serviceName: string,
        buyerId: string,
        sellerId: string,
        vpAmount: number,
        status: string,
        additionalFeatures: array
      }
      timestamp: number        // Unix timestamp
      read: boolean           // Read status
      readAt?: number         // When message was read
      readBy?: string         // Who read the message
      replyTo?: string        // ID of message being replied to
```

### Conversations Collection
```
conversations/
  {conversationId}/
    participants: {          // Map of participant IDs
      {userId}: true
    }
    type: string            // 'regular' or 'service'
    serviceOrderId?: string // For service conversations
    lastMessage: string     // Last message preview
    lastMessageTime: number // Last message timestamp
    lastSenderId: string    // ID of last message sender
    createdAt: number       // Conversation creation time
```

## 2. Firebase Storage Structure

### Media Files Organization
```
/messages/
  /image/
    /{conversationId}/
      {timestamp}_{userId}.{ext}
  /video/
    /{conversationId}/
      {timestamp}_{userId}.{ext}
  /audio/
    /{conversationId}/
      {timestamp}_{userId}.{ext}
  /file/
    /{conversationId}/
      {timestamp}_{userId}.{ext}
```

## 3. Firebase Security Rules

### Realtime Database Rules
Add these rules to `database.rules.json`:

```json
{
  "rules": {
    "messages": {
      "$conversationId": {
        ".read": "auth != null && (root.child('conversations').child($conversationId).child('participants').child(auth.uid).exists())",
        ".write": "auth != null && (root.child('conversations').child($conversationId).child('participants').child(auth.uid).exists())",
        "$messageId": {
          ".validate": "newData.hasChildren(['senderId', 'type', 'content', 'timestamp']) && newData.child('senderId').val() == auth.uid"
        }
      }
    },
    "conversations": {
      "$conversationId": {
        ".read": "auth != null && data.child('participants').child(auth.uid).exists()",
        ".write": "auth != null && (data.child('participants').child(auth.uid).exists() || newData.child('participants').child(auth.uid).exists())",
        "participants": {
          "$userId": {
            ".validate": "$userId == auth.uid || data.parent().child(auth.uid).exists()"
          }
        }
      }
    },
    "users": {
      "$userId": {
        ".read": "auth != null",
        ".write": "$userId == auth.uid"
      }
    }
  }
}
```

### Firebase Storage Rules
Update `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Messages media files
    match /messages/{type}/{conversationId}/{fileName} {
      allow read: if request.auth != null && 
                  isParticipantInConversation(request.auth.uid, conversationId);
      
      allow write: if request.auth != null && 
                   isParticipantInConversation(request.auth.uid, conversationId) &&
                   isValidMediaFile(type, resource.size, resource.contentType) &&
                   fileName.matches('.*_' + request.auth.uid + '\\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z)$');
      
      allow delete: if request.auth != null &&
                    isParticipantInConversation(request.auth.uid, conversationId) &&
                    fileName.matches('.*_' + request.auth.uid + '\\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z)$');
    }
    
    // Helper functions
    function isParticipantInConversation(userId, conversationId) {
      return firestore.exists(/databases/(default)/documents/conversations/$(conversationId)) &&
             firestore.get(/databases/(default)/documents/conversations/$(conversationId)).data.participants[userId] == true;
    }
    
    function isValidMediaFile(type, size, contentType) {
      return size < 50 * 1024 * 1024 && // Max 50MB
             (
               (type == 'image' && contentType.matches('image/(jpeg|jpg|png|gif|webp)')) ||
               (type == 'video' && contentType.matches('video/(mp4|mov|avi|webm)')) ||
               (type == 'audio' && contentType.matches('audio/(mpeg|wav|ogg|mp3|webm)')) ||
               (type == 'file' && (
                 contentType.matches('application/(pdf|msword|vnd\\.openxmlformats-officedocument\\..*|vnd\\.ms-.*|zip|x-rar-compressed|x-7z-compressed)') ||
                 contentType.matches('text/(plain|csv)') ||
                 contentType.matches('image/(jpeg|jpg|png|gif|webp)') ||
                 contentType.matches('audio/(mpeg|wav|ogg|mp3)')
               ))
             );
    }
  }
}
```

## 4. Firestore Collections for Service Orders

### serviceOrders Collection
```javascript
// Document structure in Firestore
{
  id: string,              // Auto-generated document ID
  serviceId: string,       // Reference to the service
  buyerId: string,         // User ID of buyer
  sellerId: string,        // User ID of seller
  vpAmount: number,        // VP amount paid
  vcAmount: number,        // VC amount for seller (vpAmount / 1.5)
  status: string,          // 'PENDING_ACCEPTANCE', 'ACCEPTED', 'DELIVERED', 'CONFIRMED', etc.
  additionalFeatures: [    // Optional additional features
    {
      name: string,
      price: number
    }
  ],
  metadata: {
    serviceName: string,
    serviceDescription: string,
    deliveryNotes?: string,
    buyerFeedback?: string,
    cancellationReason?: string
  },
  timestamps: {
    createdAt: timestamp,
    acceptedAt?: timestamp,
    deliveredAt?: timestamp,
    confirmedAt?: timestamp,
    autoReleaseAt?: timestamp
  },
  transactionIds: {
    purchaseId?: string,
    acceptanceId?: string,
    deliveryId?: string,
    confirmationId?: string
  }
}
```

### Firestore Security Rules
Add to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Service orders
    match /serviceOrders/{orderId} {
      allow read: if request.auth != null && 
                  (resource.data.buyerId == request.auth.uid || 
                   resource.data.sellerId == request.auth.uid);
      
      allow create: if request.auth != null && 
                    request.auth.uid == resource.data.buyerId &&
                    isValidServiceOrder(resource.data);
      
      allow update: if request.auth != null && 
                    (request.auth.uid == resource.data.buyerId || 
                     request.auth.uid == resource.data.sellerId) &&
                    isValidStatusUpdate(resource.data, request.resource.data);
    }
    
    // Services (existing)
    match /services/{serviceId} {
      allow read: if request.auth != null;
      // ... existing service rules
    }
    
    // Helper functions
    function isValidServiceOrder(data) {
      return data.keys().hasAll(['serviceId', 'buyerId', 'sellerId', 'vpAmount', 'status']) &&
             data.status == 'PENDING_ACCEPTANCE';
    }
    
    function isValidStatusUpdate(currentData, newData) {
      let currentStatus = currentData.status;
      let newStatus = newData.status;
      
      return (
        // Seller can accept or decline pending orders
        (request.auth.uid == currentData.sellerId && 
         currentStatus == 'PENDING_ACCEPTANCE' && 
         (newStatus == 'ACCEPTED' || newStatus == 'CANCELLED')) ||
        
        // Seller can mark accepted orders as delivered
        (request.auth.uid == currentData.sellerId && 
         currentStatus == 'ACCEPTED' && 
         newStatus == 'DELIVERED') ||
        
        // Buyer can confirm delivered orders
        (request.auth.uid == currentData.buyerId && 
         currentStatus == 'DELIVERED' && 
         newStatus == 'CONFIRMED')
      );
    }
  }
}
```

## 5. Firebase Functions (Cloud Functions)

### Required Cloud Functions
The following functions should be implemented in `functions/index.js`:

```javascript
// Service order management
exports.createServiceOrder = functions.https.onCall(async (data, context) => {
  // Handle service order creation
  // Validate user authentication and service existence
  // Create order document
  // Deduct VP from buyer
  // Send notification to seller
});

exports.acceptServiceOrder = functions.https.onCall(async (data, context) => {
  // Handle service order acceptance
  // Update order status
  // Send notification to buyer
});

exports.declineServiceOrder = functions.https.onCall(async (data, context) => {
  // Handle service order decline
  // Update order status
  // Refund VP to buyer
  // Send notification to buyer
});

exports.markServiceDelivered = functions.https.onCall(async (data, context) => {
  // Handle service delivery
  // Update order status
  // Start auto-release timer (24 hours)
  // Send notification to buyer
});

exports.confirmServiceDelivery = functions.https.onCall(async (data, context) => {
  // Handle delivery confirmation
  // Update order status
  // Release VC to seller
  // Create transaction records
});

// Auto-release function (runs daily)
exports.autoReleaseServicePayments = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    // Find orders delivered more than 24 hours ago
    // Auto-confirm and release payments
    // Update order status to AUTO_RELEASED
  });
```

## 6. Environment Configuration

### Firebase SDK Initialization
The current Firebase configuration in `config/firebase.js` should work with the messaging system. Ensure these services are initialized:

- Firebase Auth
- Realtime Database
- Firestore
- Firebase Storage
- Cloud Functions

### Required npm packages
Ensure these packages are installed:

```bash
npm install firebase react-window
```

## 7. Security Considerations

1. **Message Encryption**: Consider implementing end-to-end encryption for sensitive messages
2. **Media Scanning**: Implement server-side media content scanning for inappropriate content
3. **Rate Limiting**: Add rate limiting to prevent spam messaging
4. **User Blocking**: Implement user blocking functionality
5. **Report System**: Add ability to report inappropriate messages
6. **Data Retention**: Implement data retention policies for messages and media

## 8. Performance Optimizations

1. **Message Pagination**: Implement message pagination for large conversations
2. **Media Compression**: Compress images and videos before upload
3. **CDN**: Use Firebase Storage with CDN for fast media delivery
4. **Offline Support**: Implement offline message queuing
5. **Push Notifications**: Add push notifications for new messages

## 9. Monitoring and Analytics

1. **Message Metrics**: Track message volume and user engagement
2. **Error Monitoring**: Monitor upload failures and delivery issues
3. **Performance Metrics**: Track message delivery times and media load times
4. **User Behavior**: Analyze messaging patterns and feature usage

## 10. Backup and Recovery

1. **Database Backups**: Regular backups of message data
2. **Media Backups**: Backup strategy for uploaded media files
3. **Disaster Recovery**: Plan for service restoration in case of failures

This setup provides a robust, scalable messaging system with real-time capabilities, media support, and service notifications while maintaining security and performance.
