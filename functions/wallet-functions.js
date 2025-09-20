// wallet-functions.js - Sistema de Carteiras Vixter para React
// VERSÃO LIMPA - Removido watermarking, mantido Stripe e funcionalidades essenciais

/* eslint-env node */
/* global process */
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";
import { defineSecret } from 'firebase-functions/params';
import { Buffer } from 'node:buffer';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Stripe setup (use secrets correctly and avoid module-level client instantiation)
import Stripe from "stripe";
const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Environment configuration
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const STRIPE_API_VERSION = '2023-10-16';

// Helper function to get environment info
const getEnvironmentInfo = () => {
  return {
    isProduction: IS_PRODUCTION,
    nodeEnv: process.env.NODE_ENV,
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
    timestamp: new Date().toISOString()
  };
};

// Configurações globais
setGlobalOptions({
  region: "us-east1",
  cpu: 0.5,           // 0.5 vCPU per instance (Cloud Functions v2 on Cloud Run)
  maxInstances: 2,    // Cap instances per function to avoid quota overuse
  concurrency: 1,     // Required when cpu < 1 vCPU
});

const db = admin.firestore();

/**
 * Inicializa carteira do usuário
 */
export const initializeWallet = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      const newWallet = {
        uid: userId,
        vp: 0,
        vc: 0,
        vbp: 0,
        vcPending: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await walletRef.set(newWallet);
      
      logger.info(`✅ Carteira criada para usuário ${userId}`);
      return { success: true, wallet: newWallet };
    }

    return { success: true, wallet: walletDoc.data() };
  } catch (error) {
    logger.error(`💥 Erro ao inicializar carteira para ${userId}:`, error);
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Cria sessão de pagamento Stripe
 */
export const createStripeSession = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { packageId } = request.data;
  if (!packageId) {
    throw new HttpsError("invalid-argument", "ID do pacote é obrigatório");
  }

  const userId = request.auth.uid;

  // Definir pacotes disponíveis
  const packages = {
    'pack-20': { amount: 2000, vpAmount: 30, vbpBonus: 0, name: 'Pacote Iniciante' },
    'pack-45': { amount: 4500, vpAmount: 66, vbpBonus: 0, name: 'Pacote Essencial' },
    'pack-60': { amount: 6000, vpAmount: 85, vbpBonus: 10, name: 'Pacote Bronze' },
    'pack-85': { amount: 8500, vpAmount: 120, vbpBonus: 22, name: 'Pacote Prata' },
    'pack-96': { amount: 9600, vpAmount: 138, vbpBonus: 36, name: 'Pacote Safira' },
    'pack-120': { amount: 12000, vpAmount: 168, vbpBonus: 50, name: 'Pacote Ouro' },
    'pack-150': { amount: 15000, vpAmount: 218, vbpBonus: 65, name: 'Pacote Platina' },
    'pack-200': { amount: 20000, vpAmount: 295, vbpBonus: 85, name: 'Pacote Diamante' },
    'pack-300': { amount: 30000, vpAmount: 455, vbpBonus: 130, name: 'Pacote Especial' },
    'pack-500': { amount: 50000, vpAmount: 780, vbpBonus: 220, name: 'Pacote Premium' },
    'pack-750': { amount: 75000, vpAmount: 1200, vbpBonus: 350, name: 'Pacote Elite' },
    'pack-1000': { amount: 100000, vpAmount: 1650, vbpBonus: 500, name: 'Pacote Master' },
  };

  const packageInfo = packages[packageId];
  if (!packageInfo) {
    throw new HttpsError("invalid-argument", "Pacote inválido");
  }

  try {
    // Instantiate Stripe client with secret at runtime
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2024-06-20',
    });

    const baseUrl = 'https://vixter-react.vercel.app';

    // Criar sessão Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: request.auth.token.email,
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: packageInfo.name,
            description: `${packageInfo.vpAmount} VP ${packageInfo.vbpBonus > 0 ? `+ ${packageInfo.vbpBonus} VBP` : ''}`,
          },
          unit_amount: packageInfo.amount,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/wallet`,
      metadata: {
        userId: userId,
        packageId: packageId,
        vpAmount: packageInfo.vpAmount.toString(),
        vbpBonus: packageInfo.vbpBonus.toString(),
      }
    });

    // Salvar informações da sessão no Firestore
    await db.collection('stripePayments').doc(session.id).set({
      sessionId: session.id,
      userId: userId,
      packageId: packageId,
      amount: packageInfo.amount,
      vpAmount: packageInfo.vpAmount,
      vbpBonus: packageInfo.vbpBonus,
      packageName: packageInfo.name,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ Sessão Stripe criada: ${session.id} para usuário ${userId}`);
    return { sessionId: session.id, url: session.url };

  } catch (error) {
    logger.error(`💥 Erro ao criar sessão Stripe:`, error);
    throw new HttpsError("internal", "Erro ao criar sessão de pagamento");
  }
});

/**
 * Webhook do Stripe para confirmar pagamentos
 */
export const stripeWebhook = onRequest({
  memory: "256MiB",
  timeoutSeconds: 60,
  cors: false, // Disable CORS for webhook (Stripe calls this server-to-server)
  secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
}, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

  if (!endpointSecret) {
    logger.error(`💥 STRIPE_WEBHOOK_SECRET not configured`);
    res.status(400).send('Webhook secret not configured');
    return;
  }

  let event;

  try {
    const body = Buffer.from(req.rawBody).toString('utf8');
    
    // Instantiate Stripe only for webhook verification and any API operations
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2024-06-20',
    });

    logger.info('🔍 Verificando assinatura do webhook Stripe...');
    
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    
    logger.info(`📦 Evento Stripe recebido: ${event.type}`);
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'payment_intent.succeeded':
        logger.info('💳 Payment intent succeeded:', event.data.object.id);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        logger.info(`ℹ️ Evento não tratado: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    logger.error(`💥 Erro no webhook Stripe:`, error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// === INTERNAL FUNCTIONS FOR STRIPE WEBHOOK ===

async function handleCheckoutSessionCompleted(session) {
  const { id: sessionId, metadata } = session;
  const { userId, packageId, vpAmount, vbpBonus } = metadata;

  logger.info(`✅ Checkout completado para sessão: ${sessionId}`);

  try {
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      logger.error(`💥 Documento de pagamento não encontrado: ${sessionId}`);
      return;
    }

    // Atualizar status do pagamento
    await paymentRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Atualizar carteira do usuário
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();

    if (!walletDoc.exists) {
      logger.error(`💥 Carteira não encontrada para usuário: ${userId}`);
      return;
    }

    const wallet = walletDoc.data();
    const newVP = wallet.vp + parseInt(vpAmount);
    const newVBP = wallet.vbp + parseInt(vbpBonus);

    await walletRef.update({
      vp: newVP,
      vbp: newVBP,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Registrar transação
    await db.collection('transactions').add({
      userId: userId,
      type: 'BUY_VP',
      amounts: {
        vp: parseInt(vpAmount),
        vbp: parseInt(vbpBonus)
      },
      metadata: {
        description: `Compra de ${vpAmount} VP via Stripe`,
        stripeSessionId: sessionId,
        packageId: packageId
      },
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ Carteira atualizada para usuário ${userId}: +${vpAmount} VP, +${vbpBonus} VBP`);

  } catch (error) {
    logger.error(`💥 Erro ao processar checkout completado:`, error);
  }
}

