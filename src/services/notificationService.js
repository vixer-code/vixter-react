import { ref, push, set } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { database, db } from '../../config/firebase';

/**
 * Get user's username from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<string>} Username or fallback name
 */
const getUserUsername = async (userId) => {
  if (!userId) return 'Usuário';
  
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.username || userData.displayName || userData.name || 'Usuário';
    }
    
    return 'Usuário';
  } catch (error) {
    console.error('Error getting user username:', error);
    return 'Usuário';
  }
};

/**
 * Send notification to post author when there's a positive interaction
 * @param {string} authorId - ID of the post author
 * @param {string} actorId - ID of the user who performed the action
 * @param {string} actorName - Name of the user who performed the action
 * @param {string} actorUsername - Username of the user who performed the action
 * @param {string} action - Type of action: 'like', 'repost', 'comment'
 * @param {string} postId - ID of the post
 * @param {string} postContent - Content of the post (truncated)
 * @param {string} commentContent - Content of the comment (if action is comment)
 */
export const sendPostInteractionNotification = async (
  authorId,
  actorId,
  actorName,
  actorUsername,
  action,
  postId,
  postContent,
  commentContent = null
) => {
  try {
    // Don't send notification to self
    if (authorId === actorId) return;

    // Create notification data
    const notificationData = {
      type: 'post_interaction',
      action,
      postId,
      postContent: postContent ? postContent.substring(0, 100) + (postContent.length > 100 ? '...' : '') : '',
      actorId,
      actorName,
      actorUsername,
      timestamp: Date.now(),
      read: false,
      ...(commentContent && { commentContent: commentContent.substring(0, 100) + (commentContent.length > 100 ? '...' : '') })
    };

    // Send to user's notifications
    const notificationsRef = ref(database, `notifications/${authorId}`);
    await push(notificationsRef, notificationData);

    console.log(`Notification sent to ${authorId} for ${action} by ${actorName}`);
  } catch (error) {
    console.error('Error sending post interaction notification:', error);
  }
};

/**
 * Get notification message based on action type
 * @param {string} action - Type of action
 * @param {string} actorName - Name of the actor
 * @param {string} commentContent - Comment content (if applicable)
 * @returns {string} Formatted message
 */
export const getNotificationMessage = (action, actorName, commentContent = null) => {
  switch (action) {
    case 'like':
      return `${actorName} curtiu seu post`;
    case 'repost':
      return `${actorName} repostou seu post`;
    case 'comment':
      return `${actorName} comentou em seu post: "${commentContent || ''}"`;
    case 'message':
      return `${actorName} enviou uma mensagem`;
    case 'email_verification':
      return 'Verifique seu e-mail para completar o cadastro';
    case 'service_purchased':
      return `${actorName} comprou seu serviço`;
    case 'pack_purchased':
      return `${actorName} comprou seu pack`;
    case 'service_accepted':
      return 'Seu pedido de serviço foi aceito';
    case 'pack_accepted':
      return 'Seu pedido de pack foi aceito';
    default:
      return `${actorName} interagiu com seu post`;
  }
};

/**
 * Send email verification notification
 * @param {string} userId - ID of the user
 */
