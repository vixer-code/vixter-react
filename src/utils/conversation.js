/**
 * Conversation utility functions
 * Centralized helper functions for conversation management
 */

/**
 * Get display name for a conversation
 * @param {Object} conversation - The conversation object
 * @param {Object} users - The users object from context
 * @param {string} currentUserId - Current user's ID
 * @returns {string} Display name for the conversation
 */
export const getConversationDisplayName = (conversation, users, currentUserId) => {
  try {
    if (!conversation || !conversation.participants || !users || !currentUserId) {
      return 'Conversa sem nome';
    }

    const participantIds = Object.keys(conversation.participants);
    const otherUserId = participantIds.find(id => id !== currentUserId);
    
    if (!otherUserId) {
      return 'Conversa sem nome';
    }

    const otherUser = users[otherUserId];
    if (otherUser && typeof otherUser === 'object' && otherUser.hasOwnProperty('displayName')) {
      return otherUser.displayName || otherUser.name || `Usuário ${otherUserId.slice(0, 8)}`;
    }

    return `Usuário ${otherUserId.slice(0, 8)}`;
  } catch (error) {
    console.warn('Error getting conversation display name:', error);
    return 'Conversa sem nome';
  }
};

/**
 * Format last message time for display
 * @param {number} timestamp - The timestamp to format
 * @returns {string} Formatted time string
 */
export const formatLastMessageTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return messageTime.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  } catch (error) {
    console.warn('Error formatting message time:', error);
    return '';
  }
};

/**
 * Get preview text for the last message
 * @param {Object} conversation - The conversation object
 * @returns {string} Preview text for the last message
 */
export const getLastMessagePreview = (conversation) => {
  if (!conversation || !conversation.lastMessage) {
    return 'Nenhuma mensagem ainda';
  }

  try {
    const message = conversation.lastMessage;
    if (typeof message === 'string') {
      return message.length > 50 ? message.substring(0, 50) + '...' : message;
    }
    
    if (typeof message === 'object' && message.content) {
      const content = message.content;
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    
    return 'Mensagem';
  } catch (error) {
    console.warn('Error getting message preview:', error);
    return 'Mensagem';
  }
};

/**
 * Create a valid conversation object
 * @param {string} currentUserId - Current user's ID
 * @param {Object} otherUser - The other user object
 * @returns {Object} Valid conversation object
 */
export const createConversationObject = (currentUserId, otherUser) => {
  if (!currentUserId || !otherUser || !otherUser.uid) {
    throw new Error('Invalid parameters for creating conversation');
  }

  const conversationId = `${currentUserId}_${otherUser.uid}`;
  
  return {
    id: conversationId,
    participants: { 
      [currentUserId]: true, 
      [otherUser.uid]: true 
    },
    lastMessage: '',
    lastMessageTime: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
};

/**
 * Check if a conversation already exists
 * @param {Array} conversations - Array of existing conversations
 * @param {string} currentUserId - Current user's ID
 * @param {string} otherUserId - Other user's ID
 * @returns {Object|null} Existing conversation or null
 */
export const findExistingConversation = (conversations, currentUserId, otherUserId) => {
  if (!Array.isArray(conversations) || !currentUserId || !otherUserId) {
    return null;
  }

  return conversations.find(conv => {
    if (!conv || !conv.participants) return false;
    const participantIds = Object.keys(conv.participants);
    return participantIds.includes(currentUserId) && participantIds.includes(otherUserId);
  });
};

/**
 * Generate conversation ID from two user IDs
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {string} Conversation ID
 */
export const generateConversationId = (userId1, userId2) => {
  // Sort IDs to ensure consistent conversation ID regardless of order
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

/**
 * Validate conversation object structure
 * @param {Object} conversation - Conversation object to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidConversation = (conversation) => {
  if (!conversation || typeof conversation !== 'object') return false;
  
  return !!(
    conversation.id &&
    conversation.participants &&
    typeof conversation.participants === 'object' &&
    Object.keys(conversation.participants).length >= 2
  );
};

/**
 * Debug logging utility (can be toggled)
 * @param {string} message - Debug message
 * @param {any} data - Data to log
 * @param {boolean} enabled - Whether debug logging is enabled
 */
export const debugLog = (message, data = null, enabled = false) => {
  if (enabled) {
    console.log(`[Conversation Debug] ${message}`, data);
  }
};