async function handlePaymentFailed(paymentIntent) {
  logger.info(`❌ Pagamento falhou: ${paymentIntent.id}`);
  
  // Encontrar sessão relacionada
  const sessionId = paymentIntent.metadata?.sessionId;
  if (sessionId) {
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    await paymentRef.update({
      status: 'failed',
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
    });
  }
}

// === SERVICES AND PACKS FUNCTIONS (WITHOUT WATERMARKING) ===

// Services Internal Functions
async function createServiceInternal(userId, payload) {
  const { title, description, price, discount, category, tags, features, complementaryOptions, status, currency } = payload;

  if (!title || !description || !price || price <= 0) {
    throw new HttpsError("invalid-argument", "Dados do serviço são obrigatórios");
  }

  const serviceRef = db.collection('services').doc();
  const serviceData = {
    id: serviceRef.id,
    providerId: userId,
    title: title.trim(),
    description: description.trim(),
    price: Math.round(price),
    discount: Number(discount) || 0,
    category: category || 'geral',
    tags: Array.isArray(tags) ? tags : [],
    features: Array.isArray(features) ? features : [],
    complementaryOptions: Array.isArray(complementaryOptions) ? complementaryOptions : [],
    status: status || 'active',
    currency: currency || 'VC',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Media URLs are now data URLs passed directly
    coverImageURL: payload.coverImageURL || null
  };

  await serviceRef.set(serviceData);
  logger.info(`✅ Service created: ${serviceRef.id}`);
  return { success: true, serviceId: serviceRef.id };
}

async function updateServiceInternal(serviceId, payload) {
  const serviceRef = db.collection('services').doc(serviceId);
  const updateData = {
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await serviceRef.update(updateData);
  logger.info(`✅ Service updated: ${serviceId}`);
  return { success: true };
}

// Packs Internal Functions
async function createPackInternal(userId, payload) {
  const { 
    title, description, category, subcategory, packType, price, discount, currency,
    features, tags, licenseOptions, disableWatermark, coverImage, sampleImages, sampleVideos, packContent
  } = payload;

  if (!title || !description || !price || price <= 0) {
    throw new HttpsError("invalid-argument", "Dados do pack são obrigatórios");
  }

  const packRef = db.collection('packs').doc();
  const packData = {
    id: packRef.id,
    authorId: userId, // Changed from creatorId to authorId to match frontend query
    creatorId: userId, // Keep both for backward compatibility
    title: title.trim(),
    description: description.trim(),
    category,
    subcategory: subcategory || '',
    packType,
    price: Math.round(price),
    discount: Number(discount) || 0,
    currency: currency || 'VC',
    features: Array.isArray(features) ? features : [],
    tags: Array.isArray(tags) ? tags : [],
    licenseOptions: Array.isArray(licenseOptions) ? licenseOptions : [],
    disableWatermark: Boolean(disableWatermark),
    status: 'active',
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Media URLs are now data URLs passed directly
    coverImage: coverImage || null,
    sampleImages: Array.isArray(sampleImages) ? sampleImages : [],
    sampleVideos: Array.isArray(sampleVideos) ? sampleVideos : [],
    packContent: Array.isArray(packContent) ? packContent : [] // Metadata only for paid content
  };

  await packRef.set(packData);
  logger.info(`✅ Pack created: ${packRef.id}`);
  return { success: true, packId: packRef.id };
}

async function updatePackInternal(packId, payload, userId) {
  const packRef = db.collection('packs').doc(packId);
  
  // Verify pack exists and user owns it
  const packSnap = await packRef.get();
  if (!packSnap.exists) {
    throw new HttpsError('not-found', 'Pack not found');
  }
  
  const packData = packSnap.data();
  if (packData.authorId !== userId && packData.creatorId !== userId) {
    throw new HttpsError('permission-denied', 'You can only update your own packs');
  }
  
  const updateData = {
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await packRef.update(updateData);
  logger.info(`✅ Pack updated: ${packId} by user: ${userId}`);
  return { success: true };
}

// === EXPORT FUNCTIONS FOR CLIENT USE ===

export const createService = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    return await createServiceInternal(request.auth.uid, request.data);
  } catch (error) {
    logger.error('Error creating service:', error);
    throw new HttpsError('internal', 'Failed to create service');
  }
});

export const updateService = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { serviceId, ...updateData } = request.data;
  
  try {
    return await updateServiceInternal(serviceId, updateData);
  } catch (error) {
    logger.error('Error updating service:', error);
    throw new HttpsError('internal', 'Failed to update service');
  }
});

export const createPack = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    return await createPackInternal(request.auth.uid, request.data);
  } catch (error) {
    logger.error('Error creating pack:', error);
    throw new HttpsError('internal', 'Failed to create pack');
  }
});

export const updatePack = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { packId, ...updateData } = request.data;
  
  try {
    return await updatePackInternal(packId, updateData, request.auth.uid);
  } catch (error) {
    logger.error('Error updating pack:', error);
    throw new HttpsError('internal', 'Failed to update pack');
  }
});

// === UTILITY FUNCTIONS ===

// Delete pack internal function
async function deletePackInternal(packId, userId) {
  logger.info(`🗑️ Starting pack deletion for ID: ${packId} by user: ${userId}`);
  
  if (!packId) {
    logger.error("❌ Pack ID is required");
    throw new HttpsError("invalid-argument", "Pack ID is required");
  }

  if (!userId) {
    logger.error("❌ User ID is required");
    throw new HttpsError("invalid-argument", "User ID is required");
  }

  const packRef = db.collection('packs').doc(packId);
  logger.info(`📄 Getting pack document: ${packId}`);
  
  const packDoc = await packRef.get();
  
  if (!packDoc.exists) {
    logger.error(`❌ Pack not found: ${packId}`);
    throw new HttpsError("not-found", "Pack not found");
  }

  const packData = packDoc.data();
  logger.info(`📋 Pack found, data:`, packData);
  
  // Check if user owns the pack
  if (packData.authorId !== userId && packData.creatorId !== userId) {
    logger.error(`❌ User ${userId} does not own pack ${packId}. Pack owner: ${packData.authorId || packData.creatorId}`);
    throw new HttpsError("permission-denied", "You can only delete your own packs");
  }
  
  // Delete the pack document
  logger.info(`🗑️ Deleting pack document: ${packId}`);
  await packRef.delete();
  
  // Verify deletion
  const verifyDoc = await packRef.get();
  if (verifyDoc.exists) {
    logger.error(`❌ Pack still exists after deletion: ${packId}`);
    throw new HttpsError("internal", "Failed to delete pack");
  }
  
  logger.info(`✅ Pack successfully deleted: ${packId}`);
  
  return { success: true };
}