export const sendEmailVerificationNotification = async (userId) => {
  try {
    const notificationData = {
      type: 'email_verification',
      action: 'email_verification',
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${userId}`);
    await push(notificationsRef, notificationData);

    console.log(`Email verification notification sent to ${userId}`);
  } catch (error) {
    console.error('Error sending email verification notification:', error);
  }
};

/**
 * Send message notification
 * @param {string} recipientId - ID of the message recipient
 * @param {string} senderId - ID of the message sender
 * @param {string} senderName - Name of the sender
 * @param {string} conversationId - ID of the conversation
 * @param {string} messageContent - Content of the message (truncated)
 */
export const sendMessageNotification = async (
  recipientId,
  senderId,
  senderName,
  conversationId,
  messageContent
) => {
  try {
    // Don't send notification to self
    if (recipientId === senderId) return;

    const notificationData = {
      type: 'message',
      action: 'message',
      conversationId,
      messageContent: messageContent ? messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : '') : '',
      senderId,
      senderName,
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${recipientId}`);
    await push(notificationsRef, notificationData);

    console.log(`Message notification sent to ${recipientId} from ${senderName}`);
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
};

/**
 * Send service purchase notification to seller
 * @param {string} sellerId - ID of the service seller
 * @param {string} buyerId - ID of the buyer
 * @param {string} buyerName - Name of the buyer
 * @param {string} serviceId - ID of the service
 * @param {string} serviceName - Name of the service
 * @param {number} amount - Purchase amount
 */
export const sendServicePurchaseNotification = async (
  sellerId,
  buyerId,
  buyerName,
  serviceId,
  serviceName,
  amount
) => {
  try {
    // Don't send notification to self
    if (sellerId === buyerId) return;

    // Get buyer's username from Firestore
    const buyerUsername = await getUserUsername(buyerId);

    const notificationData = {
      type: 'service_purchase',
      action: 'service_purchased',
      serviceId,
      serviceName: serviceName ? serviceName.substring(0, 50) + (serviceName.length > 50 ? '...' : '') : '',
      buyerId,
      buyerName: buyerUsername,
      amount,
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${sellerId}`);
    await push(notificationsRef, notificationData);

    console.log(`Service purchase notification sent to seller ${sellerId} for service ${serviceName}`);
  } catch (error) {
    console.error('Error sending service purchase notification:', error);
  }
};

/**
 * Send pack purchase notification to seller
 * @param {string} sellerId - ID of the pack seller
 * @param {string} buyerId - ID of the buyer
 * @param {string} buyerName - Name of the buyer
 * @param {string} packId - ID of the pack
 * @param {string} packName - Name of the pack
 * @param {number} amount - Purchase amount
 */
export const sendPackPurchaseNotification = async (
  sellerId,
  buyerId,
  buyerName,
  packId,
  packName,
  amount
) => {
  try {
    // Don't send notification to self
    if (sellerId === buyerId) return;

    // Get buyer's username from Firestore
    const buyerUsername = await getUserUsername(buyerId);

    const notificationData = {
      type: 'pack_purchase',
      action: 'pack_purchased',
      packId,
      packName: packName ? packName.substring(0, 50) + (packName.length > 50 ? '...' : '') : '',
      buyerId,
      buyerName: buyerUsername,
      amount,
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${sellerId}`);
    await push(notificationsRef, notificationData);

    console.log(`Pack purchase notification sent to seller ${sellerId} for pack ${packName}`);
  } catch (error) {
    console.error('Error sending pack purchase notification:', error);
  }
};

/**
 * Send service accepted notification to buyer
 * @param {string} buyerId - ID of the buyer
 * @param {string} sellerId - ID of the seller
 * @param {string} sellerName - Name of the seller
 * @param {string} serviceId - ID of the service
 * @param {string} serviceName - Name of the service
 * @param {string} orderId - ID of the order
 */
export const sendServiceAcceptedNotification = async (
  buyerId,
  sellerId,
  sellerName,
  serviceId,
  serviceName,
  orderId
) => {
  try {
    // Don't send notification to self
    if (buyerId === sellerId) return;

    // Get seller's username from Firestore
    const sellerUsername = await getUserUsername(sellerId);

    const notificationData = {
      type: 'service_accepted',
      action: 'service_accepted',
      serviceId,
      serviceName: serviceName ? serviceName.substring(0, 50) + (serviceName.length > 50 ? '...' : '') : '',
      sellerId,
      sellerName: sellerUsername,
      orderId,
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${buyerId}`);
    await push(notificationsRef, notificationData);

    console.log(`Service accepted notification sent to buyer ${buyerId} for service ${serviceName}`);
  } catch (error) {
    console.error('Error sending service accepted notification:', error);
  }
};

/**
 * Send pack accepted notification to buyer
 * @param {string} buyerId - ID of the buyer
 * @param {string} sellerId - ID of the seller
 * @param {string} sellerName - Name of the seller
 * @param {string} packId - ID of the pack
 * @param {string} packName - Name of the pack
 * @param {string} orderId - ID of the order
 */
export const sendPackAcceptedNotification = async (
  buyerId,
  sellerId,
  sellerName,
  packId,
  packName,
  orderId
) => {
  try {
    // Don't send notification to self
    if (buyerId === sellerId) return;

    // Get seller's username from Firestore
    const sellerUsername = await getUserUsername(sellerId);

    const notificationData = {
      type: 'pack_accepted',
      action: 'pack_accepted',
      packId,
      packName: packName ? packName.substring(0, 50) + (packName.length > 50 ? '...' : '') : '',
      sellerId,
      sellerName: sellerUsername,
      orderId,
      timestamp: Date.now(),
      read: false
    };

    const notificationsRef = ref(database, `notifications/${buyerId}`);
    await push(notificationsRef, notificationData);

    console.log(`Pack accepted notification sent to buyer ${buyerId} for pack ${packName}`);
  } catch (error) {
    console.error('Error sending pack accepted notification:', error);
  }
};
