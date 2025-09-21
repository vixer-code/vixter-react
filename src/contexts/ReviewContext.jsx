import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

const ReviewContext = createContext({});

export const useReview = () => {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
};

export const ReviewProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  
  // State
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Load reviews for a specific user (seller or buyer)
  const loadUserReviews = useCallback(async (userId, type = 'all') => {
    if (!userId) return [];

    try {
      setLoading(true);
      const reviewsRef = collection(db, 'reviews');
      let q;

      if (type === 'all') {
        q = query(
          reviewsRef,
          where('targetUserId', '==', userId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          reviewsRef,
          where('targetUserId', '==', userId),
          where('type', '==', type),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const reviewsData = [];
      
      snapshot.forEach((doc) => {
        reviewsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return reviewsData;
    } catch (error) {
      console.error('Error loading user reviews:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load reviews given by a specific user
  const loadUserGivenReviews = useCallback(async (userId) => {
    if (!userId) return [];

    try {
      setLoading(true);
      const reviewsRef = collection(db, 'reviews');
      const q = query(
        reviewsRef,
        where('reviewerId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const reviewsData = [];
      
      snapshot.forEach((doc) => {
        reviewsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return reviewsData;
    } catch (error) {
      console.error('Error loading user given reviews:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load reviews for a specific item (service or pack)
  const loadItemReviews = useCallback(async (itemId, itemType) => {
    if (!itemId || !itemType) return [];

    try {
      setLoading(true);
      const reviewsRef = collection(db, 'reviews');
      const q = query(
        reviewsRef,
        where('itemId', '==', itemId),
        where('type', '==', itemType),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const reviewsData = [];
      
      snapshot.forEach((doc) => {
        reviewsData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return reviewsData;
    } catch (error) {
      console.error('Error loading item reviews:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a service/pack review
  const createServiceReview = useCallback(async (orderId, rating, comment, orderType = 'service') => {
    if (!currentUser) {
      showError('Você precisa estar logado para avaliar');
      return false;
    }

    if (!rating || rating < 1 || rating > 5) {
      showError('Avaliação deve ser entre 1 e 5 estrelas');
      return false;
    }

    if (!comment || comment.trim().length === 0) {
      showError('Comentário é obrigatório');
      return false;
    }

    if (comment.length > 200) {
      showError('Comentário deve ter no máximo 200 caracteres');
      return false;
    }

    try {
      setProcessing(true);

      // Get order details
      const orderRef = doc(db, orderType === 'service' ? 'serviceOrders' : 'packOrders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        showError('Pedido não encontrado');
        return false;
      }

      const orderData = orderSnap.data();

      // Check if user is the buyer
      if (orderData.buyerId !== currentUser.uid) {
        showError('Apenas o comprador pode avaliar este pedido');
        return false;
      }

      // Check if order is completed
      if (!['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'].includes(orderData.status)) {
        showError('Apenas pedidos finalizados podem ser avaliados');
        return false;
      }

      // Check if review already exists
      const existingReviewQuery = query(
        collection(db, 'reviews'),
        where('orderId', '==', orderId),
        where('reviewerId', '==', currentUser.uid),
        where('type', '==', orderType)
      );
      
      const existingSnapshot = await getDocs(existingReviewQuery);
      if (!existingSnapshot.empty) {
        showError('Você já avaliou este pedido');
        return false;
      }

      // Get reviewer user info
      const reviewerRef = doc(db, 'users', currentUser.uid);
      const reviewerSnap = await getDoc(reviewerRef);
      const reviewerData = reviewerSnap.exists() ? reviewerSnap.data() : {};

      // Create review
      const reviewData = {
        type: orderType,
        orderId: orderId,
        reviewerId: currentUser.uid,
        reviewerUsername: reviewerData.username || currentUser.displayName || 'Usuário',
        reviewerPhotoURL: currentUser.photoURL || null,
        targetUserId: orderData.sellerId,
        targetUsername: orderData.sellerUsername || 'Vendedor',
        rating: rating,
        comment: comment.trim(),
        itemId: orderType === 'service' ? orderData.serviceId : orderData.packId,
        itemName: orderData.metadata?.serviceName || orderData.metadata?.packName || 'Item',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      
      showSuccess('Avaliação enviada com sucesso!');
      return { success: true, reviewId: docRef.id };
    } catch (error) {
      console.error('Error creating service review:', error);
      showError('Erro ao enviar avaliação');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, showSuccess, showError]);

  // Create a behavior review (seller evaluating buyer or buyer evaluating seller)
  const createBehaviorReview = useCallback(async (targetUserId, rating, comment, userType = 'seller') => {
    if (!currentUser) {
      showError('Você precisa estar logado para avaliar');
      return false;
    }

    if (!rating || rating < 1 || rating > 5) {
      showError('Avaliação deve ser entre 1 e 5 estrelas');
      return false;
    }

    if (!comment || comment.trim().length === 0) {
      showError('Comentário é obrigatório');
      return false;
    }

    if (comment.length > 200) {
      showError('Comentário deve ter no máximo 200 caracteres');
      return false;
    }

    try {
      setProcessing(true);

      // For buyers, check if they purchased from this seller
      if (userType === 'buyer') {
        const serviceOrdersQuery = query(
          collection(db, 'serviceOrders'),
          where('buyerId', '==', currentUser.uid),
          where('sellerId', '==', targetUserId),
          where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
        );

        const packOrdersQuery = query(
          collection(db, 'packOrders'),
          where('buyerId', '==', currentUser.uid),
          where('sellerId', '==', targetUserId),
          where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
        );

        const [serviceSnapshot, packSnapshot] = await Promise.all([
          getDocs(serviceOrdersQuery),
          getDocs(packOrdersQuery)
        ]);

        if (serviceSnapshot.empty && packSnapshot.empty) {
          showError('Você só pode avaliar vendedoras que prestaram serviços/packs para você');
          return false;
        }
      }

      // Check if behavior review already exists
      const existingReviewQuery = query(
        collection(db, 'reviews'),
        where('reviewerId', '==', currentUser.uid),
        where('targetUserId', '==', targetUserId),
        where('type', '==', 'behavior')
      );
      
      const existingSnapshot = await getDocs(existingReviewQuery);
      if (!existingSnapshot.empty) {
        showError('Você já avaliou este usuário');
        return false;
      }

      // Get reviewer and target user info
      const reviewerRef = doc(db, 'users', currentUser.uid);
      const targetRef = doc(db, 'users', targetUserId);
      const [reviewerSnap, targetSnap] = await Promise.all([
        getDoc(reviewerRef),
        getDoc(targetRef)
      ]);
      const reviewerData = reviewerSnap.exists() ? reviewerSnap.data() : {};
      const targetData = targetSnap.exists() ? targetSnap.data() : {};

      // Create behavior review
      const reviewData = {
        type: 'behavior',
        orderId: null,
        reviewerId: currentUser.uid,
        reviewerUsername: reviewerData.username || currentUser.displayName || 'Usuário',
        reviewerPhotoURL: currentUser.photoURL || null,
        targetUserId: targetUserId,
        targetUsername: targetData.username || targetData.displayName || 'Usuário',
        rating: rating,
        comment: comment.trim(),
        itemId: null,
        itemName: 'Comportamento',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      
      showSuccess('Avaliação de comportamento enviada com sucesso!');
      return { success: true, reviewId: docRef.id };
    } catch (error) {
      console.error('Error creating behavior review:', error);
      showError('Erro ao enviar avaliação');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, showSuccess, showError]);

  // Update a review
  const updateReview = useCallback(async (reviewId, rating, comment) => {
    if (!currentUser) {
      showError('Você precisa estar logado para editar avaliação');
      return false;
    }

    if (!rating || rating < 1 || rating > 5) {
      showError('Avaliação deve ser entre 1 e 5 estrelas');
      return false;
    }

    if (!comment || comment.trim().length === 0) {
      showError('Comentário é obrigatório');
      return false;
    }

    if (comment.length > 200) {
      showError('Comentário deve ter no máximo 200 caracteres');
      return false;
    }

    try {
      setProcessing(true);

      const reviewRef = doc(db, 'reviews', reviewId);
      const reviewSnap = await getDoc(reviewRef);
      
      if (!reviewSnap.exists()) {
        showError('Avaliação não encontrada');
        return false;
      }

      const reviewData = reviewSnap.data();

      // Check if user is the reviewer
      if (reviewData.reviewerId !== currentUser.uid) {
        showError('Você só pode editar suas próprias avaliações');
        return false;
      }

      // Update review
      await updateDoc(reviewRef, {
        rating: rating,
        comment: comment.trim(),
        updatedAt: serverTimestamp()
      });
      
      showSuccess('Avaliação atualizada com sucesso!');
      return true;
    } catch (error) {
      console.error('Error updating review:', error);
      showError('Erro ao atualizar avaliação');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, showSuccess, showError]);

  // Delete a review
  const deleteReview = useCallback(async (reviewId) => {
    if (!currentUser) {
      showError('Você precisa estar logado para excluir avaliação');
      return false;
    }

    try {
      setProcessing(true);

      const reviewRef = doc(db, 'reviews', reviewId);
      const reviewSnap = await getDoc(reviewRef);
      
      if (!reviewSnap.exists()) {
        showError('Avaliação não encontrada');
        return false;
      }

      const reviewData = reviewSnap.data();

      // Check if user is the reviewer
      if (reviewData.reviewerId !== currentUser.uid) {
        showError('Você só pode excluir suas próprias avaliações');
        return false;
      }

      // Delete review
      await deleteDoc(reviewRef);
      
      showSuccess('Avaliação excluída com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting review:', error);
      showError('Erro ao excluir avaliação');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [currentUser, showSuccess, showError]);

  // Get average rating for a user
  const getAverageRating = useCallback((reviews) => {
    if (!reviews || reviews.length === 0) return 0;
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return Math.round((totalRating / reviews.length) * 10) / 10; // Round to 1 decimal place
  }, []);

  // Get rating distribution for a user
  const getRatingDistribution = useCallback((reviews) => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    reviews.forEach(review => {
      if (distribution.hasOwnProperty(review.rating)) {
        distribution[review.rating]++;
      }
    });
    
    return distribution;
  }, []);

  // Check if user can review a specific order
  const canReviewOrder = useCallback(async (orderId, orderType = 'service') => {
    if (!currentUser) return false;

    try {
      const orderRef = doc(db, orderType === 'service' ? 'serviceOrders' : 'packOrders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) return false;

      const orderData = orderSnap.data();

      // Check if user is the buyer
      if (orderData.buyerId !== currentUser.uid) return false;

      // Check if order is completed
      if (!['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'].includes(orderData.status)) return false;

      // Check if review already exists
      const existingReviewQuery = query(
        collection(db, 'reviews'),
        where('orderId', '==', orderId),
        where('reviewerId', '==', currentUser.uid),
        where('type', '==', orderType)
      );
      
      const existingSnapshot = await getDocs(existingReviewQuery);
      return existingSnapshot.empty;
    } catch (error) {
      console.error('Error checking if user can review order:', error);
      return false;
    }
  }, [currentUser]);

  // Check if user can review buyer behavior
  const canReviewBuyerBehavior = useCallback(async (targetUserId, userType = 'seller') => {
    if (!currentUser) return false;

    try {
      // Providers can review any user's behavior
      if (userType === 'seller') {
        // Check if behavior review already exists
        const existingReviewQuery = query(
          collection(db, 'reviews'),
          where('reviewerId', '==', currentUser.uid),
          where('targetUserId', '==', targetUserId),
          where('type', '==', 'behavior')
        );
        
        const existingSnapshot = await getDocs(existingReviewQuery);
        return existingSnapshot.empty;
      }

      // Clients can only review providers who provided services/packs to them
      if (userType === 'buyer') {
        // Check if user has purchased from this seller
        const serviceOrdersQuery = query(
          collection(db, 'serviceOrders'),
          where('buyerId', '==', currentUser.uid),
          where('sellerId', '==', targetUserId),
          where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
        );

        const packOrdersQuery = query(
          collection(db, 'packOrders'),
          where('buyerId', '==', currentUser.uid),
          where('sellerId', '==', targetUserId),
          where('status', 'in', ['CONFIRMED', 'COMPLETED', 'AUTO_RELEASED'])
        );

        const [serviceSnapshot, packSnapshot] = await Promise.all([
          getDocs(serviceOrdersQuery),
          getDocs(packOrdersQuery)
        ]);

        if (serviceSnapshot.empty && packSnapshot.empty) return false;

        // Check if behavior review already exists
        const existingReviewQuery = query(
          collection(db, 'reviews'),
          where('reviewerId', '==', currentUser.uid),
          where('targetUserId', '==', targetUserId),
          where('type', '==', 'behavior')
        );
        
        const existingSnapshot = await getDocs(existingReviewQuery);
        return existingSnapshot.empty;
      }

      return false;
    } catch (error) {
      console.error('Error checking if user can review buyer behavior:', error);
      return false;
    }
  }, [currentUser]);

  const value = useMemo(() => ({
    // State
    reviews,
    loading,
    processing,

    // Actions
    loadUserReviews,
    loadUserGivenReviews,
    loadItemReviews,
    createServiceReview,
    createBehaviorReview,
    updateReview,
    deleteReview,

    // Utilities
    getAverageRating,
    getRatingDistribution,
    canReviewOrder,
    canReviewBuyerBehavior
  }), [
    reviews,
    loading,
    processing,
    loadUserReviews,
    loadUserGivenReviews,
    loadItemReviews,
    createServiceReview,
    createBehaviorReview,
    updateReview,
    deleteReview,
    getAverageRating,
    getRatingDistribution,
    canReviewOrder,
    canReviewBuyerBehavior
  ]);

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
};

export default ReviewProvider;