// === UNIFIED API FUNCTION ===

export const api = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { resource, action, payload } = request.data;
  const userId = request.auth.uid;

  logger.info(`API Call: ${resource}/${action}`, { userId, payloadKeys: Object.keys(payload || {}) });

  try {
    let result;
    switch (resource) {
      case 'service':
        switch (action) {
          case 'create':
            result = await createServiceInternal(userId, payload);
            break;
          case 'update':
            result = await updateServiceInternal(payload.serviceId, payload.updates);
            break;
          case 'delete':
            // Add delete logic if needed
            result = { success: true };
            break;
          default:
            throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
        }
        break;
      
      case 'pack':
        switch (action) {
          case 'create':
            result = await createPackInternal(userId, payload);
            break;
          case 'update':
            result = await updatePackInternal(payload.packId, payload.updates, userId);
            break;
          case 'delete':
            result = await deletePackInternal(payload.packId, userId);
            break;
          default:
            throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
        }
        break;
      
      case 'serviceOrder':
        switch (action) {
          case 'create':
            result = await createServiceOrderInternal(userId, payload);
            break;
          case 'update':
            result = await updateServiceOrderInternal(payload.orderId, payload.updates);
            break;
          case 'accept':
            result = await acceptServiceOrderInternal(userId, payload.orderId);
            break;
          case 'decline':
            result = await declineServiceOrderInternal(userId, payload.orderId);
            break;
          case 'deliver':
            result = await markServiceDeliveredInternal(userId, payload.orderId);
            break;
          case 'confirm':
            result = await confirmServiceDeliveryInternal(userId, payload.orderId);
            break;
          default:
            throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
        }
        break;
      
      case 'packOrder':
        switch (action) {
          case 'create':
            result = await createPackOrderInternal(userId, payload);
            break;
          case 'update':
            result = await updatePackOrderInternal(payload.orderId, payload.updates);
            break;
          case 'accept':
            result = await acceptPackOrderInternal(userId, payload.orderId);
            break;
          case 'decline':
            result = await declinePackOrderInternal(userId, payload.orderId);
            break;
          default:
            throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
        }
        break;
      
      default:
        throw new HttpsError('invalid-argument', `Unknown resource: ${resource}`);
    }

    logger.info(`API Success: ${resource}/${action}`, { result });
    return result;
  } catch (error) {
    logger.error(`API Error [${resource}/${action}]:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Internal server error');
  }
});

// === SERVICE ORDER FUNCTIONS ===

// Create service order
async function createServiceOrderInternal(buyerId, payload) {
  const { serviceId, sellerId, vpAmount, additionalFeatures = [], metadata = {} } = payload;

  if (!serviceId || !sellerId || !vpAmount || vpAmount <= 0) {
    throw new HttpsError("invalid-argument", "Dados do pedido são obrigatórios");
  }

  // Get buyer wallet
  const buyerWalletRef = db.collection('wallets').doc(buyerId);
  const buyerWalletSnap = await buyerWalletRef.get();
  
  if (!buyerWalletSnap.exists) {
    throw new HttpsError("not-found", "Carteira do comprador não encontrada");
  }

  const buyerWallet = buyerWalletSnap.data();
  const vpNeeded = vpAmount;
  const vcAmount = Math.round(vpAmount / 1.5); // Convert VP to VC

  // Check if buyer has enough VP
  if (buyerWallet.vp < vpNeeded) {
    throw new HttpsError("insufficient-funds", "Saldo insuficiente de VP");
  }

  // Get seller wallet
  const sellerWalletRef = db.collection('wallets').doc(sellerId);
  const sellerWalletSnap = await sellerWalletRef.get();
  
  if (!sellerWalletSnap.exists) {
    throw new HttpsError("not-found", "Carteira do vendedor não encontrada");
  }

  // Create service order
  const orderRef = db.collection('serviceOrders').doc();
  const orderData = {
    id: orderRef.id,
    serviceId,
    buyerId,
    sellerId,
    vpAmount,
    vcAmount,
    additionalFeatures,
    status: 'PENDING_ACCEPTANCE',
    metadata: {
      serviceName: metadata.serviceName || '',
      serviceDescription: metadata.serviceDescription || '',
      ...metadata
    },
    timestamps: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    // Chat will be created when seller accepts
    chatId: null,
    // Payment tracking
    paymentStatus: 'PENDING',
    refundStatus: 'NONE'
  };

  // Start transaction
  const batch = db.batch();

  // Create order
  batch.set(orderRef, orderData);

  // Deduct VP from buyer
  batch.update(buyerWalletRef, {
    vp: admin.firestore.FieldValue.increment(-vpNeeded),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Add VC Pending to seller
  batch.update(sellerWalletRef, {
    vcPending: admin.firestore.FieldValue.increment(vcAmount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create transaction record
  const transactionRef = db.collection('transactions').doc();
  batch.set(transactionRef, {
    id: transactionRef.id,
    userId: buyerId,
    type: 'SERVICE_PURCHASE',
    amounts: {
      vp: -vpNeeded
    },
    metadata: {
      description: `Compra de serviço: ${metadata.serviceName || 'Serviço'}`,
      orderId: orderRef.id,
      serviceId,
      sellerId,
      vcAmount
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create seller transaction record
  const sellerTransactionRef = db.collection('transactions').doc();
  batch.set(sellerTransactionRef, {
    id: sellerTransactionRef.id,
    userId: sellerId,
    type: 'SERVICE_SALE_PENDING',
    amounts: {
      vc: vcAmount
    },
    metadata: {
      description: `Venda de serviço (pendente): ${metadata.serviceName || 'Serviço'}`,
      orderId: orderRef.id,
      serviceId,
      buyerId,
      vpAmount
    },
    status: 'PENDING',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  logger.info(`✅ Service order created: ${orderRef.id}`);
  return { success: true, order: orderData };
}

// Accept service order
async function acceptServiceOrderInternal(sellerId, orderId) {
  const orderRef = db.collection('serviceOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Você não pode aceitar este pedido");
  }

  if (order.status !== 'PENDING_ACCEPTANCE') {
    throw new HttpsError("invalid-argument", "Pedido não está pendente de aceitação");
  }

  // Create chat conversation
  const chatRef = db.collection('conversations').doc();
  const chatData = {
    id: chatRef.id,
    participants: [order.buyerId, order.sellerId],
    type: 'SERVICE_ORDER',
    metadata: {
      orderId: orderId,
      serviceId: order.serviceId,
      serviceName: order.metadata.serviceName,
      status: 'ACTIVE'
    },
    lastMessage: null,
    timestamps: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };

  // Update order with chat ID and status
  await orderRef.update({
    status: 'ACCEPTED',
    chatId: chatRef.id,
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Create chat
  await chatRef.set(chatData);

  logger.info(`✅ Service order accepted: ${orderId}`);
  return { success: true, chatId: chatRef.id };
}

// Decline service order
async function declineServiceOrderInternal(sellerId, orderId) {
  const orderRef = db.collection('serviceOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Você não pode recusar este pedido");
  }

  if (order.status !== 'PENDING_ACCEPTANCE') {
    throw new HttpsError("invalid-argument", "Pedido não está pendente de aceitação");
  }

  // Start transaction to refund buyer
  const batch = db.batch();

  // Update order status
  batch.update(orderRef, {
    status: 'CANCELLED',
    refundStatus: 'PROCESSING',
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Get buyer wallet
  const buyerWalletRef = db.collection('wallets').doc(order.buyerId);
  const buyerWalletSnap = await buyerWalletRef.get();
  
  if (buyerWalletSnap.exists) {
    // Refund VP to buyer
    batch.update(buyerWalletRef, {
      vp: admin.firestore.FieldValue.increment(order.vpAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Get seller wallet
  const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
  const sellerWalletSnap = await sellerWalletRef.get();
  
  if (sellerWalletSnap.exists) {
    // Remove VC Pending from seller
    batch.update(sellerWalletRef, {
      vcPending: admin.firestore.FieldValue.increment(-order.vcAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Create refund transaction
  const refundTransactionRef = db.collection('transactions').doc();
  batch.set(refundTransactionRef, {
    id: refundTransactionRef.id,
    userId: order.buyerId,
    type: 'SERVICE_REFUND',
    amounts: {
      vp: order.vpAmount
    },
    metadata: {
      description: `Reembolso de serviço: ${order.metadata.serviceName || 'Serviço'}`,
      orderId: orderId,
      serviceId: order.serviceId,
      sellerId: order.sellerId
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  logger.info(`✅ Service order declined: ${orderId}`);
  return { success: true };
}

// Mark service as delivered
async function markServiceDeliveredInternal(sellerId, orderId) {
  const orderRef = db.collection('serviceOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Você não pode marcar este pedido como entregue");
  }

  if (order.status !== 'ACCEPTED') {
    throw new HttpsError("invalid-argument", "Pedido não foi aceito");
  }

  await orderRef.update({
    status: 'DELIVERED',
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  logger.info(`✅ Service marked as delivered: ${orderId}`);
  return { success: true };
}

// Confirm service delivery
async function confirmServiceDeliveryInternal(buyerId, orderId) {
  const orderRef = db.collection('serviceOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.buyerId !== buyerId) {
    throw new HttpsError("permission-denied", "Você não pode confirmar este pedido");
  }

  if (order.status !== 'DELIVERED') {
    throw new HttpsError("invalid-argument", "Serviço não foi entregue");
  }

  // Start transaction to release VC Pending to VC
  const batch = db.batch();

  // Update order status
  batch.update(orderRef, {
    status: 'CONFIRMED',
    paymentStatus: 'COMPLETED',
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Get seller wallet
  const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
  const sellerWalletSnap = await sellerWalletRef.get();
  
  if (sellerWalletSnap.exists) {
    // Move VC from Pending to Available
    batch.update(sellerWalletRef, {
      vcPending: admin.firestore.FieldValue.increment(-order.vcAmount),
      vc: admin.firestore.FieldValue.increment(order.vcAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Create completion transaction
  const completionTransactionRef = db.collection('transactions').doc();
  batch.set(completionTransactionRef, {
    id: completionTransactionRef.id,
    userId: order.sellerId,
    type: 'SERVICE_SALE_COMPLETED',
    amounts: {
      vc: order.vcAmount
    },
    metadata: {
      description: `Venda de serviço concluída: ${order.metadata.serviceName || 'Serviço'}`,
      orderId: orderId,
      serviceId: order.serviceId,
      buyerId: order.buyerId,
      vpAmount: order.vpAmount
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  logger.info(`✅ Service delivery confirmed: ${orderId}`);
  return { success: true };
}

// Update service order
async function updateServiceOrderInternal(orderId, updates) {
  const orderRef = db.collection('serviceOrders').doc(orderId);
  
  const updateData = {
    ...updates,
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };

  await orderRef.update(updateData);
  logger.info(`✅ Service order updated: ${orderId}`);
  return { success: true };
}

// === PACK ORDER FUNCTIONS ===

// Create pack order
async function createPackOrderInternal(buyerId, payload) {
  const { packId, sellerId, vpAmount, metadata = {} } = payload;
  
  // Debug log to see what we're receiving
  logger.info('createPackOrderInternal called', { buyerId, payload });

  // Detailed validation with specific error messages
  if (!packId) {
    logger.error('Missing packId in payload', { payload });
    throw new HttpsError("invalid-argument", "packId é obrigatório");
  }
  
  if (!sellerId) {
    logger.error('Missing sellerId in payload', { payload });
    throw new HttpsError("invalid-argument", "sellerId é obrigatório");
  }
  
  if (!vpAmount || vpAmount <= 0) {
    logger.error('Invalid vpAmount in payload', { vpAmount, payload });
    throw new HttpsError("invalid-argument", "vpAmount é obrigatório e deve ser maior que zero");
  }

  if (buyerId === sellerId) {
    throw new HttpsError("invalid-argument", "Você não pode comprar seu próprio pack");
  }

  // Get buyer wallet
  const buyerWalletRef = db.collection('wallets').doc(buyerId);
  const buyerWalletSnap = await buyerWalletRef.get();
  
  if (!buyerWalletSnap.exists) {
    throw new HttpsError("failed-precondition", "Carteira do comprador não encontrada");
  }

  const buyerWallet = buyerWalletSnap.data();
  const vpNeeded = vpAmount;

  if (buyerWallet.vp < vpNeeded) {
    throw new HttpsError("failed-precondition", "Saldo VP insuficiente");
  }

  // Calculate VC amount (1.5x conversion rate - VP to VC)
  const vcAmount = Math.round(vpAmount / 1.5);

  // Create pack order
  const orderRef = db.collection('packOrders').doc();
  const orderData = {
    id: orderRef.id,
    packId,
    buyerId,
    sellerId,
    vpAmount,
    vcAmount,
    status: 'PENDING_ACCEPTANCE',
    paymentStatus: 'RESERVED',
    metadata: {
      packName: metadata.packName || 'Pack',
      ...metadata
    },
    timestamps: {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };

  const batch = db.batch();

  // Create order
  batch.set(orderRef, orderData);

  // Deduct VP from buyer
  batch.update(buyerWalletRef, {
    vp: admin.firestore.FieldValue.increment(-vpNeeded),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create buyer transaction
  const buyerTransactionRef = db.collection('transactions').doc();
  batch.set(buyerTransactionRef, {
    id: buyerTransactionRef.id,
    userId: buyerId,
    type: 'PACK_PURCHASE',
    amounts: {
      vp: -vpAmount
    },
    metadata: {
      description: `Compra de pack: ${metadata.packName || 'Pack'}`,
      orderId: orderRef.id,
      packId,
      sellerId,
      vcAmount
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // Get seller wallet and add VC Pending
  const sellerWalletRef = db.collection('wallets').doc(sellerId);
  batch.update(sellerWalletRef, {
    vcPending: admin.firestore.FieldValue.increment(vcAmount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create seller pending transaction
  const sellerTransactionRef = db.collection('transactions').doc();
  batch.set(sellerTransactionRef, {
    id: sellerTransactionRef.id,
    userId: sellerId,
    type: 'PACK_SALE_PENDING',
    amounts: {
      vc: vcAmount
    },
    metadata: {
      description: `Venda de pack (pendente): ${metadata.packName || 'Pack'}`,
      orderId: orderRef.id,
      packId,
      buyerId,
      vpAmount
    },
    status: 'PENDING',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  // Create notification for seller
  try {
    const notificationRef = db.collection('notifications').doc();
    await notificationRef.set({
      id: notificationRef.id,
      userId: sellerId,
      type: 'PACK_ORDER_RECEIVED',
      title: 'Novo Pedido de Pack!',
      message: `Você recebeu um novo pedido de pack: ${metadata.packName || 'Pack'}`,
      data: {
        orderId: orderRef.id,
        packId,
        buyerId,
        vpAmount,
        vcAmount
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info(`✅ Notification created for seller: ${sellerId}`);
  } catch (notificationError) {
    logger.error('Error creating seller notification:', notificationError);
    // Don't fail the order creation if notification fails
  }

  logger.info(`✅ Pack order created: ${orderRef.id}`);
  return { success: true, packOrderId: orderRef.id };
}

// Accept pack order
async function acceptPackOrderInternal(sellerId, orderId) {
  const orderRef = db.collection('packOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Você não pode aceitar este pedido");
  }

  if (order.status !== 'PENDING_ACCEPTANCE') {
    throw new HttpsError("invalid-argument", "Pedido não está pendente de aceitação");
  }

  // Start transaction to complete the sale
  const batch = db.batch();

  // Update order status
  batch.update(orderRef, {
    status: 'COMPLETED',
    paymentStatus: 'COMPLETED',
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Get seller wallet
  const sellerWalletRef = db.collection('wallets').doc(sellerId);
  const sellerWalletSnap = await sellerWalletRef.get();
  
  if (sellerWalletSnap.exists) {
    // Move VC from Pending to Available
    batch.update(sellerWalletRef, {
      vcPending: admin.firestore.FieldValue.increment(-order.vcAmount),
      vc: admin.firestore.FieldValue.increment(order.vcAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Update seller pending transaction to completed
  const sellerTransactionsRef = db.collection('transactions').where('metadata.orderId', '==', orderId).where('userId', '==', sellerId);
  const sellerTransactionsSnap = await sellerTransactionsRef.get();
  
  sellerTransactionsSnap.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: 'COMPLETED',
      type: 'PACK_SALE_COMPLETED'
    });
  });

  // Create completion transaction
  const completionTransactionRef = db.collection('transactions').doc();
  batch.set(completionTransactionRef, {
    id: completionTransactionRef.id,
    userId: order.sellerId,
    type: 'PACK_SALE_COMPLETED',
    amounts: {
      vc: order.vcAmount
    },
    metadata: {
      description: `Venda de pack concluída: ${order.metadata.packName || 'Pack'}`,
      orderId: orderId,
      packId: order.packId,
      buyerId: order.buyerId,
      vpAmount: order.vpAmount
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  logger.info(`✅ Pack order accepted: ${orderId}`);
  return { success: true };
}

// Decline pack order
async function declinePackOrderInternal(sellerId, orderId) {
  const orderRef = db.collection('packOrders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Pedido não encontrado");
  }

  const order = orderSnap.data();

  if (order.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Você não pode recusar este pedido");
  }

  if (order.status !== 'PENDING_ACCEPTANCE') {
    throw new HttpsError("invalid-argument", "Pedido não está pendente de aceitação");
  }

  // Start transaction to refund buyer
  const batch = db.batch();

  // Update order status
  batch.update(orderRef, {
    status: 'CANCELLED',
    refundStatus: 'PROCESSING',
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Get buyer wallet
  const buyerWalletRef = db.collection('wallets').doc(order.buyerId);
  const buyerWalletSnap = await buyerWalletRef.get();
  
  if (buyerWalletSnap.exists) {
    // Refund VP to buyer
    batch.update(buyerWalletRef, {
      vp: admin.firestore.FieldValue.increment(order.vpAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Get seller wallet
  const sellerWalletRef = db.collection('wallets').doc(sellerId);
  const sellerWalletSnap = await sellerWalletRef.get();
  
  if (sellerWalletSnap.exists) {
    // Remove VC Pending from seller
    batch.update(sellerWalletRef, {
      vcPending: admin.firestore.FieldValue.increment(-order.vcAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Create refund transaction
  const refundTransactionRef = db.collection('transactions').doc();
  batch.set(refundTransactionRef, {
    id: refundTransactionRef.id,
    userId: order.buyerId,
    type: 'PACK_REFUND',
    amounts: {
      vp: order.vpAmount
    },
    metadata: {
      description: `Reembolso de pack: ${order.metadata.packName || 'Pack'}`,
      orderId: orderId,
      packId: order.packId,
      sellerId: order.sellerId
    },
    status: 'COMPLETED',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();

  logger.info(`✅ Pack order declined: ${orderId}`);
  return { success: true };
}

// Update pack order
async function updatePackOrderInternal(orderId, updates) {
  const orderRef = db.collection('packOrders').doc(orderId);
  
  const updateData = {
    ...updates,
    timestamps: {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  };

  await orderRef.update(updateData);
  logger.info(`✅ Pack order updated: ${orderId}`);
  return { success: true };
}

/**
 * Cria conta Stripe Connect para providers
 */
export const createStripeConnectAccount = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;
  const { returnUrl, refreshUrl } = request.data;

  if (!returnUrl || !refreshUrl) {
    throw new HttpsError("invalid-argument", "URLs de retorno e refresh são obrigatórias");
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: STRIPE_API_VERSION,
    });

    // Verificar se já existe uma conta Stripe Connect
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData?.stripeAccountId) {
      // Verificar se a conta ainda está ativa
      try {
        const account = await stripe.accounts.retrieve(userData.stripeAccountId);
        if (account.details_submitted) {
          return { 
            success: true, 
            accountId: userData.stripeAccountId,
            isComplete: true,
            message: "Conta Stripe já configurada"
          };
        }
      } catch (error) {
        // Conta não existe ou foi removida, criar nova
      }
    }

    // Criar nova conta Stripe Connect
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: request.auth.token.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'monthly', // Pagamentos mensais
          },
        },
      },
      business_type: 'individual', // Para pessoas físicas
    });

    // Criar link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    // Salvar account ID no usuário
    await userRef.set({
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    logger.info(`✅ Stripe Connect account created for user ${userId}: ${account.id}`);
    
    return {
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
      isComplete: false
    };

  } catch (error) {
    logger.error(`💥 Erro ao criar conta Stripe Connect para ${userId}:`, error);
    throw new HttpsError("internal", "Erro ao criar conta Stripe");
  }
});

/**
 * Verifica status da conta Stripe Connect
 */
export const getStripeConnectStatus = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData?.stripeAccountId) {
      return {
        success: true,
        hasAccount: false,
        message: "Nenhuma conta Stripe configurada"
      };
    }

    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: STRIPE_API_VERSION,
    });

    const account = await stripe.accounts.retrieve(userData.stripeAccountId);
    
    // Atualizar status no banco
    await userRef.update({
      stripeAccountStatus: account.details_submitted ? 'complete' : 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      hasAccount: true,
      isComplete: account.details_submitted,
      accountId: userData.stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements
    };

  } catch (error) {
    logger.error(`💥 Erro ao verificar status Stripe Connect para ${userId}:`, error);
    throw new HttpsError("internal", "Erro ao verificar conta Stripe");
  }
});

/**
 * Processa saque de VC para BRL via Stripe
 */
export const processVCWithdrawal = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { amount, confirmWithFee } = request.data;
  const userId = request.auth.uid;

  if (!amount || amount <= 0) {
    throw new HttpsError("invalid-argument", "Valor inválido");
  }

  if (!confirmWithFee) {
    throw new HttpsError("invalid-argument", "Confirmação de taxa obrigatória");
  }

  // Taxa percentual configurável (18% para novos payouts)
  const WITHDRAWAL_FEE_PERCENTAGE = 0.18; // 18%
  const MINIMUM_WITHDRAWAL = 50; // 50 VC mínimo

  if (amount < MINIMUM_WITHDRAWAL) {
    throw new HttpsError("invalid-argument", `Saque mínimo é ${MINIMUM_WITHDRAWAL} VC`);
  }

  try {
    // Verificar saldo VC
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();
    
    if (!walletDoc.exists) {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }

    const wallet = walletDoc.data();
    if (wallet.vc < amount) {
      throw new HttpsError("invalid-argument", "Saldo VC insuficiente");
    }

    // Verificar conta Stripe Connect
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData?.stripeAccountId) {
      throw new HttpsError("failed-precondition", "Conta Stripe não configurada");
    }

    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: STRIPE_API_VERSION,
    });

    // Verificar se a conta está ativa
    const account = await stripe.accounts.retrieve(userData.stripeAccountId);
    if (!account.details_submitted || !account.payouts_enabled) {
      throw new HttpsError("failed-precondition", "Conta Stripe não está pronta para receber pagamentos");
    }

    // Calcular valores
    const feeAmount = Math.round(amount * WITHDRAWAL_FEE_PERCENTAGE);
    const netAmount = amount - feeAmount;
    const brlAmount = netAmount; // 1 VC = 1 BRL

    // Criar transferência para a conta do provider
    const transfer = await stripe.transfers.create({
      amount: brlAmount * 100, // Stripe usa centavos
      currency: 'brl',
      destination: userData.stripeAccountId,
      metadata: {
        userId: userId,
        vcAmount: amount.toString(),
        feeAmount: feeAmount.toString(),
        netAmount: netAmount.toString()
      }
    });

    // Debitar VC da carteira
    await walletRef.update({
      vc: admin.firestore.FieldValue.increment(-amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Registrar transação de saque
    const withdrawalRef = db.collection('withdrawals').doc();
    await withdrawalRef.set({
      id: withdrawalRef.id,
      userId: userId,
      vcAmount: amount,
      brlAmount: brlAmount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      stripeTransferId: transfer.id,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Registrar transação na carteira
    const transactionRef = db.collection('transactions').doc();
    await transactionRef.set({
      id: transactionRef.id,
      userId: userId,
      type: 'WITHDRAW_VC',
      amounts: {
        vc: -amount
      },
      metadata: {
        description: `Saque de VC para BRL`,
        stripeTransferId: transfer.id,
        feeAmount: feeAmount,
        netAmount: netAmount
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ VC withdrawal processed for user ${userId}: ${amount} VC -> ${brlAmount} BRL (8% fee: ${feeAmount} VC)`);

    return {
      success: true,
      withdrawalId: withdrawalRef.id,
      vcAmount: amount,
      brlAmount: brlAmount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      stripeTransferId: transfer.id
    };

  } catch (error) {
    logger.error(`💥 Erro ao processar saque VC para ${userId}:`, error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "Erro ao processar saque");
  }
});

