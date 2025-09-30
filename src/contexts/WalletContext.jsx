import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { useUser } from './UserContext';
import { redirectToCheckout, getPaymentStatusFromURL, cleanPaymentURL } from '../utils/stripe';
import { sendPackPurchaseNotification } from '../services/notificationService';

const WalletContext = createContext({});

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const { userProfile } = useUser();
  
  // Wallet state
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Refs to store unsubscribe functions
  const walletUnsubscribeRef = useRef(null);
  const transactionsUnsubscribeRef = useRef(null);

  // Firebase Functions (using the configured instance from firebase.js)
  const createStripeSession = httpsCallable(functions, 'createStripeSession');
  const initializeWallet = httpsCallable(functions, 'initializeWallet');
  const claimDailyBonusFunc = httpsCallable(functions, 'claimDailyBonus');
  const processPackSaleFunc = httpsCallable(functions, 'processPackSale');
  const apiFunc = httpsCallable(functions, 'api');

  // VP packages configuration
  const VP_PACKAGES = {
    'pack-20': { amount: 30, bonus: 0, price: 'R$ 20,00', name: 'Pacote Iniciante', priceInCents: 2000 },
    'pack-45': { amount: 66, bonus: 0, price: 'R$ 45,00', name: 'Pacote Essencial', priceInCents: 4500 },
    'pack-60': { amount: 85, bonus: 10, price: 'R$ 60,00', name: 'Pacote Bronze', priceInCents: 6000 },
    'pack-85': { amount: 120, bonus: 22, price: 'R$ 85,00', name: 'Pacote Prata', priceInCents: 8500 },
    'pack-96': { amount: 138, bonus: 36, price: 'R$ 96,00', name: 'Pacote Safira', priceInCents: 9600 },
    'pack-120': { amount: 168, bonus: 50, price: 'R$ 120,00', name: 'Pacote Ouro', priceInCents: 12000 },
    'pack-150': { amount: 218, bonus: 65, price: 'R$ 150,00', name: 'Pacote Platina', priceInCents: 15000 },
    'pack-200': { amount: 288, bonus: 85, price: 'R$ 200,00', name: 'Pacote Diamante', priceInCents: 20000 },
    'pack-255': { amount: 370, bonus: 110, price: 'R$ 255,00', name: 'Pacote Épico', priceInCents: 25500 },
    'pack-290': { amount: 415, bonus: 135, price: 'R$ 290,00', name: 'Pacote Lendário', priceInCents: 29000 },
    'pack-320': { amount: 465, bonus: 155, price: 'R$ 320,00', name: 'Pacote Mítico', priceInCents: 32000 }
  };

  // Helper functions to get individual balances (moved up to avoid circular dependency)
  const vpBalance = wallet?.vp || 0;
  const vcBalance = wallet?.vc || 0;
  const vbpBalance = wallet?.vbp || 0;
  const vcPendingBalance = wallet?.vcPending || 0;

  // Initialize wallet when user changes
  useEffect(() => {
    // Clean up existing listeners first
    if (walletUnsubscribeRef.current) {
      console.log('🧹 Cleaning up wallet listener');
      walletUnsubscribeRef.current();
      walletUnsubscribeRef.current = null;
    }
    if (transactionsUnsubscribeRef.current) {
      console.log('🧹 Cleaning up transactions listener');
      transactionsUnsubscribeRef.current();
      transactionsUnsubscribeRef.current = null;
    }

    if (currentUser) {
      console.log('👤 User logged in, initializing wallet and transactions');
      initUserWallet();
      loadTransactions();
      checkPaymentStatus();
    } else {
      console.log('👋 User logged out, clearing wallet state');
      setWallet(null);
      setTransactions([]);
      setLoading(false);
    }

    // Cleanup function
    return () => {
      if (walletUnsubscribeRef.current) {
        console.log('🧹 Cleanup: Unsubscribing wallet listener');
        walletUnsubscribeRef.current();
      }
      if (transactionsUnsubscribeRef.current) {
        console.log('🧹 Cleanup: Unsubscribing transactions listener');
        transactionsUnsubscribeRef.current();
      }
    };
  }, [currentUser]);

  // Check payment status from URL on mount
  const checkPaymentStatus = useCallback(() => {
    const { success, canceled, sessionId } = getPaymentStatusFromURL();
    
    if (success) {
      showSuccess('Pagamento realizado com sucesso! Seus VP foram adicionados à sua conta.', 'Pagamento Confirmado');
      cleanPaymentURL();
    } else if (canceled) {
      showInfo('Pagamento cancelado. Você pode tentar novamente quando quiser.', 'Pagamento Cancelado');
      cleanPaymentURL();
    }
  }, [showSuccess, showInfo]);

  // Initialize user wallet
  const initUserWallet = useCallback(async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Try to get existing wallet first
      const walletRef = doc(db, 'wallets', currentUser.uid);
      const walletSnap = await getDoc(walletRef);
      
      if (walletSnap.exists()) {
        const walletData = walletSnap.data();
        setWallet(walletData);
        
        // Set up real-time listener
        const unsubscribe = onSnapshot(walletRef, (doc) => {
          if (doc.exists()) {
            setWallet(doc.data());
          }
        });
        
        // Store unsubscribe function
        walletUnsubscribeRef.current = unsubscribe;
      } else {
        // Initialize new wallet via Cloud Function
        const result = await initializeWallet();
        if (result.data.success) {
          setWallet(result.data.wallet);
          
          // Set up real-time listener
          const unsubscribe = onSnapshot(walletRef, (doc) => {
            if (doc.exists()) {
              setWallet(doc.data());
            }
          });
          
          // Store unsubscribe function
          walletUnsubscribeRef.current = unsubscribe;
        }
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
      showError('Erro ao carregar carteira. Tente novamente.', 'Erro de Carteira');
    } finally {
      setLoading(false);
    }
  }, [currentUser, initializeWallet, showError]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!currentUser) return;

    try {
      console.log('🔍 Loading transactions for user:', currentUser.uid);
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('📊 Transaction snapshot received:', {
          size: snapshot.size,
          empty: snapshot.empty,
          hasPendingWrites: snapshot.metadata.hasPendingWrites
        });
        
        const transactionsList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Transaction document:', {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            createdAt: data.createdAt,
            amounts: data.amounts
          });
          
          const transaction = {
            id: doc.id,
            ...data,
            timestamp: data.createdAt ? data.createdAt.toMillis() : Date.now()
          };
          transactionsList.push(transaction);
        });
        
        console.log('✅ Total transactions loaded:', transactionsList.length);
        setTransactions(transactionsList);
      }, (error) => {
        console.error('❌ Transaction listener error:', error);
        showError('Erro ao carregar transações.', 'Erro');
      });
      
      // Store unsubscribe function
      transactionsUnsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error loading transactions:', error);
      showError('Erro ao carregar transações.', 'Erro');
    }
  }, [currentUser, showError]);

  // Buy VP function
  const buyVP = useCallback(async (packageId) => {
    if (!currentUser || processingPayment) return false;

    const selectedPackage = VP_PACKAGES[packageId];
    if (!selectedPackage) {
      showError('Pacote inválido selecionado.', 'Erro de Pacote');
      return false;
    }

    try {
      setProcessingPayment(true);
      showInfo('Redirecionando para o pagamento...', 'Processando');
      
      const result = await createStripeSession({ packageId });
      
      if (result.data.sessionId && result.data.url) {
        // Redirect to Stripe Checkout using utility
        await redirectToCheckout(result.data.sessionId);
        return true;
      } else {
        throw new Error('Erro ao criar sessão de pagamento');
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      showError('Erro ao processar pagamento. Tente novamente.', 'Erro de Pagamento');
      return false;
    } finally {
      setProcessingPayment(false);
    }
  }, [currentUser, processingPayment, createStripeSession, showError, showInfo]);

  // Claim daily bonus
  const claimDaily = useCallback(async () => {
    if (!currentUser) return false;

    try {
      const result = await claimDailyBonusFunc();
      
      if (result.data.success) {
        showSuccess(
          `Bônus diário recebido! ${result.data.bonusAmount} VBP foram adicionados à sua conta.`,
          'Bônus Diário'
        );
        
        // Refresh wallet data to show updated balance
        await initUserWallet();
        
        return true;
      }
      return false;
    } catch (error) {
      handleWalletError(error, 'claimDaily');
      return false;
    }
  }, [currentUser, claimDailyBonusFunc, showSuccess, showError, initUserWallet]);

  // Check if can claim daily bonus
  const canClaimDailyBonus = useCallback(() => {
    if (!userProfile) return false;
    
    const lastClaimDate = userProfile.lastDailyBonusClaim?.toDate();
    if (!lastClaimDate) return true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return lastClaimDate < today;
  }, [userProfile]);

  // Process pack sale (immediate VC)
  const processPackSale = useCallback(async (buyerId, sellerId, packId, packName, vpAmount) => {
    if (!currentUser) return false;

    try {
      const result = await processPackSaleFunc({
        buyerId,
        sellerId,
        vpAmount,
        packId,
        packName
      });

      if (result.data.success) {
        showSuccess(
          `Venda realizada! ${result.data.vcCredited} VC foram creditados.`,
          'Venda Concluída'
        );
        return true;
      }
      return false;
    } catch (error) {
      handleWalletError(error, 'processPackSale');
      return false;
    }
  }, [currentUser, processPackSaleFunc, showSuccess, showError]);

  // Process service purchase (VC goes to pending) - UPDATED to use unified API
  const processServicePurchase = useCallback(async (sellerId, serviceId, serviceName, serviceDescription, vpAmount) => {
    if (!currentUser) return false;

    try {
      const result = await apiFunc({
        resource: 'serviceOrder',
        action: 'create',
        payload: {
          serviceId,
          sellerId,
          vpAmount,
          additionalFeatures: [], // Default empty array
          metadata: {
            serviceName,
            serviceDescription
          }
        }
      });

      if (result.data.success) {
        showSuccess(
          `Serviço adquirido! ${vpAmount} VP foram debitados. O vendedor receberá VC após a confirmação.`,
          'Compra Realizada',
          7000,
          {
            onClick: () => {
              window.location.href = '/my-purchases';
            },
            data: { action: 'view_my_purchases' }
          }
        );
        return { success: true, serviceOrderId: result.data.order?.id };
      }
      return false;
    } catch (error) {
      handleWalletError(error, 'processServicePurchase');
      return false;
    }
  }, [currentUser, apiFunc, showSuccess, showError]);

  // Create pack order (requires seller approval)
  const createPackOrder = useCallback(async (buyerId, sellerId, packId, packName, vpAmount, buyerInfo = {}) => {
    if (!currentUser) return false;

    try {
      const payload = {
        buyerId,
        sellerId,
        vpAmount,
        packId,
        metadata: {
          packName
        },
        // Add buyer information for display in seller's orders
        buyerName: buyerInfo.displayName || buyerInfo.name || '',
        buyerDisplayName: buyerInfo.displayName || buyerInfo.name || '',
        buyerUsername: buyerInfo.username || '',
        buyerProfilePictureURL: buyerInfo.profilePictureURL || buyerInfo.photoURL || ''
      };
      
      console.log('Creating pack order with payload:', payload);
      
      const result = await apiFunc({
        resource: 'packOrder',
        action: 'create',
        payload
      });

      if (result.data.success) {
        // Send purchase notification to seller
        await sendPackPurchaseNotification(
          sellerId,
          buyerId,
          buyerInfo.displayName || buyerInfo.name || 'Cliente',
          packId,
          packName,
          vpAmount
        );

        showSuccess(
          `Pedido de pack enviado! A vendedora tem 24h para aprovar.`,
          'Pedido Enviado',
          7000,
          {
            onClick: () => {
              window.location.href = '/my-purchases';
            },
            data: { action: 'view_my_purchases' }
          }
        );
        return { success: true, packOrderId: result.data.packOrderId };
      }
      return false;
    } catch (error) {
      handleWalletError(error, 'createPackOrder');
      return false;
    }
  }, [currentUser, apiFunc, showSuccess, showError]);

  // Enhanced error handling (moved up to avoid circular dependency)
  const handleWalletError = useCallback((error, operation) => {
    console.error(`Wallet error in ${operation}:`, error);
    
    if (error.code === 'functions/unauthenticated') {
      showError('Sessão expirada. Faça login novamente.', 'Erro de Autenticação');
    } else if (error.code === 'functions/failed-precondition') {
      showError('Saldo insuficiente para realizar esta operação.', 'Saldo Insuficiente');
    } else if (error.code === 'functions/already-exists') {
      showWarning('Esta ação já foi realizada hoje.', 'Ação Duplicada');
    } else if (error.code === 'functions/not-found') {
      showError('Recurso não encontrado. Tente novamente.', 'Não Encontrado');
    } else {
      showError('Ocorreu um erro inesperado. Tente novamente.', 'Erro');
    }
  }, [showError, showWarning]);

  // Send Vixtip (gorjeta) - function without useCallback to avoid circular dependency
  const sendVixtip = async (vixtipData) => {
    if (!currentUser) return false;

    const { postId, postType, authorId, authorName, authorUsername, amount, buyerName, buyerUsername, buyerId, buyerProfilePictureURL } = vixtipData;

    try {
      // Verificar se o usuário tem saldo suficiente
      if (vpBalance < amount) {
        showError('Saldo VP insuficiente para enviar gorjeta.');
        return false;
      }

      // Calcular valor em VC que o autor receberá (1 VC = 1.5 VP, arredondado para cima)
      const vcAmount = Math.ceil(amount / 1.5);

      // Chamar função para processar a gorjeta (tudo no servidor)
      try {
        const processVixtipFunc = httpsCallable(functions, 'processVixtip');
        await processVixtipFunc({ 
          postId,
          postType,
          authorId,
          authorName,
          authorUsername,
          buyerId: buyerId || currentUser.uid,
          buyerName: buyerName || 'Usuário',
          buyerUsername: buyerUsername || '',
          buyerProfilePictureURL: buyerProfilePictureURL || '',
          vpAmount: amount,
          vcAmount
        });
        
        showSuccess(
          `Gorjeta de ${amount} VP enviada!`,
          'Vixtip Enviado'
        );
        return true;
      } catch (processError) {
        console.error('Erro ao processar gorjeta:', processError);
        showError('Ocorreu um erro ao enviar a gorjeta. Tente novamente.', 'Erro');
        return false;
      }

    } catch (error) {
      console.error('Error sending vixtip:', error);
      showError('Ocorreu um erro ao enviar a gorjeta. Tente novamente.', 'Erro');
      return false;
    }
  };

  // Format currency
  const formatCurrency = useCallback((amount, currency = '') => {
    if (amount === null || amount === undefined) return '0';
    
    const formatted = Math.abs(amount).toLocaleString('pt-BR');
    return currency ? `${formatted} ${currency}` : formatted;
  }, []);

  // Format date
  const formatDate = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Filter transactions
  const filterTransactions = useCallback((filters) => {
    console.log('🔍 Filtering transactions:', {
      totalTransactions: transactions.length,
      filters,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        userId: t.userId,
        timestamp: t.timestamp,
        amounts: t.amounts
      }))
    });
    
    const filtered = transactions.filter(transaction => {
      let matches = true;

      // Filter by currency
      if (filters.currency !== 'all') {
        const transactionCurrency = (transaction.amounts && Object.keys(transaction.amounts)[0]) || 'VP';
        matches = matches && (transactionCurrency.toLowerCase() === filters.currency);
      }

      // Filter by type
      if (filters.type !== 'all') {
        let transactionType = '';
        const amount = transaction.amounts ? Object.values(transaction.amounts)[0] : 0;
        
        if (amount > 0 && transaction.type !== 'BONUS') {
          transactionType = 'incoming';
        } else if (amount < 0) {
          transactionType = 'outgoing';
        } else if (transaction.type === 'BONUS') {
          transactionType = 'earned';
        } else if (transaction.type === 'BUY_VP') {
          transactionType = 'incoming'; // Treat BUY_VP as incoming since it's adding money to account
        }
        
        matches = matches && (transactionType === filters.type);
      }

      // Filter by period
      if (filters.period !== 'all') {
        const now = Date.now();
        const transactionTime = transaction.timestamp;
        let periodMs = 0;

        switch (filters.period) {
          case '7days':
            periodMs = 7 * 24 * 60 * 60 * 1000;
            break;
          case '30days':
            periodMs = 30 * 24 * 60 * 60 * 1000;
            break;
          case '3months':
            periodMs = 90 * 24 * 60 * 60 * 1000;
            break;
        }

        if (periodMs > 0) {
          matches = matches && (now - transactionTime <= periodMs);
        }
      }

      return matches;
    });
    
    console.log('✅ Filtered result:', {
      filteredCount: filtered.length,
      filtered: filtered.map(t => ({
        id: t.id,
        type: t.type,
        userId: t.userId,
        timestamp: t.timestamp,
        amounts: t.amounts
      }))
    });
    
    return filtered;
  }, [transactions]);


  // Get wallet summary for quick overview
  const getWalletSummary = useCallback(() => {
    if (!wallet) return null;
    
    const totalValue = vpBalance + (vcBalance * 1.5) + (vcPendingBalance * 1.5) + vbpBalance;
    
    return {
      totalValue,
      withdrawableValue: vcBalance, // Only VC can be withdrawn
      pendingValue: vcPendingBalance,
      bonusValue: vbpBalance,
      purchasePower: vpBalance
    };
  }, [wallet, vpBalance, vcBalance, vcPendingBalance, vbpBalance]);

  // Check if user can perform specific actions
  const canPerformAction = useCallback((action, amount = 0) => {
    if (!wallet) return false;
    
    switch (action) {
      case 'buy_service':
      case 'buy_pack':
        return vpBalance >= amount;
      case 'withdraw_vc':
        return vcBalance >= 50; // Minimum withdrawal: 50 VC
      case 'send_vp':
        return vpBalance >= amount && amount >= 1; // Minimum send: 1 VP
      case 'claim_daily':
        return canClaimDailyBonus();
      default:
        return false;
    }
  }, [wallet, vpBalance, vcBalance, canClaimDailyBonus]);

  // Get recent transactions (last 10)
  const getRecentTransactions = useCallback(() => {
    return transactions.slice(0, 10);
  }, [transactions]);


  const value = {
    // State
    wallet,
    transactions,
    loading,
    processingPayment,
    
    // Balances
    vpBalance,
    vcBalance,
    vbpBalance,
    vcPendingBalance,
    
    // Actions
    buyVP,
    claimDaily,
    canClaimDailyBonus,
    processPackSale,
    processServicePurchase,
    createPackOrder,
    sendVixtip,
    
    // Utilities
    formatCurrency,
    formatDate,
    filterTransactions,
    getWalletSummary,
    canPerformAction,
    getRecentTransactions,
    handleWalletError,
    
    // Constants
    VP_PACKAGES
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
