import { doc, getDoc } from 'firebase/firestore';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { db, database } from '../../config/firebase';

/**
 * Busca dados do comprador por buyerId
 * @param {string} buyerId - ID do comprador
 * @returns {Promise<Object>} Dados do comprador ou objeto vazio
 */
export const getBuyerData = async (buyerId) => {
  if (!buyerId) {
    return {
      displayName: '',
      name: '',
      username: '',
      profilePictureURL: ''
    };
  }

  try {
    // Try Firestore first
    const userRef = doc(db, 'users', buyerId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        displayName: userData.displayName || userData.name || '',
        name: userData.displayName || userData.name || '',
        username: userData.username || '',
        profilePictureURL: userData.profilePictureURL || userData.photoURL || ''
      };
    }
    
    // Fallback to Realtime Database
    if (database) {
      const rtdbUserRef = rtdbRef(database, `users/${buyerId}`);
      const rtdbSnap = await rtdbGet(rtdbUserRef);
      if (rtdbSnap.exists()) {
        const rtdbUserData = rtdbSnap.val();
        return {
          displayName: rtdbUserData.displayName || rtdbUserData.name || '',
          name: rtdbUserData.displayName || rtdbUserData.name || '',
          username: rtdbUserData.username || '',
          profilePictureURL: rtdbUserData.profilePictureURL || rtdbUserData.photoURL || ''
        };
      }
    }
    
    return {
      displayName: '',
      name: '',
      username: '',
      profilePictureURL: ''
    };
  } catch (error) {
    console.error('Error getting buyer data:', error);
    return {
      displayName: '',
      name: '',
      username: '',
      profilePictureURL: ''
    };
  }
};

/**
 * Enriquece um array de orders com dados dos compradores
 * @param {Array} orders - Array de orders
 * @returns {Promise<Array>} Array de orders com dados dos compradores
 */
export const enrichOrdersWithBuyerData = async (orders) => {
  if (!orders || !Array.isArray(orders)) {
    return [];
  }

  // Get unique buyer IDs
  const buyerIds = [...new Set(orders.map(order => order.buyerId).filter(Boolean))];
  
  // Fetch buyer data for all unique buyers
  const buyerDataPromises = buyerIds.map(async (buyerId) => {
    const data = await getBuyerData(buyerId);
    return { buyerId, ...data };
  });
  
  const buyerDataResults = await Promise.all(buyerDataPromises);
  
  // Create a map for quick lookup
  const buyerDataMap = buyerDataResults.reduce((map, data) => {
    map[data.buyerId] = data;
    return map;
  }, {});
  
  // Enrich orders with buyer data
  return orders.map(order => {
    const buyerData = buyerDataMap[order.buyerId] || {};
    
    return {
      ...order,
      buyerName: order.buyerName || buyerData.displayName || buyerData.name || '',
      buyerDisplayName: order.buyerDisplayName || buyerData.displayName || buyerData.name || '',
      buyerUsername: order.buyerUsername || buyerData.username || '',
      buyerProfilePictureURL: order.buyerProfilePictureURL || buyerData.profilePictureURL || ''
    };
  });
};

/**
 * Enriquece um único order com dados do comprador
 * @param {Object} order - Order object
 * @returns {Promise<Object>} Order com dados do comprador
 */
export const enrichOrderWithBuyerData = async (order) => {
  if (!order || !order.buyerId) {
    return order;
  }

  const buyerData = await getBuyerData(order.buyerId);
  
  return {
    ...order,
    buyerName: order.buyerName || buyerData.displayName || buyerData.name || '',
    buyerDisplayName: order.buyerDisplayName || buyerData.displayName || buyerData.name || '',
    buyerUsername: order.buyerUsername || buyerData.username || '',
    buyerProfilePictureURL: order.buyerProfilePictureURL || buyerData.profilePictureURL || ''
  };
};