/**
 * Calcula taxa de saque para preview
 */
export const calculateWithdrawalFee = onCall({
  memory: "64MiB",
  timeoutSeconds: 30,
}, async (request) => {
  const { amount } = request.data;
  
  if (!amount || amount <= 0) {
    throw new HttpsError("invalid-argument", "Valor inválido");
  }

  const WITHDRAWAL_FEE_PERCENTAGE = 0.18; // 18%
  const MINIMUM_WITHDRAWAL = 50;

  if (amount < MINIMUM_WITHDRAWAL) {
    throw new HttpsError("invalid-argument", `Saque mínimo é ${MINIMUM_WITHDRAWAL} VC`);
  }

  const feeAmount = Math.round(amount * WITHDRAWAL_FEE_PERCENTAGE);
  const netAmount = amount - feeAmount;
  const brlAmount = netAmount;

  return {
    success: true,
    vcAmount: amount,
    feeAmount: feeAmount,
    netAmount: netAmount,
    brlAmount: brlAmount,
    feePercentage: WITHDRAWAL_FEE_PERCENTAGE * 100
  };
});

/**
 * Verifica configuração do Stripe Connect
 */
export const checkStripeConnectConfig = onCall({
  memory: "128MiB",
  timeoutSeconds: 30,
  secrets: [STRIPE_SECRET],
}, async () => {
  try {
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: STRIPE_API_VERSION,
    });

    // Verificar se a conta principal tem Connect habilitado
    const account = await stripe.accounts.retrieve();
    
    // Verificar se Connect está habilitado
    const hasConnect = account.charges_enabled && account.payouts_enabled;
    
    return {
      success: true,
      hasConnect: hasConnect,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      country: account.country,
      environment: getEnvironmentInfo(),
      message: hasConnect 
        ? "Stripe Connect configurado corretamente" 
        : "Stripe Connect não está habilitado. Ative no dashboard do Stripe."
    };

  } catch (error) {
    logger.error('Error checking Stripe Connect config:', error);
    return {
      success: false,
      error: error.message,
      message: "Erro ao verificar configuração do Stripe"
    };
  }
});

