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
import { 
  sendServiceAcceptedEmail, 
  sendServiceDeliveredEmail, 
  sendServiceCompletedEmail, 
  sendServiceCancelledEmail 
} from '../services/emailService';
import { 
  sendServicePurchaseNotification, 
  sendServiceAcceptedNotification 
} from '../services/notificationService';

const ServiceOrderContext = createContext({});

export const useServiceOrder = () => {
  const context = useContext(ServiceOrderContext);
  if (!context) {
    throw new Error('useServiceOrder must be used within a ServiceOrderProvider');
  }
  return context;
};

export const ServiceOrderProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const { processServicePurchase } = useWallet();
  
  // Safely get messaging functions with fallbacks
  let sendServiceNotification, createServiceConversation, markServiceConversationCompleted;
  try {
    const messagingContext = useMessaging();
    sendServiceNotification = messagingContext?.sendServiceNotification || (() => Promise.resolve());
    createServiceConversation = messagingContext?.createServiceConversation || (() => Promise.resolve(null));
    markServiceConversationCompleted = messagingContext?.markServiceConversationCompleted || (() => Promise.resolve());
    
        console.log('🔍 Messaging context functions loaded:', {
          sendServiceNotification: typeof sendServiceNotification,
          createServiceConversation: typeof createServiceConversation,
          markServiceConversationCompleted: typeof markServiceConversationCompleted
        });
      } catch (error) {
        console.warn('❌ Messaging context not available, using fallback functions:', error);
        console.warn('❌ Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        sendServiceNotification = () => Promise.resolve();
        createServiceConversation = () => Promise.resolve(null);
        markServiceConversationCompleted = () => Promise.resolve();
      }
  
  // State
  const [serviceOrders, setServiceOrders] = useState([]);
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
    CANCELLED: 'CANCELLED',
    DISPUTED: 'DISPUTED'
  };

  // Load service orders
  useEffect(() => {
    if (!currentUser) {
      setServiceOrders([]);
      setReceivedOrders([]);
      setSentOrders([]);
      setLoading(false);
      return;
    }

    // Load orders where user is the seller (received orders)
    const receivedOrdersRef = collection(db, 'serviceOrders');
    const receivedOrdersQuery = query(
      receivedOrdersRef,
      where('sellerId', '==', currentUser.uid)
      // Temporarily removed orderBy to debug
      // orderBy('timestamps.createdAt', 'desc')
    );

    const unsubscribeReceived = onSnapshot(receivedOrdersQuery, (snapshot) => {
      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setReceivedOrders(orders);
    }, (error) => {
      console.error('Error loading received orders:', error);
    });

    // Load orders where user is the buyer (sent orders)
    const sentOrdersRef = collection(db, 'serviceOrders');
    const sentOrdersQuery = query(
      sentOrdersRef,
      where('buyerId', '==', currentUser.uid),
      orderBy('timestamps.createdAt', 'desc')
    );

    const unsubscribeSent = onSnapshot(sentOrdersQuery, (snapshot) => {
      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setSentOrders(orders);
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
    setServiceOrders(uniqueOrders);
  }, [receivedOrders, sentOrders]);

  // Create service order
  const createServiceOrder = useCallback(async (serviceData, additionalFeatures = []) => {
    if (!currentUser) {
      showError('Você precisa estar logado para fazer um pedido');
      return false;
    }

    // Prevent multiple simultaneous calls
    if (processing) {
      console.log('Service order creation already in progress, ignoring duplicate call');
      return false;
    }

    try {
      setProcessing(true);

      // Check for existing pending orders for the same service by the same user
      const existingOrder = sentOrders.find(order => 
        order.serviceId === serviceData.id && 
        order.buyerId === currentUser.uid && 
        (order.status === 'PENDING_ACCEPTANCE' || order.status === 'ACCEPTED')
      );

      if (existingOrder) {
        showWarning('Você já possui um pedido pendente para este serviço. Aguarde a resposta do provedor.');
        setProcessing(false);
        return false;
      }

      // Calculate total price including discount
      const basePrice = serviceData.price || 0;
      const discount = serviceData.discount || 0;
      const discountedPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
      const featuresTotal = additionalFeatures.reduce((total, feature) => {
        const price = feature.price || feature.vpAmount || 0;
        return total + (isNaN(price) ? 0 : price);
      }, 0);
      const totalVpAmount = Math.round((discountedPrice + featuresTotal) * 1.5); // Convert VC to VP (1 VC = 1.5 VP)

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'create',
        payload: {
          serviceId: serviceData.id,
          sellerId: serviceData.providerId,
          vpAmount: totalVpAmount,
          additionalFeatures: additionalFeatures,
          metadata: {
            serviceName: serviceData.title,
            serviceDescription: serviceData.description,
            originalPrice: basePrice,
            discount: discount,
            discountedPrice: discountedPrice
          }
        }
      });

      if (result.data.success) {
        const orderData = result.data.order;
        
        // The service order creation already processes the payment (debits VP from buyer and adds VC pending to seller)
        // Calculate VC amount for notifications
        const vcAmount = Math.ceil(totalVpAmount / 1.5); // Convert VP to VC (1 VC = 1.5 VP, rounded up)
        
        // Send service notification to messaging
        await sendServiceNotification({
          id: orderData.id,
          serviceName: serviceData.title,
          buyerId: currentUser.uid,
          sellerId: serviceData.providerId,
          vpAmount: totalVpAmount,
          vcAmount: vcAmount,
          status: ORDER_STATUS.PENDING_ACCEPTANCE,
          additionalFeatures: additionalFeatures,
          metadata: {
            serviceName: serviceData.title,
            serviceDescription: serviceData.description
          }
        });

        // Send purchase notification to seller
        await sendServicePurchaseNotification(
          serviceData.providerId,
          currentUser.uid,
          currentUser.displayName || 'Cliente',
          serviceData.id,
          serviceData.title,
          totalVpAmount
        );

        showSuccess(
          'Pedido de serviço enviado com sucesso! O provedor foi notificado e receberá o pedido em breve.',
          'Pedido Enviado',
          7000,
          {
            onClick: () => {
              window.location.href = '/my-purchases';
            },
            data: { action: 'view_my_purchases' }
          }
        );
        return { success: true, orderId: orderData.id };
      }

      return false;
    } catch (error) {
      console.error('Error creating service order:', error);
      showError('Erro ao criar pedido de serviço');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, sendServiceNotification, showSuccess, showError]);

  // Accept service order
  const acceptServiceOrder = useCallback(async (orderId) => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'accept',
        payload: { orderId }
      });

      if (result.data.success) {
        showSuccess('Pedido aceito com sucesso! Uma conversa foi criada para comunicação com o cliente.');
        
        // Update the order in messaging and create conversation
        const order = serviceOrders.find(o => o.id === orderId);
        console.log('🔍 Found order for conversation:', order);
        console.log('🔍 createServiceConversation function:', typeof createServiceConversation);
        
        if (order) {
          await sendServiceNotification({
            ...order,
            status: ORDER_STATUS.ACCEPTED
          });
          
          // Create service conversation
          console.log('🚀 Creating service conversation...');
          console.log('🔍 Order data being passed:', {
            id: order.id,
            buyerId: order.buyerId,
            sellerId: order.sellerId,
            metadata: order.metadata
          });
          
          try {
            console.log('🔍 Calling createServiceConversation with order:', order);
            console.log('🔍 createServiceConversation function type:', typeof createServiceConversation);
            
            const conversation = await createServiceConversation(order);
            console.log('✅ Service conversation result:', conversation);
            
            if (!conversation) {
              console.error('❌ Failed to create service conversation - function returned null');
            } else {
              console.log('✅ Service conversation created successfully:', conversation.id);
              
              // Update the service order with the chatId
              try {
                console.log('🚀 Updating service order with chatId:', conversation.id);
                const updateResult = await apiFunc({
                  resource: 'serviceOrder',
                  action: 'update',
                  payload: { 
                    orderId: order.id,
                    updates: { chatId: conversation.id }
                  }
                });
                
                if (updateResult.data.success) {
                  console.log('✅ Service order updated with chatId successfully');
                } else {
                  console.error('❌ Failed to update service order with chatId:', updateResult.data.error);
                }
              } catch (updateError) {
                console.error('❌ Error updating service order with chatId:', updateError);
                console.error('❌ Update error details:', {
                  message: updateError.message,
                  code: updateError.code,
                  stack: updateError.stack,
                  orderId: order.id,
                  chatId: conversation.id
                });
              }
            }
          } catch (conversationError) {
            console.error('❌ Error creating service conversation:', conversationError);
            console.error('❌ Error details:', {
              message: conversationError.message,
              code: conversationError.code,
              stack: conversationError.stack,
              order: order
            });
          }

          // Send email notification to buyer
          try {
            const buyerData = await loadUserDataForEmail(order.buyerId);
            const sellerData = await loadUserDataForEmail(order.sellerId);
            
            if (buyerData && sellerData) {
              await sendServiceAcceptedEmail(order, sellerData, buyerData);
              console.log('Service accepted email sent to buyer');
            }
          } catch (emailError) {
            console.error('Error sending service accepted email:', emailError);
            // Don't fail the main operation if email fails
          }

          // Send acceptance notification to buyer
          await sendServiceAcceptedNotification(
            order.buyerId,
            order.sellerId,
            currentUser.displayName || 'Provedor',
            order.serviceId,
            order.serviceName || order.metadata?.serviceName,
            orderId
          );
        } else {
          console.error('❌ Order not found for conversation creation:', orderId);
          console.error('❌ Available orders:', serviceOrders.map(o => ({ id: o.id, status: o.status })));
        }
        
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error accepting service order:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        orderId: orderId
      });
      showError('Erro ao aceitar pedido');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, serviceOrders, sendServiceNotification, createServiceConversation, showSuccess, showError]);

  // Helper function to load user data for email notifications
  const loadUserDataForEmail = useCallback(async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return {
          id: userSnap.id,
          ...userSnap.data()
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading user data for email:', error);
      return null;
    }
  }, []);

  // Decline service order
  const declineServiceOrder = useCallback(async (orderId, reason = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'decline',
        payload: { orderId, reason }
      });

      if (result.data.success) {
        showSuccess('Pedido recusado. O valor foi devolvido ao cliente.');
        
        // Update the order in messaging
        const order = serviceOrders.find(o => o.id === orderId);
        if (order) {
          await sendServiceNotification({
            ...order,
            status: ORDER_STATUS.CANCELLED,
            cancellationReason: reason
          });
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error declining service order:', error);
      showError('Erro ao recusar pedido');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, serviceOrders, sendServiceNotification, showSuccess, showError]);

  // Mark service as delivered
  const markServiceDelivered = useCallback(async (orderId, deliveryNotes = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'deliver',
        payload: { orderId, deliveryNotes }
      });

      if (result.data.success) {
        showSuccess('Serviço marcado como entregue! O cliente foi notificado e pode confirmar a entrega.');
        
        // Update the order in messaging
        const order = serviceOrders.find(o => o.id === orderId);
        if (order) {
          await sendServiceNotification({
            ...order,
            status: ORDER_STATUS.DELIVERED,
            deliveryNotes
          });

          // Mark service conversation as completed when delivered
          await markServiceConversationCompleted(orderId);

          // Send email notification to buyer
          try {
            const buyerData = await loadUserDataForEmail(order.buyerId);
            const sellerData = await loadUserDataForEmail(order.sellerId);
            
            if (buyerData && sellerData) {
              await sendServiceDeliveredEmail(order, sellerData, buyerData);
              console.log('Service delivered email sent to buyer');
            }
          } catch (emailError) {
            console.error('Error sending service delivered email:', emailError);
            // Don't fail the main operation if email fails
          }
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error marking service as delivered:', error);
      showError('Erro ao marcar serviço como entregue');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, serviceOrders, sendServiceNotification, showSuccess, showError]);

  // Confirm service delivery
  const confirmServiceDelivery = useCallback(async (orderId, feedback = '') => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'confirm',
        payload: { orderId, feedback }
      });

      if (result.data.success) {
        showSuccess('Entrega confirmada! O provedor receberá os créditos e a conversa será finalizada.');
        
        // Update the order in messaging
        const order = serviceOrders.find(o => o.id === orderId);
        if (order) {
          await sendServiceNotification({
            ...order,
            status: ORDER_STATUS.CONFIRMED,
            buyerFeedback: feedback
          });
          
          // Mark service conversation as completed
          await markServiceConversationCompleted(orderId);

          // Send email notification to seller
          try {
            const buyerData = await loadUserDataForEmail(order.buyerId);
            const sellerData = await loadUserDataForEmail(order.sellerId);
            
            if (buyerData && sellerData) {
              await sendServiceCompletedEmail(order, sellerData, buyerData);
              console.log('Service completed email sent to seller');
            }
          } catch (emailError) {
            console.error('Error sending service completed email:', emailError);
            // Don't fail the main operation if email fails
          }
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error confirming service delivery:', error);
      showError('Erro ao confirmar entrega');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, serviceOrders, sendServiceNotification, showSuccess, showError]);

  // Get order by ID
  const getOrderById = useCallback(async (orderId) => {
    if (!orderId) return null;

    try {
      const orderRef = doc(db, 'serviceOrders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        return {
          id: orderSnap.id,
          ...orderSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }, []);

  // Calculate order total amount including features
  const calculateOrderTotal = useCallback((basePrice, additionalFeatures = []) => {
    const featuresTotal = additionalFeatures.reduce((total, feature) => 
      total + (feature.price || 0), 0
    );
    return basePrice + featuresTotal;
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
      [ORDER_STATUS.CANCELLED]: {
        label: 'Cancelado',
        color: 'danger',
        icon: 'times-circle'
      },
      [ORDER_STATUS.DISPUTED]: {
        label: 'Em Disputa',
        color: 'warning',
        icon: 'exclamation-triangle'
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
    return serviceOrders.filter(order => order.status === status);
  }, [serviceOrders]);

  // Get pending orders count
  const getPendingOrdersCount = useCallback(() => {
    return receivedOrders.filter(order => 
      order.status === ORDER_STATUS.PENDING_ACCEPTANCE
    ).length;
  }, [receivedOrders]);

  // Auto-release service after delivery (when customer doesn't respond)
  const autoReleaseService = useCallback(async (orderId) => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'autoRelease',
        payload: { orderId }
      });

      if (result.data.success) {
        showSuccess('Serviço liberado automaticamente. O provedor recebeu os créditos.');
        
        // Update the order in messaging
        const order = serviceOrders.find(o => o.id === orderId);
        if (order) {
          await sendServiceNotification({
            ...order,
            status: ORDER_STATUS.AUTO_RELEASED
          });
          
          // Mark service conversation as completed
          await markServiceConversationCompleted(orderId);
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error auto-releasing service:', error);
      showError('Erro ao liberar serviço automaticamente');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, apiFunc, serviceOrders, sendServiceNotification, showSuccess, showError]);

  // Fix service orders that don't have chatId (for existing orders)
  const fixServiceOrderChatId = useCallback(async (orderId) => {
    if (!currentUser) return false;

    try {
      setProcessing(true);

      // Get the order
      const order = serviceOrders.find(o => o.id === orderId);
      if (!order) {
        showError('Pedido não encontrado');
        return false;
      }

      // Check if order is accepted but doesn't have chatId
      if (order.status === 'ACCEPTED' && !order.chatId) {
        console.log('🔧 Fixing service order without chatId:', orderId);
        
        // Create the conversation
        const conversation = await createServiceConversation(order);
        if (conversation) {
          // Update the service order with the chatId
          const updateResult = await apiFunc({
            resource: 'serviceOrder',
            action: 'update',
            payload: { 
              orderId: order.id,
              updates: { chatId: conversation.id }
            }
          });
          
          if (updateResult.data.success) {
            showSuccess('Conversa criada e vinculada ao serviço com sucesso!');
            return true;
          } else {
            showError('Erro ao vincular conversa ao serviço');
            return false;
          }
        } else {
          showError('Erro ao criar conversa para o serviço');
          return false;
        }
      } else {
        showInfo('Este serviço já possui uma conversa vinculada');
        return true;
      }
    } catch (error) {
      console.error('Error fixing service order chatId:', error);
      showError('Erro ao corrigir conversa do serviço');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, serviceOrders, createServiceConversation, showSuccess, showError, showInfo]);

  const value = useMemo(() => ({
    // State
    serviceOrders,
    receivedOrders,
    sentOrders,
    loading,
    processing,

    // Actions
    createServiceOrder,
    acceptServiceOrder,
    declineServiceOrder,
    markServiceDelivered,
    confirmServiceDelivery,
    autoReleaseService,
    fixServiceOrderChatId,
    getOrderById,

    // Utilities
    calculateOrderTotal,
    getOrderStatusInfo,
    filterOrdersByStatus,
    getPendingOrdersCount,

    // Constants
    ORDER_STATUS
  }), [
    serviceOrders,
    receivedOrders,
    sentOrders,
    loading,
    processing,
    createServiceOrder,
    acceptServiceOrder,
    declineServiceOrder,
    markServiceDelivered,
    confirmServiceDelivery,
    autoReleaseService,
    fixServiceOrderChatId,
    getOrderById,
    calculateOrderTotal,
    getOrderStatusInfo,
    filterOrdersByStatus,
    getPendingOrdersCount
  ]);

  return (
    <ServiceOrderContext.Provider value={value}>
      {children}
    </ServiceOrderContext.Provider>
  );
};

export default ServiceOrderProvider;
