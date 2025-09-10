// wallet-functions.js - Sistema de Carteiras Vixter para React
// VERSÃO LIMPA - Removido watermarking, mantido Stripe e funcionalidades essenciais

/* eslint-env node */
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
      type: 'purchase',
      amount: parseInt(vpAmount),
      vbpBonus: parseInt(vbpBonus),
      currency: 'VP',
      stripeSessionId: sessionId,
      packageId: packageId,
      status: 'completed',
      description: `Compra de ${vpAmount} VP via Stripe`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    features, tags, licenseOptions, coverImage, sampleImages, sampleVideos, packContent
  } = payload;

  if (!title || !description || !price || price <= 0) {
    throw new HttpsError("invalid-argument", "Dados do pack são obrigatórios");
  }

  const packRef = db.collection('packs').doc();
  const packData = {
    id: packRef.id,
    creatorId: userId,
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

async function updatePackInternal(packId, payload) {
  const packRef = db.collection('packs').doc(packId);
  const updateData = {
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await packRef.update(updateData);
  logger.info(`✅ Pack updated: ${packId}`);
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
    return await updatePackInternal(packId, updateData);
  } catch (error) {
    logger.error('Error updating pack:', error);
    throw new HttpsError('internal', 'Failed to update pack');
  }
});

// === UTILITY FUNCTIONS ===
// (Utility functions can be added here as needed)

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
            result = await updatePackInternal(payload.packId, payload.updates);
            break;
          case 'delete':
            // Add delete logic if needed
            result = { success: true };
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

logger.info('✅ Wallet functions loaded - Stripe preserved, watermarking removed');