/**
 * Verifica ambiente e configurações (para debug)
 */
export const checkEnvironment = onCall({
  memory: "64MiB",
  timeoutSeconds: 30,
}, async () => {
  try {
    const envInfo = getEnvironmentInfo();
    
    return {
      success: true,
      environment: envInfo,
      message: `Ambiente: ${envInfo.isProduction ? 'Produção' : 'Desenvolvimento'} | Stripe: ${envInfo.stripeKeyPrefix}`,
      recommendations: envInfo.isProduction ? [
        "✅ Ambiente de produção detectado",
        "✅ Use chaves live do Stripe",
        "✅ Configure URLs reais no Stripe",
        "✅ Monitore logs e erros"
      ] : [
        "🔧 Ambiente de desenvolvimento",
        "🔧 Use chaves test do Stripe",
        "🔧 URLs de teste configuradas",
        "🔧 Dados de teste são seguros"
      ]
    };

  } catch (error) {
    logger.error('Error checking environment:', error);
    return {
      success: false,
      error: error.message,
      message: "Erro ao verificar ambiente"
    };
  }
});

/**
 * Envia email de confirmação de compra personalizado
 */
export const sendPurchaseConfirmationEmail = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
  secrets: [STRIPE_SECRET],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { 
    packageName, 
    vpAmount, 
    vbpBonus, 
    price, 
    paymentMethod,
    stripeSessionId 
  } = request.data;

  const userId = request.auth.uid;
  const userEmail = request.auth.token.email;

  try {
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: STRIPE_API_VERSION,
    });

    // Buscar dados da sessão do Stripe
    let sessionData = null;
    if (stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
        sessionData = {
          id: session.id,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency
        };
      } catch (error) {
        logger.warn('Could not retrieve Stripe session:', error);
      }
    }

    // Dados do email
    const emailData = {
      to: userEmail,
      subject: `🎉 Compra realizada com sucesso! ${packageName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
          <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #8A2BE2; margin: 0; font-size: 28px;">🎉 Compra Realizada!</h1>
              <p style="color: #666; margin: 10px 0 0 0;">Obrigado por escolher a Vixter</p>
            </div>

            <!-- Package Info -->
            <div style="background: linear-gradient(135deg, #8A2BE2 0%, #00FFCA 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">${packageName}</h2>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <p style="margin: 5px 0; font-size: 18px;">${vpAmount} VP</p>
                  ${vbpBonus > 0 ? `<p style="margin: 5px 0; font-size: 16px; opacity: 0.9;">+ ${vbpBonus} VBP de bônus</p>` : ''}
                </div>
                <div style="text-align: right;">
                  <p style="margin: 5px 0; font-size: 20px; font-weight: bold;">R$ ${(price / 100).toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            </div>

            <!-- Payment Details -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #333;">Detalhes do Pagamento</h3>
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span style="color: #666;">Método de pagamento:</span>
                <span style="font-weight: 500;">${paymentMethod === 'credit-card' ? 'Cartão de Crédito' : 'PIX'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span style="color: #666;">Status:</span>
                <span style="color: #28a745; font-weight: 500;">✅ Pago</span>
              </div>
              ${sessionData ? `
              <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                <span style="color: #666;">ID da transação:</span>
                <span style="font-family: monospace; font-size: 12px;">${sessionData.id}</span>
              </div>
              ` : ''}
            </div>

            <!-- What's Next -->
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #1976d2;">O que fazer agora?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #333;">
                <li>Seus VP já estão disponíveis na sua carteira</li>
                <li>Use os VP para comprar serviços de criadores</li>
                <li>Explore a plataforma e descubra novos talentos</li>
                <li>${vbpBonus > 0 ? 'Use seus VBP para atividades especiais' : ''}</li>
              </ul>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; margin: 0 0 10px 0;">Precisa de ajuda?</p>
              <p style="margin: 0;">
                <a href="mailto:suporte@vixter.com" style="color: #8A2BE2; text-decoration: none;">suporte@vixter.com</a>
              </p>
              <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
                Este é um email automático. Não responda a esta mensagem.
              </p>
            </div>

          </div>
        </div>
      `
    };

    // Enviar email usando Firebase Functions (se configurado)
    // Ou integrar com SendGrid, Mailgun, etc.
    
    logger.info(`📧 Purchase confirmation email prepared for ${userEmail}: ${packageName}`);

    return {
      success: true,
      message: "Email de confirmação preparado",
      emailData: {
        to: userEmail,
        subject: emailData.subject,
        packageName,
        vpAmount,
        vbpBonus,
        price
      }
    };

  } catch (error) {
    logger.error(`💥 Error sending purchase confirmation email for ${userId}:`, error);
    throw new HttpsError("internal", "Erro ao enviar email de confirmação");
  }
});

