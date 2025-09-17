import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useMessaging } from './EnhancedMessagingContext';
import { useWallet } from './WalletContext';

const PackOrderContext = createContext({});

export const usePackOrder = () => {
  const context = useContext(PackOrderContext);
  if (!context) {
    throw new Error('usePackOrder must be used within a PackOrderProvider');
  }
  return context;
};

export const PackOrderProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  
  // Safely get messaging functions with fallbacks
  let sendPackNotification, createPackConversation, markPackConversationCompleted;
  try {
    const messagingContext = useMessaging();
    sendPackNotification = messagingContext?.sendPackNotification || (() => Promise.resolve());
    createPackConversation = messagingContext?.createPackConversation || (() => Promise.resolve(null));
    markPackConversationCompleted = messagingContext?.markPackConversationCompleted || (() => Promise.resolve());
  } catch (error) {
    console.warn('Messaging context not available, using fallback functions:', error);
    sendPackNotification = () => Promise.resolve();
    createPackConversation = () => Promise.resolve(null);
    markPackConversationCompleted = () => Promise.resolve();
  }
  
  // State
  const [packOrders, setPackOrders] = useState([]);
  const [receivedOrders, setReceivedOrders] = useState([]); // Orders where user is seller
  const [sentOrders, setSentOrders] = useState([]); // Orders where user is buyer
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Firebase Functions
  const apiFunc = httpsCallable(functions, 'api');

  // Order statuses
  const ORDER_STATUS = {
    PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    CONFIRMED: 'CONFIRMED',
    AUTO_RELEASED: 'AUTO_RELEASED',
    COMPLETED: 'COMPLETED', // New status for completed packs
    CANCELLED: 'CANCELLED',
    DISPUTED: 'DISPUTED',
    TIMEOUT: 'TIMEOUT' // New status for 24h timeout
  };

  // Load pack orders
  useEffect(() => {
    if (!currentUser) {
      setPackOrders([]);
      setReceivedOrders([]);
      setSentOrders([]);
      setLoading(false);
      return;
    }

    // Load orders where user is the seller (received orders)
    const receivedOrdersRef = collection(db, 'packOrders');
    const receivedOrdersQuery = query(
      receivedOrdersRef,
      where('sellerId', '==', currentUser.uid)
      // Temporarily removed orderBy to debug
      // orderBy('timestamps.createdAt', 'desc')
    );

    const unsubscribeReceived = onSnapshot(receivedOrdersQuery, (snapshot) => {
      const orders = [];
      console.log('Received orders snapshot:', snapshot.size, 'documents');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Received order:', doc.id, data);
        orders.push({
          id: doc.id,
          ...data
        });
      });
      console.log('All received orders:', orders);
      setReceivedOrders(orders);
    }, (error) => {
      console.error('Error loading received orders:', error);
    });

    // Load orders where user is the buyer (sent orders)
    const sentOrdersRef = collection(db, 'packOrders');
    const sentOrdersQuery = query(
      sentOrdersRef,
      where('buyerId', '==', currentUser.uid)
      // Temporarily removed orderBy to debug
      // orderBy('timestamps.createdAt', 'desc')
    );

    const unsubscribeSent = onSnapshot(sentOrdersQuery, (snapshot) => {
      const orders = [];
      console.log('Sent orders snapshot:', snapshot.size, 'documents');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Sent order:', doc.id, data);
        orders.push({
          id: doc.id,
          ...data
        });
      });
      console.log('All sent orders:', orders);
      setSentOrders(orders);
    }, (error) => {
      console.error('Error loading sent orders:', error);
    });

    setLoading(false);

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
    };
  }, [currentUser]);

  // Combine all orders
  useEffect(() => {
    const allOrders = [...receivedOrders, ...sentOrders];
    // Remove duplicates and sort by creation time
    const uniqueOrders = allOrders.filter((order, index, self) => 
      index === self.findIndex((o) => o.id === order.id)
    );
    uniqueOrders.sort((a, b) => b.timestamps?.createdAt?.toMillis() - a.timestamps?.createdAt?.toMillis());
    setPackOrders(uniqueOrders);
  }, [receivedOrders, sentOrders]);

  // Accept pack order
  const acceptPackOrder = useCallback(async (orderId) => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'packOrder',
        action: 'accept',
        payload: { orderId }
      });

      if (result.data.success) {
        showSuccess('Pedido de pack aceito com sucesso!');
        
        // Update the order in messaging and create conversation
        const order = receivedOrders.find(o => o.id === orderId) || sentOrders.find(o => o.id === orderId);
        console.log('Found pack order for conversation creation:', order);
        
        if (order) {
          try {
            // For packs, when accepted they should be CONFIRMED (completed immediately)
            await sendPackNotification({
              ...order,
              status: ORDER_STATUS.CONFIRMED
            });
            
            // Create pack conversation
            console.log('Creating pack conversation...');
            const conversation = await createPackConversation(order);
            console.log('Pack conversation created:', conversation);
          } catch (notificationError) {
            console.warn('Error with pack notification/conversation:', notificationError);
            // Don't fail the whole operation if notification fails
          }
        } else {
          console.error('Pack order not found for conversation creation:', orderId);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error accepting pack order:', error);
      showError('Erro ao aceitar pedido');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, receivedOrders, sentOrders, sendPackNotification, createPackConversation, showSuccess, showError]);

  // Decline pack order
  const declinePackOrder = useCallback(async (orderId, reason = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'packOrder',
        action: 'decline',
        payload: { orderId, reason }
      });

      if (result.data.success) {
        showSuccess('Pedido de pack recusado. O valor foi devolvido ao cliente.');
        
        // Update the order in messaging
        const order = packOrders.find(o => o.id === orderId);
        if (order) {
          await sendPackNotification({
            ...order,
            status: ORDER_STATUS.CANCELLED,
            cancellationReason: reason
          });
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error declining pack order:', error);
      showError('Erro ao recusar pedido');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, packOrders, sendPackNotification, showSuccess, showError]);

  // Mark pack as delivered
  const markPackDelivered = useCallback(async (orderId, deliveryNotes = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'packOrder',
        action: 'deliver',
        payload: { orderId, deliveryNotes }
      });

      if (result.data.success) {
        showSuccess('Pack marcado como entregue! O cliente foi notificado e pode confirmar a entrega.');
        
        // Update the order in messaging
        const order = packOrders.find(o => o.id === orderId);
        if (order) {
          await sendPackNotification({
            ...order,
            status: ORDER_STATUS.DELIVERED,
            deliveryNotes
          });
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error marking pack as delivered:', error);
      showError('Erro ao marcar pack como entregue');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, packOrders, sendPackNotification, showSuccess, showError]);

  // Confirm pack delivery
  const confirmPackDelivery = useCallback(async (orderId, feedback = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'packOrder',
        action: 'confirm',
        payload: { orderId, feedback }
      });

      if (result.data.success) {
        showSuccess('Entrega confirmada! O provedor receberá os créditos e a conversa será finalizada.');
        
        // Update the order in messaging
        const order = packOrders.find(o => o.id === orderId);
        if (order) {
          await sendPackNotification({
            ...order,
            status: ORDER_STATUS.CONFIRMED,
            buyerFeedback: feedback
          });
          
          // Mark pack conversation as completed
          await markPackConversationCompleted(orderId);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error confirming pack delivery:', error);
      showError('Erro ao confirmar entrega');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, packOrders, sendPackNotification, showSuccess, showError]);

  // Get order by ID
  const getOrderById = useCallback(async (orderId) => {
    if (!orderId) return null;

    try {
      const orderRef = doc(db, 'packOrders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        return {
          id: orderSnap.id,
          ...orderSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pack order by ID:', error);
      return null;
    }
  }, []);

  // Get order status display info
  const getOrderStatusInfo = useCallback((status) => {
    const statusMap = {
      [ORDER_STATUS.PENDING_ACCEPTANCE]: {
        label: 'Aguardando Aceitação',
        color: 'warning',
        icon: 'clock'
      },
      [ORDER_STATUS.ACCEPTED]: {
        label: 'Aceito',
        color: 'info',
        icon: 'check'
      },
      [ORDER_STATUS.DELIVERED]: {
        label: 'Entregue',
        color: 'primary',
        icon: 'truck'
      },
      [ORDER_STATUS.CONFIRMED]: {
        label: 'Confirmado',
        color: 'success',
        icon: 'check-circle'
      },
      [ORDER_STATUS.AUTO_RELEASED]: {
        label: 'Liberado Automaticamente',
        color: 'success',
        icon: 'check-circle'
      },
      [ORDER_STATUS.COMPLETED]: {
        label: 'Concluído',
        color: 'success',
        icon: 'check-circle'
      },
      [ORDER_STATUS.CANCELLED]: {
        label: 'Cancelado',
        color: 'danger',
        icon: 'times-circle'
      },
      [ORDER_STATUS.DISPUTED]: {
        label: 'Em Disputa',
        color: 'warning',
        icon: 'exclamation-triangle'
      },
      [ORDER_STATUS.TIMEOUT]: {
        label: 'Tempo Esgotado',
        color: 'danger',
        icon: 'clock'
      }
    };

    return statusMap[status] || {
      label: 'Desconhecido',
      color: 'secondary',
      icon: 'question'
    };
  }, []);

  // Filter orders by status
  const filterOrdersByStatus = useCallback((status) => {
    return packOrders.filter(order => order.status === status);
  }, [packOrders]);

  // Get pending orders count
  const getPendingOrdersCount = useCallback(() => {
    return receivedOrders.filter(order => 
      order.status === ORDER_STATUS.PENDING_ACCEPTANCE
    ).length;
  }, [receivedOrders]);

  // Auto-release pack after delivery (when customer doesn't respond)
  const autoReleasePack = useCallback(async (orderId) => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'packOrder',
        action: 'autoRelease',
        payload: { orderId }
      });

      if (result.data.success) {
        showSuccess('Pack liberado automaticamente. O provedor recebeu os créditos.');
        
        // Update the order in messaging
        const order = packOrders.find(o => o.id === orderId);
        if (order) {
          await sendPackNotification({
            ...order,
            status: ORDER_STATUS.AUTO_RELEASED
          });
          
          // Mark pack conversation as completed
          await markPackConversationCompleted(orderId);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error auto-releasing pack:', error);
      showError('Erro ao liberar pack automaticamente');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, packOrders, sendPackNotification, showSuccess, showError]);

  const value = useMemo(() => ({
    // State
    packOrders,
    receivedOrders,
    sentOrders,
    loading,
    processing,

    // Actions
    acceptPackOrder,
    declinePackOrder,
    markPackDelivered,
    confirmPackDelivery,
    autoReleasePack,
    getOrderById,

    // Utilities
    getOrderStatusInfo,
    filterOrdersByStatus,
    getPendingOrdersCount,

    // Constants
    ORDER_STATUS
  }), [
    packOrders,
    receivedOrders,
    sentOrders,
    loading,
    processing,
    acceptPackOrder,
    declinePackOrder,
    markPackDelivered,
    confirmPackDelivery,
    autoReleasePack,
    getOrderById,
    getOrderStatusInfo,
    filterOrdersByStatus,
    getPendingOrdersCount
  ]);

  return (
    <PackOrderContext.Provider value={value}>
      {children}
    </PackOrderContext.Provider>
  );
};

export default PackOrderProvider;

