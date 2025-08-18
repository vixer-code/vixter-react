// Wallet transaction utilities for pack and service sales
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

// Using the configured functions instance from firebase.js

/**
 * Process pack sale (immediate VC release)
 * @param {string} buyerId - User ID of the buyer
 * @param {string} packId - Pack ID being purchased
 * @param {string} packName - Name of the pack
 * @param {number} vpAmount - VP amount being paid
 * @returns {Promise<{success: boolean, vcCredited?: number, error?: string}>}
 */
export const processPackSale = async (buyerId, packId, packName, vpAmount) => {
  try {
    const processPackSaleFunc = httpsCallable(functions, 'processPackSale');
    
    const result = await processPackSaleFunc({
      buyerId,
      sellerId: getCurrentUserId(), // Assumes current user is the seller
      vpAmount,
      packId,
      packName
    });

    if (result.data.success) {
      return {
        success: true,
        vcCredited: result.data.vcCredited,
        conversionRate: result.data.conversionRate
      };
    }
    
    return { success: false, error: 'Transaction failed' };
  } catch (error) {
    console.error('Error processing pack sale:', error);
    return { 
      success: false, 
      error: error.code === 'functions/failed-precondition' 
        ? 'Buyer has insufficient balance' 
        : 'Transaction failed. Please try again.'
    };
  }
};

/**
 * Process service purchase (VC goes to pending)
 * @param {string} sellerId - User ID of the service provider
 * @param {string} serviceId - Service ID being purchased
 * @param {string} serviceName - Name of the service
 * @param {string} serviceDescription - Description of the service
 * @param {number} vpAmount - VP amount being paid
 * @returns {Promise<{success: boolean, serviceOrderId?: string, error?: string}>}
 */
export const processServicePurchase = async (sellerId, serviceId, serviceName, serviceDescription, vpAmount) => {
  try {
    const processServicePurchaseFunc = httpsCallable(functions, 'processServicePurchase');
    
    const result = await processServicePurchaseFunc({
      buyerId: getCurrentUserId(), // Assumes current user is the buyer
      sellerId,
      vpAmount,
      serviceId,
      serviceName,
      serviceDescription
    });

    if (result.data.success) {
      return {
        success: true,
        serviceOrderId: result.data.serviceOrderId,
        vcPending: result.data.vcPending,
        conversionRate: result.data.conversionRate
      };
    }
    
    return { success: false, error: 'Transaction failed' };
  } catch (error) {
    console.error('Error processing service purchase:', error);
    return { 
      success: false, 
      error: error.code === 'functions/failed-precondition' 
        ? 'Insufficient balance to complete purchase' 
        : 'Transaction failed. Please try again.'
    };
  }
};

/**
 * Calculate VC amount from VP amount using conversion rate
 * @param {number} vpAmount - VP amount
 * @returns {number} VC amount (rounded down)
 */
export const calculateVCFromVP = (vpAmount) => {
  return Math.floor(vpAmount / 1.5);
};

/**
 * Calculate VP amount from VC amount using conversion rate
 * @param {number} vcAmount - VC amount
 * @returns {number} VP amount
 */
export const calculateVPFromVC = (vcAmount) => {
  return vcAmount * 1.5;
};

/**
 * Validate if user has sufficient VP balance for a transaction
 * @param {number} requiredVP - Required VP amount
 * @param {number} userVPBalance - User's current VP balance
 * @returns {boolean} True if user has sufficient balance
 */
export const validateVPBalance = (requiredVP, userVPBalance) => {
  return userVPBalance >= requiredVP;
};

/**
 * Format transaction summary for display
 * @param {number} vpAmount - VP amount
 * @param {string} transactionType - 'pack' or 'service'
 * @returns {string} Formatted summary
 */
export const formatTransactionSummary = (vpAmount, transactionType) => {
  const vcAmount = calculateVCFromVP(vpAmount);
  
  if (transactionType === 'pack') {
    return `${vpAmount} VP → ${vcAmount} VC (immediate)`;
  } else if (transactionType === 'service') {
    return `${vpAmount} VP → ${vcAmount} VC (pending confirmation)`;
  }
  
  return `${vpAmount} VP → ${vcAmount} VC`;
};

/**
 * Get current user ID (helper function)
 * You should replace this with your actual auth implementation
 */
const getCurrentUserId = () => {
  // This should be replaced with your actual auth context/hook
  // For example: const { currentUser } = useAuth(); return currentUser?.uid;
  throw new Error('getCurrentUserId not implemented - replace with your auth implementation');
};

// Example usage in a service purchase component:
/*
import { processServicePurchase, validateVPBalance, formatTransactionSummary } from '../utils/walletTransactions';
import { useWallet } from '../contexts/WalletContext';

const ServicePurchaseButton = ({ service, sellerId }) => {
  const { vpBalance } = useWallet();
  
  const handlePurchase = async () => {
    if (!validateVPBalance(service.price, vpBalance)) {
      alert('Insufficient VP balance');
      return;
    }
    
    const result = await processServicePurchase(
      sellerId,
      service.id,
      service.name,
      service.description,
      service.price
    );
    
    if (result.success) {
      alert(`Service purchased! Order ID: ${result.serviceOrderId}`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };
  
  return (
    <button onClick={handlePurchase}>
      Buy Service - {formatTransactionSummary(service.price, 'service')}
    </button>
  );
};
*/