/**
 * Processa uma gorjeta individual (chamada quando gorjeta é enviada)
 */
export const processVixtip = onCall(async (request) => {
  const { 
    postId, 
    postType, 
    authorId, 
    authorName, 
    authorUsername, 
    buyerId, 
    buyerName, 
    buyerUsername, 
    vpAmount, 
    vcAmount 
  } = request.data;
  
  if (!postId || !authorId || !buyerId || !vpAmount || !vcAmount) {
    throw new HttpsError("invalid-argument", "Dados obrigatórios não fornecidos");
  }

  try {
    logger.info(`🔄 Processando gorjeta: ${vpAmount} VP -> ${vcAmount} VC para ${authorName}...`);
    
    // Processar a gorjeta usando transação
    const result = await db.runTransaction(async (transaction) => {
      // Referências
      const buyerWalletRef = db.collection('wallets').doc(buyerId);
      const sellerWalletRef = db.collection('wallets').doc(authorId);
      const buyerTransactionRef = db.collection('transactions').doc();
      const sellerTransactionRef = db.collection('transactions').doc();
      const vixtipRef = db.collection('vixtips').doc();

      // Verificar se a carteira do comprador existe
      const buyerWalletSnap = await transaction.get(buyerWalletRef);
      if (!buyerWalletSnap.exists) {
        throw new HttpsError("not-found", "Carteira do comprador não encontrada");
      }

      const buyerWallet = buyerWalletSnap.data();
      if (buyerWallet.vp < vpAmount) {
        throw new HttpsError("failed-precondition", "Saldo VP insuficiente");
      }

      // Verificar se a carteira do vendedor existe
      const sellerWalletSnap = await transaction.get(sellerWalletRef);
      if (!sellerWalletSnap.exists) {
        throw new HttpsError("not-found", "Carteira do vendedor não encontrada");
      }

      const sellerWallet = sellerWalletSnap.data();

      // Debitar VP do comprador
      transaction.update(buyerWalletRef, {
        vp: buyerWallet.vp - vpAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Creditar VC na carteira do vendedor
      transaction.update(sellerWalletRef, {
        vc: (sellerWallet.vc || 0) + vcAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de compra para o comprador
      transaction.set(buyerTransactionRef, {
        userId: buyerId,
        type: 'VIXTIP_SENT',
        amounts: {
          vp: -vpAmount
        },
        metadata: {
          description: `Gorjeta enviada para ${authorName}`,
          postId,
          postType,
          authorId,
          authorName,
          authorUsername,
          vcAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de venda para o vendedor
      transaction.set(sellerTransactionRef, {
        userId: authorId,
        type: 'VIXTIP_RECEIVED',
        amounts: {
          vc: vcAmount
        },
        metadata: {
          description: `Gorjeta recebida de ${buyerName}`,
          postId,
          postType,
          buyerId,
          buyerName,
          buyerUsername,
          vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Salvar dados da gorjeta para ranking
      transaction.set(vixtipRef, {
        postId,
        postType,
        authorId,
        authorName,
        authorUsername,
        buyerId,
        buyerName,
        buyerUsername,
        vpAmount,
        vcAmount,
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        vcCredited: vcAmount,
        sellerId: authorId
      };
    });

    logger.info(`✅ Gorjeta processada com sucesso: ${result.vcCredited} VC creditados para ${result.sellerId}`);
    
    return {
      success: true,
      message: "Gorjeta processada com sucesso",
      data: result
    };

  } catch (error) {
    logger.error(`💥 Erro ao processar gorjeta:`, error);
    throw new HttpsError("internal", "Erro ao processar gorjeta");
  }
});

/**
 * Cron job que processa todas as gorjetas pendentes (executa a cada 24 horas)
 */
export const processPendingVixtips = onCall(async () => {
  try {
    logger.info('🔄 Iniciando processamento de gorjetas pendentes...');
    
    // Buscar todas as gorjetas pendentes
    const pendingVixtips = await db.collection('vixtips')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(100) // Processar até 100 por vez para evitar timeout
      .get();

    if (pendingVixtips.empty) {
      logger.info('✅ Nenhuma gorjeta pendente encontrada');
      return { 
        success: true, 
        message: "Nenhuma gorjeta pendente",
        processed: 0
      };
    }

    let processedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Processar cada gorjeta pendente
    for (const vixtipDoc of pendingVixtips.docs) {
      try {
        const vixtipData = vixtipDoc.data();
        
        // Usar transação para processar cada gorjeta
        await db.runTransaction(async (transaction) => {
          // Verificar se ainda está pendente (pode ter sido processada por outra instância)
          const currentVixtipSnap = await transaction.get(vixtipDoc.ref);
          if (!currentVixtipSnap.exists || currentVixtipSnap.data().status !== 'pending') {
            return; // Já foi processada
          }

          // Referências
          const sellerWalletRef = db.collection('wallets').doc(vixtipData.authorId);
          const transactionRef = db.collection('transactions').doc();

          // Ler carteira do vendedor
          const sellerWalletSnap = await transaction.get(sellerWalletRef);
          
          if (!sellerWalletSnap.exists()) {
            throw new Error(`Carteira do vendedor ${vixtipData.authorId} não encontrada`);
          }

          const sellerWallet = sellerWalletSnap.data();
          
          // Atualizar carteira do vendedor
          transaction.update(sellerWalletRef, {
            vc: (sellerWallet.vc || 0) + vixtipData.vcAmount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Criar transação de venda (histórico do vendedor)
          transaction.set(transactionRef, {
            userId: vixtipData.authorId,
            type: 'VIXTIP_RECEIVED',
            amounts: {
              vc: vixtipData.vcAmount
            },
            metadata: {
              description: `Gorjeta recebida de ${vixtipData.buyerName || 'Usuário'}`,
              postId: vixtipData.postId,
              postType: vixtipData.postType,
              buyerId: vixtipData.buyerId,
              buyerName: vixtipData.buyerName || 'Usuário',
              buyerUsername: vixtipData.buyerUsername || '',
              vpAmount: vixtipData.vpAmount
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          // Marcar gorjeta como processada
          transaction.update(vixtipDoc.ref, {
            status: 'completed',
            processedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        processedCount++;
        logger.info(`✅ Gorjeta ${vixtipDoc.id} processada - ${vixtipData.vcAmount} VC para ${vixtipData.authorName}`);

      } catch (error) {
        errorCount++;
        const errorMsg = `Erro ao processar gorjeta ${vixtipDoc.id}: ${error.message}`;
        errors.push(errorMsg);
        logger.error(`💥 ${errorMsg}`, error);
      }
    }

    const result = {
      success: true,
      message: `Processamento concluído: ${processedCount} gorjetas processadas, ${errorCount} erros`,
      processed: processedCount,
      errors: errorCount,
      errorDetails: errors
    };

    logger.info(`🎉 Processamento de gorjetas concluído: ${processedCount} processadas, ${errorCount} erros`);
    return result;

  } catch (error) {
    logger.error('💥 Erro no processamento em lote de gorjetas:', error);
    throw new HttpsError("internal", "Erro no processamento de gorjetas");
  }
});

/**
 * Função HTTP para ser chamada por cron job externo (Cloud Scheduler)
 */
export const cronProcessVixtips = onRequest(async (req, res) => {
  try {
    // Verificar se é uma chamada autorizada (opcional - adicionar autenticação se necessário)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'vixter-default-cron-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Chamar a função de processamento
    const result = await processPendingVixtips.run();
    
    res.status(200).json({
      success: true,
      message: 'Cron job executado com sucesso',
      data: result
    });

  } catch (error) {
    logger.error('💥 Erro no cron job de gorjetas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

logger.info('✅ Wallet functions loaded - Stripe preserved, watermarking removed, Vixtip processing added');