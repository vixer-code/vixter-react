import { ref, push, set } from 'firebase/database';
import { database } from '../../config/firebase';

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
    default:
      return `${actorName} interagiu com seu post`;
  }
};
