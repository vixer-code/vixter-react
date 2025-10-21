/* eslint-env node */
import {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  claimDailyBonus,

  // Unified API for CRUD operations
  api,

  // Manual Withdrawals (PIX)
  processVCWithdrawal,
  calculateWithdrawalFee,
  processPixPayment,
  listPendingWithdrawals,
  sendPurchaseConfirmationEmail,
  onWithdrawalStatusChanged,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // Auto-completion of delivered services
  scheduledAutoCompleteServices,
} from './wallet-functions.js';

import {
  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
  onKycStatusChange,
} from './kyc-functions.js';

import {
  // Email Functions
  sendServiceStatusEmail,
} from './email-functions.js';

import {
  // Email Ticket Functions
  api as emailTicketApi,
} from './email-ticket-functions.js';

import {
  // Email Reply Processing
  processEmailReply,
  testEmailReply,
} from './email-reply-webhook.js';

import {
  // Elo System Functions
  initializeEloConfig,
  updateEloConfig,
  getEloConfig,
  calculateUserElo,
  updateUserElo,
  getUserElo,
  syncAllUsersXpAndElo,
  calculateAndSetUserXpFromTransactions,
  testXpSystem,
} from './elo-functions.js';

export {
  // Wallet & Payments
  initializeWallet,
  createStripeSession,
  stripeWebhook,
  claimDailyBonus,

  // Unified API (substitui createPack, updatePack, deletePack, createService, updateService, deleteService, createPost, updatePost, deletePost)
  api,

  // Manual Withdrawals (PIX)
  processVCWithdrawal,
  calculateWithdrawalFee,
  processPixPayment,
  listPendingWithdrawals,
  sendPurchaseConfirmationEmail,
  onWithdrawalStatusChanged,

  // Vixtip Processing
  processVixtip,
  processPendingVixtips,

  // Auto-completion of delivered services
  scheduledAutoCompleteServices,

  // KYC Management
  updateKycStatus,
  getKycDocument,
  listPendingKycDocuments,
  generateKycDownloadUrl,
  onKycStatusChange,

  // Email Functions
  sendServiceStatusEmail,

  // Email Ticket Functions
  emailTicketApi,

  // Email Reply Processing
  processEmailReply,
  testEmailReply,

  // Elo System Functions
  initializeEloConfig,
  updateEloConfig,
  getEloConfig,
  calculateUserElo,
  updateUserElo,
  getUserElo,
  syncAllUsersXpAndElo,
  calculateAndSetUserXpFromTransactions,
  testXpSystem,
};
