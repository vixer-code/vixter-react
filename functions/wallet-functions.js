// wallet-functions.js - Sistema de Carteiras Vixter para React

/* eslint-env node */
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { logger } from "firebase-functions";

import { defineSecret } from 'firebase-functions/params';


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
  // Keep overall CPU usage low per region. When using <1 vCPU, concurrency must be 1.
  cpu: 0.5,           // 0.5 vCPU per instance (Cloud Functions v2 on Cloud Run)
  maxInstances: 2,    // Cap instances per function to avoid quota overuse
  concurrency: 1,     // Required when cpu < 1 vCPU
});

const db = admin.firestore();
// Use explicit RTDB instances to segregate legacy vs new
// Legacy RTDB (antigo): default-rtdb
const rtdbLegacy = admin.app().database('https://vixter-451b3-default-rtdb.firebaseio.com');

 

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
    'pack-200': { amount: 20000, vpAmount: 288, vbpBonus: 85, name: 'Pacote Diamante' },
    'pack-255': { amount: 25500, vpAmount: 370, vbpBonus: 110, name: 'Pacote Épico' },
    'pack-290': { amount: 29000, vpAmount: 415, vbpBonus: 135, name: 'Pacote Lendário' },
    'pack-320': { amount: 32000, vpAmount: 465, vbpBonus: 155, name: 'Pacote Mítico' }
  };

  const selectedPackage = packages[packageId];
  if (!selectedPackage) {
    throw new HttpsError("invalid-argument", "Pacote inválido");
  }

  try {
    // Instantiate Stripe client with secret at runtime
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'Vixter Platform',
        version: '1.0.0',
      },
    });
    // Criar sessão Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: request.auth.token.email,
      metadata: {
        userId: userId,
        packageId: packageId,
        vpAmount: selectedPackage.vpAmount.toString(),
        vbpBonus: selectedPackage.vbpBonus.toString()
      },
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: {
            name: selectedPackage.name,
            description: `${selectedPackage.vpAmount} VP` + 
                        (selectedPackage.vbpBonus > 0 ? ` + ${selectedPackage.vbpBonus} VBP bônus` : ''),
            images: ['https://vixter-451b3.firebaseapp.com/images/logoFlorColorida.svg']
          },
          unit_amount: selectedPackage.amount
        },
        quantity: 1
      }],
      success_url: `${('https://vixter-react.vercel.app')}/wallet?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${('https://vixter-react.vercel.app')}/wallet?canceled=true`,
      // Enhanced metadata for better tracking
      payment_intent_data: {
        metadata: {
          platform: 'vixter',
          userId: userId,
          packageId: packageId
        }
      }
    });

    // Salvar informações da sessão
    await db.collection('stripePayments').doc(session.id).set({
      sessionId: session.id,
      userId: userId,
      amount: selectedPackage.amount,
      vpAmount: selectedPackage.vpAmount,
      vbpBonus: selectedPackage.vbpBonus,
      packageId: packageId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ Sessão Stripe criada: ${session.id} para usuário ${userId}`);
    return { sessionId: session.id, url: session.url };

  } catch (error) {
    logger.error(`💥 Erro ao criar sessão Stripe:`, error);
    throw new HttpsError("internal", "Erro ao processar pagamento");
  }
});

/**
 * Webhook do Stripe para confirmar pagamentos
 */
export const stripeWebhook = onRequest({
  memory: "512MiB",
  timeoutSeconds: 60,
  cors: false, // Disable CORS for webhook (Stripe calls this server-to-server)
  secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
}, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

  if (!endpointSecret) {
    logger.error(`💥 STRIPE_WEBHOOK_SECRET not configured`);
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    // Get raw body for signature verification
    const body = req.rawBody || req.body;
    // Instantiate Stripe only for webhook verification and any API operations
    const stripe = new Stripe(STRIPE_SECRET.value(), {
      apiVersion: '2023-10-16',
      appInfo: {
        name: 'Vixter Platform',
        version: '1.0.0',
      },
    });
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    logger.error(`💥 Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Use idempotency key to prevent duplicate processing
    const idempotencyKey = `${event.id}_${event.type}`;
    const processedRef = db.collection('webhookProcessed').doc(idempotencyKey);
    const processedDoc = await processedRef.get();

    if (processedDoc.exists) {
      logger.info(`🔄 Event already processed: ${idempotencyKey}`);
      return res.json({ received: true, status: 'already_processed' });
    }

    // Mark as being processed
    await processedRef.set({
      eventId: event.id,
      eventType: event.type,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processing'
    });

    switch (event.type) {
      case 'checkout.session.completed':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'checkout.session.expired':
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        // For subscription payments (future feature)
        logger.info(`📋 Invoice payment succeeded: ${event.data.object.id}`);
        break;
      case 'customer.subscription.updated':
        // For subscription updates (future feature)
        logger.info(`🔄 Subscription updated: ${event.data.object.id}`);
        break;
      default:
        logger.info(`🔔 Unhandled event type: ${event.type}`);
    }

    // Mark as successfully processed
    await processedRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ received: true, status: 'processed' });
  } catch (error) {
    logger.error(`💥 Erro no webhook Stripe:`, error);
    
    // Mark as failed for retry logic
    const idempotencyKey = `${event.id}_${event.type}`;
    await db.collection('webhookProcessed').doc(idempotencyKey).update({
      status: 'failed',
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(500).send('Webhook Error');
  }
});

/**
 * Processa pagamento bem-sucedido
 */
async function handlePaymentSuccess(session) {
  const sessionId = session.id;
  const userId = session.metadata.userId;
  const vpAmount = parseInt(session.metadata.vpAmount);
  const vbpBonus = parseInt(session.metadata.vbpBonus);

  logger.info(`💰 Processando pagamento bem-sucedido: ${sessionId}`);

  // Usar transação Firestore para garantir consistência
  await db.runTransaction(async (transaction) => {
    // Buscar dados da sessão
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    const paymentDoc = await transaction.get(paymentRef);

    if (!paymentDoc.exists) {
      throw new Error(`Sessão de pagamento não encontrada: ${sessionId}`);
    }

    const paymentData = paymentDoc.data();
    if (paymentData.status === 'completed') {
      logger.warn(`⚠️ Pagamento já processado: ${sessionId}`);
      return;
    }

    // Atualizar carteira
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await transaction.get(walletRef);

    let currentWallet;
    if (!walletDoc.exists) {
      // Criar carteira se não existir
      currentWallet = { uid: userId, vp: 0, vc: 0, vbp: 0 };
      transaction.set(walletRef, {
        ...currentWallet,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      currentWallet = walletDoc.data();
    }

    // Atualizar saldos
    const newVp = (currentWallet.vp || 0) + vpAmount;
    const newVbp = (currentWallet.vbp || 0) + vbpBonus;

    transaction.update(walletRef, {
      vp: newVp,
      vbp: newVbp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Criar transação
    const transactionRef = db.collection('transactions').doc();
    transaction.set(transactionRef, {
      id: transactionRef.id,
      userId: userId,
      type: 'BUY_VP',
      amounts: {
        vp: vpAmount,
        vbp: vbpBonus > 0 ? vbpBonus : null
      },
      ref: {
        stripeSessionId: sessionId
      },
      status: 'CONFIRMED',
      metadata: {
        description: `Compra de ${vpAmount} VP via Stripe`,
        currency: 'BRL',
        originalAmount: session.amount_total
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Marcar pagamento como completo
    transaction.update(paymentRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`✅ VP creditado: ${vpAmount} VP + ${vbpBonus} VBP para ${userId}`);
  });
}

/**
 * Processa falha no pagamento
 */
async function handlePaymentFailure(session) {
  const sessionId = session.id;
  logger.info(`❌ Processando falha no pagamento: ${sessionId}`);

  try {
    const paymentRef = db.collection('stripePayments').doc(sessionId);
    await paymentRef.update({
      status: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error(`💥 Erro ao processar falha no pagamento:`, error);
  }
}

/**
 * Processa venda de pack (VC imediato)
 */
export const processPackSale = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { buyerId, sellerId, vpAmount, packId, packName } = request.data;

  // Validações
  if (!buyerId || !sellerId || !vpAmount || vpAmount <= 0 || !packId || !packName) {
    throw new HttpsError("invalid-argument", "Dados da venda inválidos");
  }

  if (buyerId === sellerId) {
    throw new HttpsError("invalid-argument", "Comprador e vendedor não podem ser o mesmo");
  }

  // Calcular VC do vendedor (1 VC = 1.5 VP)
  const vcAmount = Math.floor(vpAmount / 1.5);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar carteiras
      const buyerWalletRef = db.collection('wallets').doc(buyerId);
      const sellerWalletRef = db.collection('wallets').doc(sellerId);

      const [buyerDoc, sellerDoc] = await Promise.all([
        transaction.get(buyerWalletRef),
        transaction.get(sellerWalletRef)
      ]);

      // Verificar se carteiras existem
      if (!buyerDoc.exists || !sellerDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const buyerWallet = buyerDoc.data();
      const sellerWallet = sellerDoc.data();

      // Verificar saldo do comprador
      if ((buyerWallet.vp || 0) < vpAmount) {
        throw new Error("Saldo insuficiente");
      }

      // Atualizar saldos
      const newBuyerVp = (buyerWallet.vp || 0) - vpAmount;
      const newSellerVc = (sellerWallet.vc || 0) + vcAmount;

      transaction.update(buyerWalletRef, {
        vp: newBuyerVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(sellerWalletRef, {
        vc: newSellerVc,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transações
      const buyerTransactionRef = db.collection('transactions').doc();
      const sellerTransactionRef = db.collection('transactions').doc();

      // Transação do comprador (débito VP)
      transaction.set(buyerTransactionRef, {
        id: buyerTransactionRef.id,
        userId: buyerId,
        type: 'SALE_PACK',
        amounts: { vp: -vpAmount },
        ref: {
          packId: packId,
          targetUserId: sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Compra de Pack: ${packName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Transação do vendedor (crédito VC imediato)
      transaction.set(sellerTransactionRef, {
        id: sellerTransactionRef.id,
        userId: sellerId,
        type: 'SALE_PACK',
        amounts: { vc: vcAmount },
        ref: {
          packId: packId,
          targetUserId: buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Venda de Pack: ${packName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        vpDebited: vpAmount,
        vcCredited: vcAmount,
        conversionRate: 1.5
      };
    });

    logger.info(`✅ Venda processada: ${vpAmount} VP → ${vcAmount} VC`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao processar venda de pack:`, error.message);
    
    if (error.message === "Saldo insuficiente") {
      throw new HttpsError("failed-precondition", "Saldo insuficiente para realizar a compra");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Processa compra de serviço (VC vai para vcPending)
 */
export const processServicePurchase = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { buyerId, sellerId, vpAmount, serviceId, serviceName, serviceDescription } = request.data;

  // Validações
  if (!buyerId || !sellerId || !vpAmount || vpAmount <= 0 || !serviceId || !serviceName) {
    throw new HttpsError("invalid-argument", "Dados da compra inválidos");
  }

  if (buyerId === sellerId) {
    throw new HttpsError("invalid-argument", "Comprador e vendedor não podem ser o mesmo");
  }

  // Calcular VC do vendedor (1 VC = 1.5 VP)
  const vcAmount = Math.floor(vpAmount / 1.5);

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar carteiras
      const buyerWalletRef = db.collection('wallets').doc(buyerId);
      const sellerWalletRef = db.collection('wallets').doc(sellerId);

      const [buyerDoc, sellerDoc] = await Promise.all([
        transaction.get(buyerWalletRef),
        transaction.get(sellerWalletRef)
      ]);

      // Verificar se carteiras existem
      if (!buyerDoc.exists || !sellerDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const buyerWallet = buyerDoc.data();
      const sellerWallet = sellerDoc.data();

      // Verificar saldo do comprador
      if ((buyerWallet.vp || 0) < vpAmount) {
        throw new Error("Saldo insuficiente");
      }

      // Atualizar saldos
      const newBuyerVp = (buyerWallet.vp || 0) - vpAmount;
      const newSellerVcPending = (sellerWallet.vcPending || 0) + vcAmount;

      transaction.update(buyerWalletRef, {
        vp: newBuyerVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(sellerWalletRef, {
        vcPending: newSellerVcPending,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar pedido de serviço
      const serviceOrderRef = db.collection('serviceOrders').doc();
      const autoReleaseTime = new Date(Date.now() + (48 * 60 * 60 * 1000)); // 48h para aceitar + entregar + confirmar

      transaction.set(serviceOrderRef, {
        id: serviceOrderRef.id,
        serviceId: serviceId,
        buyerId: buyerId,
        sellerId: sellerId,
        vpAmount: vpAmount,
        vcAmount: vcAmount,
        status: 'PENDING_ACCEPTANCE',
        metadata: {
          serviceName: serviceName,
          serviceDescription: serviceDescription || ''
        },
        timestamps: {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          autoReleaseAt: autoReleaseTime
        },
        transactionIds: {}
      });

      // Criar transações
      const buyerTransactionRef = db.collection('transactions').doc();
      const sellerTransactionRef = db.collection('transactions').doc();

      // Transação do comprador (débito VP)
      transaction.set(buyerTransactionRef, {
        id: buyerTransactionRef.id,
        userId: buyerId,
        type: 'SALE_SERVICE',
        amounts: { vp: -vpAmount },
        ref: {
          serviceId: serviceId,
          serviceOrderId: serviceOrderRef.id,
          targetUserId: sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Compra de Serviço: ${serviceName}`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Transação do vendedor (VC pendente)
      transaction.set(sellerTransactionRef, {
        id: sellerTransactionRef.id,
        userId: sellerId,
        type: 'SALE_SERVICE',
        amounts: { vcPending: vcAmount },
        ref: {
          serviceId: serviceId,
          serviceOrderId: serviceOrderRef.id,
          targetUserId: buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Venda de Serviço: ${serviceName} (Pendente)`,
          conversionRate: 1.5,
          originalAmount: vpAmount
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar pedido com IDs das transações
      transaction.update(serviceOrderRef, {
        'transactionIds.purchaseId': buyerTransactionRef.id
      });

      return {
        vpDebited: vpAmount,
        vcPending: vcAmount,
        serviceOrderId: serviceOrderRef.id,
        conversionRate: 1.5
      };
    });

    logger.info(`✅ Compra de serviço processada: ${vpAmount} VP → ${vcAmount} VC pendente`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao processar compra de serviço:`, error.message);
    
    if (error.message === "Saldo insuficiente") {
      throw new HttpsError("failed-precondition", "Saldo insuficiente para realizar a compra");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Concede bônus diário VBP
 */
export const claimDailyBonus = onCall({
  memory: "256MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Verificar último bônus
      const userBonusRef = db.collection('users').doc(userId);
      const userBonusDoc = await transaction.get(userBonusRef);

      if (userBonusDoc.exists) {
        const userData = userBonusDoc.data();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus) {
          const lastBonusDate = new Date(lastBonus.toDate()).toDateString();
          const today = new Date().toDateString();
          
          if (lastBonusDate === today) {
            throw new Error("Bônus já coletado hoje");
          }
        }
      }

      // Gerar bônus aleatório
      const bonusAmount = Math.floor(Math.random() * 201) + 50; // 50-250 VBP

      // Atualizar carteira
      const walletRef = db.collection('wallets').doc(userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new Error("Carteira não encontrada");
      }

      const wallet = walletDoc.data();
      const newVbp = (wallet.vbp || 0) + bonusAmount;

      transaction.update(walletRef, {
        vbp: newVbp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Marcar bônus como coletado no Firestore
      const userDocRef = db.collection('users').doc(userId);
      const userDocSnap = await transaction.get(userDocRef);
      
      if (userDocSnap.exists) {
        transaction.update(userDocRef, {
          lastDailyBonus: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Criar transação
      const transactionRef = db.collection('transactions').doc();
      transaction.set(transactionRef, {
        id: transactionRef.id,
        userId: userId,
        type: 'BONUS',
        amounts: { vbp: bonusAmount },
        status: 'CONFIRMED',
        metadata: {
          description: 'Bônus Diário'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { bonusAmount };
    });

    logger.info(`✅ Bônus diário concedido: ${result.bonusAmount} VBP para ${userId}`);
    return { success: true, bonusAmount: result.bonusAmount };

  } catch (error) {
    if (error.message === "Bônus já coletado hoje") {
      throw new HttpsError("already-exists", "Bônus diário já foi coletado hoje");
    } else if (error.message === "Carteira não encontrada") {
      throw new HttpsError("not-found", "Carteira não encontrada");
    }

    logger.error(`💥 Erro ao conceder bônus diário:`, error);
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Confirma entrega de serviço e libera VC pendente
 */
export const confirmServiceDelivery = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { serviceOrderId, feedback } = request.data;
  if (!serviceOrderId) {
    throw new HttpsError("invalid-argument", "ID do pedido é obrigatório");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar pedido de serviço
      const orderRef = db.collection('serviceOrders').doc(serviceOrderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("Pedido não encontrado");
      }

      const order = orderDoc.data();

      // Verificar se o usuário é o comprador
      if (order.buyerId !== userId) {
        throw new Error("Não autorizado");
      }

      // Verificar se o pedido está entregue
      if (order.status !== 'DELIVERED') {
        throw new Error("Pedido não está marcado como entregue");
      }

      // Atualizar carteira do vendedor (VC pendente → VC real)
      const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
      const sellerWalletDoc = await transaction.get(sellerWalletRef);

      if (!sellerWalletDoc.exists) {
        throw new Error("Carteira do vendedor não encontrada");
      }

      const sellerWallet = sellerWalletDoc.data();
      const newVc = (sellerWallet.vc || 0) + order.vcAmount;
      const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

      // Atualizar carteira
      transaction.update(sellerWalletRef, {
        vc: newVc,
        vcPending: newVcPending,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar status do pedido
      transaction.update(orderRef, {
        status: 'CONFIRMED',
        'metadata.buyerFeedback': feedback || '',
        'timestamps.confirmedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de confirmação
      const transactionRef = db.collection('transactions').doc();
      transaction.set(transactionRef, {
        id: transactionRef.id,
        userId: order.sellerId,
        type: 'SERVICE_CONFIRM',
        amounts: { 
          vc: order.vcAmount,
          vcPending: -order.vcAmount
        },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Serviço Confirmado: ${order.metadata.serviceName}`,
          buyerFeedback: feedback || ''
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar pedido com ID da transação
      transaction.update(orderRef, {
        'transactionIds.confirmationId': transactionRef.id
      });

      return {
        vcReleased: order.vcAmount,
        orderId: serviceOrderId
      };
    });

    logger.info(`✅ Serviço confirmado: ${serviceOrderId} - ${result.vcReleased} VC liberado`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao confirmar serviço:`, error.message);
    
    if (error.message === "Pedido não encontrado") {
      throw new HttpsError("not-found", "Pedido não encontrado");
    } else if (error.message === "Não autorizado") {
      throw new HttpsError("permission-denied", "Você não tem permissão para confirmar este pedido");
    } else if (error.message === "Pedido não está marcado como entregue") {
      throw new HttpsError("failed-precondition", "O pedido precisa estar marcado como entregue primeiro");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Rejeita pedido de serviço e reembolsa VP ao comprador
 */
export const rejectServiceOrder = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { serviceOrderId, reason } = request.data;
  if (!serviceOrderId) {
    throw new HttpsError("invalid-argument", "ID do pedido é obrigatório");
  }

  const userId = request.auth.uid;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Buscar pedido de serviço
      const orderRef = db.collection('serviceOrders').doc(serviceOrderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("Pedido não encontrado");
      }

      const order = orderDoc.data();

      // Verificar se o usuário é o comprador
      if (order.buyerId !== userId) {
        throw new Error("Não autorizado");
      }

      // Verificar se o pedido pode ser rejeitado
      if (!['PENDING_ACCEPTANCE', 'ACCEPTED'].includes(order.status)) {
        throw new Error("Pedido não pode ser rejeitado neste estado");
      }

      // Reembolsar VP ao comprador
      const buyerWalletRef = db.collection('wallets').doc(order.buyerId);
      const buyerWalletDoc = await transaction.get(buyerWalletRef);

      if (!buyerWalletDoc.exists) {
        throw new Error("Carteira do comprador não encontrada");
      }

      const buyerWallet = buyerWalletDoc.data();
      const newVp = (buyerWallet.vp || 0) + order.vpAmount;

      // Atualizar carteira do comprador
      transaction.update(buyerWalletRef, {
        vp: newVp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remover VC pendente do vendedor
      const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
      const sellerWalletDoc = await transaction.get(sellerWalletRef);

      if (sellerWalletDoc.exists) {
        const sellerWallet = sellerWalletDoc.data();
        const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

        transaction.update(sellerWalletRef, {
          vcPending: newVcPending,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Atualizar status do pedido
      transaction.update(orderRef, {
        status: 'REJECTED',
        'metadata.rejectionReason': reason || 'Rejeitado pelo comprador',
        'timestamps.rejectedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de reembolso para o comprador
      const refundTransactionRef = db.collection('transactions').doc();
      transaction.set(refundTransactionRef, {
        id: refundTransactionRef.id,
        userId: order.buyerId,
        type: 'SERVICE_REFUND',
        amounts: { vp: order.vpAmount },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.sellerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Reembolso: ${order.metadata.serviceName}`,
          rejectionReason: reason || 'Rejeitado pelo comprador'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Criar transação de cancelamento para o vendedor
      const cancelTransactionRef = db.collection('transactions').doc();
      transaction.set(cancelTransactionRef, {
        id: cancelTransactionRef.id,
        userId: order.sellerId,
        type: 'SERVICE_CANCEL',
        amounts: { vcPending: -order.vcAmount },
        ref: {
          serviceId: order.serviceId,
          serviceOrderId: serviceOrderId,
          targetUserId: order.buyerId
        },
        status: 'CONFIRMED',
        metadata: {
          description: `Serviço Cancelado: ${order.metadata.serviceName}`,
          rejectionReason: reason || 'Rejeitado pelo comprador'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        vpRefunded: order.vpAmount,
        orderId: serviceOrderId
      };
    });

    logger.info(`✅ Serviço rejeitado: ${serviceOrderId} - ${result.vpRefunded} VP reembolsado`);
    return { success: true, ...result };

  } catch (error) {
    logger.error(`💥 Erro ao rejeitar serviço:`, error.message);
    
    if (error.message === "Pedido não encontrado") {
      throw new HttpsError("not-found", "Pedido não encontrado");
    } else if (error.message === "Não autorizado") {
      throw new HttpsError("permission-denied", "Você não tem permissão para rejeitar este pedido");
    } else if (error.message === "Pedido não pode ser rejeitado neste estado") {
      throw new HttpsError("failed-precondition", "Este pedido não pode mais ser rejeitado");
    }
    
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Migra dados de usuário do RTDB para Firestore
 */
export const migrateUserToFirestore = onCall({
  memory: "256MiB",
  timeoutSeconds: 300,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const userId = request.auth.uid;

  try {
    // Buscar dados do usuário no RTDB
    // Read from legacy RTDB during migration
    const userSnapshot = await rtdbLegacy.ref(`users/${userId}`).once('value');
    
    if (!userSnapshot.exists()) {
      throw new Error("Usuário não encontrado no RTDB");
    }

    const rtdbUserData = userSnapshot.val();

    // Estrutura otimizada para Firestore
    const firestoreUserData = {
      // Dados básicos do perfil
      uid: userId,
      email: rtdbUserData.email || '',
      displayName: rtdbUserData.displayName || '',
      username: rtdbUserData.username || '',
      name: rtdbUserData.name || '',
      
      // Perfil detalhado
      bio: rtdbUserData.bio || '',
      aboutMe: rtdbUserData.aboutMe || '',
      location: rtdbUserData.location || '',
      languages: rtdbUserData.languages || '',
      hobbies: rtdbUserData.hobbies || '',
      interests: rtdbUserData.interests || '',
      
      // URLs de mídia
      profilePictureURL: rtdbUserData.profilePictureURL || null,
      coverPhotoURL: rtdbUserData.coverPhotoURL || null,
      
      // Configurações da conta
      accountType: rtdbUserData.accountType || 'both',
      profileComplete: rtdbUserData.profileComplete || false,
      specialAssistance: rtdbUserData.specialAssistance || false,
      selectedStatus: rtdbUserData.selectedStatus || 'online',
      
      // Preferências de comunicação
      communicationPreferences: rtdbUserData.communicationPreferences || {},
      
      // Timestamps
      createdAt: rtdbUserData.createdAt ? admin.firestore.Timestamp.fromMillis(rtdbUserData.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // Dados do último bônus (se existir)
      lastDailyBonus: rtdbUserData.lastDailyBonus ? admin.firestore.Timestamp.fromMillis(rtdbUserData.lastDailyBonus) : null,
      
      // Índices para queries (denormalizados para performance)
      searchTerms: [
        (rtdbUserData.displayName || '').toLowerCase(),
        (rtdbUserData.username || '').toLowerCase(),
        (rtdbUserData.location || '').toLowerCase()
      ].filter(term => term.length > 0),
      
      // Contadores para performance
      stats: {
        totalPosts: 0,
        totalServices: 0,
        totalPacks: 0,
        totalSales: 0
      }
    };

    // Salvar no Firestore
    const userRef = db.collection('users').doc(userId);
    await userRef.set(firestoreUserData);

    logger.info(`✅ Usuário ${userId} migrado para Firestore`);
    return { 
      success: true, 
      message: 'Usuário migrado com sucesso',
      userData: firestoreUserData 
    };

  } catch (error) {
    logger.error(`💥 Erro ao migrar usuário ${userId}:`, error);
    throw new HttpsError("internal", `Erro na migração: ${error.message}`);
  }
});

/**
 * Migra todos os usuários do RTDB para Firestore (admin only)
 */
export const migrateAllUsers = onCall({
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  // TODO: Adicionar verificação de admin
  // const isAdmin = await checkAdminStatus(request.auth.uid);
  // if (!isAdmin) {
  //   throw new HttpsError("permission-denied", "Apenas administradores podem executar migração em massa");
  // }

  try {
    // Buscar todos os usuários do RTDB
    // Read all users from legacy RTDB during migration
    const usersSnapshot = await rtdbLegacy.ref('users').once('value');
    
    if (!usersSnapshot.exists()) {
      return { success: true, message: 'Nenhum usuário encontrado para migrar', count: 0 };
    }

    const users = usersSnapshot.val();
    const userIds = Object.keys(users);
    const batch = db.batch();
    let migratedCount = 0;

    for (const userId of userIds) {
      const rtdbUserData = users[userId];
      
      // Estrutura otimizada para Firestore (mesmo código acima)
      const firestoreUserData = {
        uid: userId,
        email: rtdbUserData.email || '',
        displayName: rtdbUserData.displayName || '',
        username: rtdbUserData.username || '',
        name: rtdbUserData.name || '',
        bio: rtdbUserData.bio || '',
        aboutMe: rtdbUserData.aboutMe || '',
        location: rtdbUserData.location || '',
        languages: rtdbUserData.languages || '',
        hobbies: rtdbUserData.hobbies || '',
        interests: rtdbUserData.interests || '',
        profilePictureURL: rtdbUserData.profilePictureURL || null,
        coverPhotoURL: rtdbUserData.coverPhotoURL || null,
        accountType: rtdbUserData.accountType || 'both',
        profileComplete: rtdbUserData.profileComplete || false,
        specialAssistance: rtdbUserData.specialAssistance || false,
        selectedStatus: rtdbUserData.selectedStatus || 'online',
        communicationPreferences: rtdbUserData.communicationPreferences || {},
        createdAt: rtdbUserData.createdAt ? admin.firestore.Timestamp.fromMillis(rtdbUserData.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastDailyBonus: rtdbUserData.lastDailyBonus ? admin.firestore.Timestamp.fromMillis(rtdbUserData.lastDailyBonus) : null,
        searchTerms: [
          (rtdbUserData.displayName || '').toLowerCase(),
          (rtdbUserData.username || '').toLowerCase(),
          (rtdbUserData.location || '').toLowerCase()
        ].filter(term => term.length > 0),
        stats: {
          totalPosts: 0,
          totalServices: 0,
          totalPacks: 0,
          totalSales: 0
        }
      };

      const userRef = db.collection('users').doc(userId);
      batch.set(userRef, firestoreUserData);
      migratedCount++;

      // Commit em lotes de 500 (limite do Firestore)
      if (migratedCount % 500 === 0) {
        await batch.commit();
        logger.info(`📦 Batch de ${migratedCount} usuários migrados`);
      }
    }

    // Commit final
    if (migratedCount % 500 !== 0) {
      await batch.commit();
    }

    logger.info(`✅ Migração completa: ${migratedCount} usuários migrados para Firestore`);
    return { 
      success: true, 
      message: `${migratedCount} usuários migrados com sucesso`,
      count: migratedCount 
    };

  } catch (error) {
    logger.error(`💥 Erro na migração em massa:`, error);
    throw new HttpsError("internal", `Erro na migração: ${error.message}`);
  }
});

/**
 * Migra packs do RTDB legado -> Firestore (packs collection)
 */
export const migratePacksFromLegacy = onCall({
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    const packsSnap = await rtdbLegacy.ref('packs').once('value');
    if (!packsSnap.exists()) {
      return { success: true, migrated: 0 };
    }

    let migrated = 0;
    const packsByUser = packsSnap.val();
    for (const authorId of Object.keys(packsByUser)) {
      const userPacks = packsByUser[authorId] || {};
      for (const packId of Object.keys(userPacks)) {
        const p = userPacks[packId] || {};
        // Basic mapping with safe defaults
        const packRef = db.collection('packs').doc();
        await packRef.set({
          id: packRef.id,
          authorId,
          title: (p.title || `Pack ${packId}`).toString().slice(0, 120),
          description: (p.description || '').toString().slice(0, 2000),
          price: Math.max(0, Number(p.price || 0)),
          category: (p.category || 'geral').toString(),
          tags: Array.isArray(p.tags) ? p.tags : [],
          mediaUrls: Array.isArray(p.mediaUrls) ? p.mediaUrls : [],
          isActive: p.isActive !== false,
          purchaseCount: Number(p.purchaseCount || 0),
          rating: Number(p.rating || 0),
          totalRating: Number(p.totalRating || 0),
          ratingCount: Number(p.ratingCount || 0),
          searchTerms: [
            String(p.title || '').toLowerCase(),
            String(p.description || '').toLowerCase(),
            String(p.category || 'geral').toLowerCase(),
          ].filter(Boolean),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        migrated++;
      }
    }

    logger.info(`✅ Packs migrados: ${migrated}`);
    return { success: true, migrated };
  } catch (error) {
    logger.error('💥 Erro ao migrar packs:', error);
    throw new HttpsError('internal', 'Erro ao migrar packs');
  }
});

/**
 * Migra services do RTDB legado -> Firestore (services collection)
 */
export const migrateServicesFromLegacy = onCall({
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    const servicesSnap = await rtdbLegacy.ref('services').once('value');
    if (!servicesSnap.exists()) {
      return { success: true, migrated: 0 };
    }

    let migrated = 0;
    const servicesByUser = servicesSnap.val();
    for (const providerId of Object.keys(servicesByUser)) {
      const userServices = servicesByUser[providerId] || {};
      for (const serviceId of Object.keys(userServices)) {
        const s = userServices[serviceId] || {};
        const serviceRef = db.collection('services').doc();
        await serviceRef.set({
          id: serviceRef.id,
          providerId,
          title: (s.title || `Serviço ${serviceId}`).toString().slice(0, 120),
          description: (s.description || '').toString().slice(0, 2000),
          price: Math.max(0, Number(s.price || 0)),
          category: (s.category || 'geral').toString(),
          tags: Array.isArray(s.tags) ? s.tags : [],
          deliveryTime: (s.deliveryTime || 'negociavel').toString(),
          isActive: s.isActive !== false,
          orderCount: Number(s.orderCount || 0),
          rating: Number(s.rating || 0),
          totalRating: Number(s.totalRating || 0),
          ratingCount: Number(s.ratingCount || 0),
          searchTerms: [
            String(s.title || '').toLowerCase(),
            String(s.description || '').toLowerCase(),
            String(s.category || 'geral').toLowerCase(),
          ].filter(Boolean),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        migrated++;
      }
    }

    logger.info(`✅ Serviços migrados: ${migrated}`);
    return { success: true, migrated };
  } catch (error) {
    logger.error('💥 Erro ao migrar serviços:', error);
    throw new HttpsError('internal', 'Erro ao migrar serviços');
  }
});

/**
 * Migra followers do RTDB legado -> Firestore (subcoleções users/{uid}/followers)
 */
export const migrateFollowersFromLegacy = onCall({
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    const followersSnap = await rtdbLegacy.ref('followers').once('value');
    if (!followersSnap.exists()) {
      return { success: true, migrated: 0 };
    }

    let migrated = 0;
    const batch = db.batch();
    const all = followersSnap.val();
    for (const targetUserId of Object.keys(all)) {
      const followers = all[targetUserId] || {};
      for (const followerId of Object.keys(followers)) {
        const followerRef = db.collection('users').doc(targetUserId)
          .collection('followers').doc(followerId);
        batch.set(followerRef, {
          userId: targetUserId,
          followerId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        migrated++;
      }
    }

    if (migrated > 0) await batch.commit();
    logger.info(`✅ Followers migrados: ${migrated}`);
    return { success: true, migrated };
  } catch (error) {
    logger.error('💥 Erro ao migrar followers:', error);
    throw new HttpsError('internal', 'Erro ao migrar followers');
  }
});

/**
 * Migra packs, services e followers numa chamada só (users já possui função própria)
 */
export const migrateAllLegacyData = onCall({
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    const [packs, services, followers] = await Promise.all([
      migratePacksFromLegacy.run?.() || migratePacksFromLegacy({ auth: request.auth, data: {} }),
      migrateServicesFromLegacy.run?.() || migrateServicesFromLegacy({ auth: request.auth, data: {} }),
      migrateFollowersFromLegacy.run?.() || migrateFollowersFromLegacy({ auth: request.auth, data: {} })
    ]);

    return {
      success: true,
      packs: packs?.data || packs,
      services: services?.data || services,
      followers: followers?.data || followers,
    };
  } catch (error) {
    logger.error('💥 Erro ao migrar dados legados:', error);
    throw new HttpsError('internal', 'Erro ao migrar dados legados');
  }
});

/**
 * API unificada para operações CRUD de Services, Packs e Posts
 */
export const api = onCall({
  memory: "256MiB",
  timeoutSeconds: 90,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { resource, action, payload } = request.data;
  const userId = request.auth.uid;

  // Validação dos parâmetros
  if (!resource || !action || !payload) {
    throw new HttpsError("invalid-argument", "resource, action e payload são obrigatórios");
  }

  const validResources = ['service', 'pack', 'post'];
  const validActions = ['create', 'update', 'delete'];

  if (!validResources.includes(resource)) {
    throw new HttpsError("invalid-argument", `resource deve ser: ${validResources.join(', ')}`);
  }

  if (!validActions.includes(action)) {
    throw new HttpsError("invalid-argument", `action deve ser: ${validActions.join(', ')}`);
  }

  try {
    // Roteamento interno baseado no resource e action
    switch (`${resource}-${action}`) {
      // === SERVICES ===
      case 'service-create':
        return await createServiceInternal(userId, payload);
      case 'service-update':
        return await updateServiceInternal(userId, payload);
      case 'service-delete':
        return await deleteServiceInternal(userId, payload);

      // === PACKS ===
      case 'pack-create':
        return await createPackInternal(userId, payload);
      case 'pack-update':
        return await updatePackInternal(userId, payload);
      case 'pack-delete':
        return await deletePackInternal(userId, payload);

      // === POSTS ===
      case 'post-create':
        return await createPostInternal(userId, payload);
      case 'post-update':
        return await updatePostInternal(userId, payload);
      case 'post-delete':
        return await deletePostInternal(userId, payload);

      default:
        throw new HttpsError("invalid-argument", `Operação não suportada: ${resource}-${action}`);
    }
  } catch (error) {
    logger.error(`💥 Erro na API ${resource}-${action}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * CRUD operations for Packs
 */

// REMOVIDO: createPack - agora usa a API unificada

// REMOVIDO: updatePack - agora usa a API unificada

// REMOVIDO: deletePack - agora usa a API unificada

/**
 * CRUD operations for Services (LEGADO - mantido para compatibilidade)
 */

// REMOVIDO: Todas as funções CRUD individuais - agora usa a API unificada
// createService, updateService, deleteService, createPost, updatePost, deletePost removidas

// Mantidas apenas as funções que não são CRUD básico
export const togglePostLike = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { postId } = request.data;
  const userId = request.auth.uid;

  if (!postId) {
    throw new HttpsError("invalid-argument", "ID do post é obrigatório");
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Check if post exists
      const postRef = db.collection('posts').doc(postId);
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists) {
        throw new Error("Post não encontrado");
      }

      // Check if user already liked this post
      const likeRef = db.collection('posts').doc(postId).collection('likes').doc(userId);
      const likeDoc = await transaction.get(likeRef);

      const postData = postDoc.data();
      let isLiked = false;
      let newLikeCount = postData.likes || 0;

      if (likeDoc.exists) {
        // Unlike the post
        transaction.delete(likeRef);
        newLikeCount = Math.max(0, newLikeCount - 1);
        isLiked = false;
      } else {
        // Like the post
        transaction.set(likeRef, {
          userId,
          likedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        newLikeCount += 1;
        isLiked = true;
      }

      // Update post like count
      transaction.update(postRef, {
        likes: newLikeCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { isLiked, newLikeCount };
    });

    logger.info(`✅ Post ${result.isLiked ? 'curtido' : 'descurtido'}: ${postId} por ${userId}`);
    return { success: true, isLiked: result.isLiked, likes: result.newLikeCount };

  } catch (error) {
    logger.error(`💥 Erro ao curtir/descurtir post:`, error);
    if (error.message === "Post não encontrado") {
      throw new HttpsError("not-found", "Post não encontrado");
    }
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

// Add comment to a post
export const addComment = onCall({
  memory: "128MiB",
  timeoutSeconds: 60,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { postId, content } = request.data;
  const userId = request.auth.uid;

  if (!postId || !content || content.trim().length === 0) {
    throw new HttpsError("invalid-argument", "ID do post e conteúdo do comentário são obrigatórios");
  }

  if (content.length > 500) {
    throw new HttpsError("invalid-argument", "Comentário muito longo (máximo 500 caracteres)");
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Check if post exists
      const postRef = db.collection('posts').doc(postId);
      const postDoc = await transaction.get(postRef);

      if (!postDoc.exists) {
        throw new Error("Post não encontrado");
      }

      // Create comment
      const commentRef = db.collection('posts').doc(postId).collection('comments').doc();
      const commentData = {
        id: commentRef.id,
        authorId: userId,
        content: content.trim(),
        likes: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(commentRef, commentData);

      // Update post comment count
      const postData = postDoc.data();
      const newCommentCount = (postData.comments || 0) + 1;

      transaction.update(postRef, {
        comments: newCommentCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { commentData, newCommentCount };
    });

    logger.info(`✅ Comentário adicionado ao post ${postId} por ${userId}`);
    return { 
      success: true, 
      commentId: result.commentData.id, 
      comment: result.commentData,
      comments: result.newCommentCount 
    };

  } catch (error) {
    logger.error(`💥 Erro ao adicionar comentário:`, error);
    if (error.message === "Post não encontrado") {
      throw new HttpsError("not-found", "Post não encontrado");
    }
    throw new HttpsError("internal", "Erro interno do servidor");
  }
});

/**
 * Função agendada para liberar automaticamente VC pendente após 24h
 */
export const autoReleaseServices = onSchedule({
  schedule: "*/30 * * * *", // A cada 30 minutos
  timeZone: "America/Sao_Paulo",
  memory: "64MiB",
  timeoutSeconds: 540,
}, async () => {
  try {
    logger.info("🕐 Iniciando liberação automática de serviços...");

    const now = admin.firestore.Timestamp.now();
    
    // Buscar pedidos entregues que passaram do prazo
    const expiredOrdersQuery = db.collection('serviceOrders')
      .where('status', '==', 'DELIVERED')
      .where('timestamps.autoReleaseAt', '<=', now)
      .limit(50); // Processar em lotes

    const expiredOrdersSnapshot = await expiredOrdersQuery.get();

    if (expiredOrdersSnapshot.empty) {
      logger.info("✅ Nenhum serviço para liberar automaticamente");
      return { processed: 0 };
    }

    let processedCount = 0;
    const batch = db.batch();

    for (const orderDoc of expiredOrdersSnapshot.docs) {
      const order = orderDoc.data();
      const orderRef = orderDoc.ref;

      try {
        // Liberar VC pendente para VC real
        const sellerWalletRef = db.collection('wallets').doc(order.sellerId);
        const sellerWalletDoc = await sellerWalletRef.get();

        if (!sellerWalletDoc.exists) {
          logger.warn(`⚠️ Carteira não encontrada para vendedor: ${order.sellerId}`);
          continue;
        }

        const sellerWallet = sellerWalletDoc.data();
        const newVc = (sellerWallet.vc || 0) + order.vcAmount;
        const newVcPending = Math.max(0, (sellerWallet.vcPending || 0) - order.vcAmount);

        // Atualizar carteira
        batch.update(sellerWalletRef, {
          vc: newVc,
          vcPending: newVcPending,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atualizar status do pedido
        batch.update(orderRef, {
          status: 'AUTO_RELEASED',
          'timestamps.confirmedAt': admin.firestore.FieldValue.serverTimestamp()
        });

        // Criar transação de liberação automática
        const transactionRef = db.collection('transactions').doc();
        batch.set(transactionRef, {
          id: transactionRef.id,
          userId: order.sellerId,
          type: 'SERVICE_AUTO_RELEASE',
          amounts: { 
            vc: order.vcAmount,
            vcPending: -order.vcAmount
          },
          ref: {
            serviceId: order.serviceId,
            serviceOrderId: orderDoc.id,
            targetUserId: order.buyerId
          },
          status: 'CONFIRMED',
          metadata: {
            description: `Serviço Auto-Liberado: ${order.metadata.serviceName}`,
            reason: 'Comprador não confirmou em 24h'
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Atualizar pedido com ID da transação
        batch.update(orderRef, {
          'transactionIds.confirmationId': transactionRef.id
        });

        processedCount++;
        logger.info(`✅ Serviço auto-liberado: ${orderDoc.id} - ${order.vcAmount} VC`);

      } catch (error) {
        logger.error(`💥 Erro ao processar pedido ${orderDoc.id}:`, error);
      }
    }

    if (processedCount > 0) {
      await batch.commit();
      logger.info(`✅ ${processedCount} serviços liberados automaticamente`);
    }

    return { processed: processedCount };

  } catch (error) {
    logger.error("💥 Erro na liberação automática:", error);
    throw error;
  }
});

// === INTERNAL FUNCTIONS FOR API ===

// Services Internal Functions
async function createServiceInternal(userId, payload) {
  const { title, description, price, category, tags, deliveryTime } = payload;

  if (!title || !description || !price || price <= 0 || !deliveryTime) {
    throw new HttpsError("invalid-argument", "Dados do serviço são obrigatórios");
  }

  const serviceRef = db.collection('services').doc();
  const serviceData = {
    id: serviceRef.id,
    providerId: userId,
    title: title.trim(),
    description: description.trim(),
    price: Math.round(price),
    category: category || 'geral',
    tags: Array.isArray(tags) ? tags : [],
    deliveryTime: deliveryTime,
    isActive: true,
    orderCount: 0,
    rating: 0,
    totalRating: 0,
    ratingCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    searchTerms: [
      title.toLowerCase(),
      description.toLowerCase(),
      category.toLowerCase(),
      ...tags.map(tag => tag.toLowerCase())
    ].filter(term => term.length > 0)
  };

  await serviceRef.set(serviceData);

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalServices': admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Serviço criado: ${serviceRef.id} por ${userId}`);
  return { success: true, serviceId: serviceRef.id, service: serviceData };
}

async function updateServiceInternal(userId, payload) {
  const { serviceId, updates } = payload;

  if (!serviceId || !updates) {
    throw new HttpsError("invalid-argument", "ID do serviço e atualizações são obrigatórios");
  }

  const serviceRef = db.collection('services').doc(serviceId);
  const serviceDoc = await serviceRef.get();

  if (!serviceDoc.exists) {
    throw new HttpsError("not-found", "Serviço não encontrado");
  }

  const serviceData = serviceDoc.data();
  if (serviceData.providerId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para editar este serviço");
  }

  const updateData = {
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (updates.title || updates.description || updates.category || updates.tags) {
    const newTitle = updates.title || serviceData.title;
    const newDescription = updates.description || serviceData.description;
    const newCategory = updates.category || serviceData.category;
    const newTags = updates.tags || serviceData.tags;

    updateData.searchTerms = [
      newTitle.toLowerCase(),
      newDescription.toLowerCase(),
      newCategory.toLowerCase(),
      ...newTags.map(tag => tag.toLowerCase())
    ].filter(term => term.length > 0);
  }

  await serviceRef.update(updateData);

  logger.info(`✅ Serviço atualizado: ${serviceId}`);
  return { success: true, serviceId };
}

async function deleteServiceInternal(userId, payload) {
  const { serviceId } = payload;

  if (!serviceId) {
    throw new HttpsError("invalid-argument", "ID do serviço é obrigatório");
  }

  const serviceRef = db.collection('services').doc(serviceId);
  const serviceDoc = await serviceRef.get();

  if (!serviceDoc.exists) {
    throw new HttpsError("not-found", "Serviço não encontrado");
  }

  const serviceData = serviceDoc.data();
  if (serviceData.providerId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para deletar este serviço");
  }

  await serviceRef.update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalServices': admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Serviço deletado: ${serviceId}`);
  return { success: true, serviceId };
}

// Packs Internal Functions
async function createPackInternal(userId, payload) {
  const { title, description, price, category, tags, mediaUrls } = payload;

  if (!title || !description || !price || price <= 0) {
    throw new HttpsError("invalid-argument", "Dados do pack são obrigatórios");
  }

  const packRef = db.collection('packs').doc();
  const packData = {
    id: packRef.id,
    authorId: userId,
    title: title.trim(),
    description: description.trim(),
    price: Math.round(price),
    category: category || 'geral',
    tags: Array.isArray(tags) ? tags : [],
    mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
    isActive: true,
    purchaseCount: 0,
    rating: 0,
    totalRating: 0,
    ratingCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    searchTerms: [
      title.toLowerCase(),
      description.toLowerCase(),
      category.toLowerCase(),
      ...tags.map(tag => tag.toLowerCase())
    ].filter(term => term.length > 0)
  };

  await packRef.set(packData);

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalPacks': admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Pack criado: ${packRef.id} por ${userId}`);
  return { success: true, packId: packRef.id, pack: packData };
}

async function updatePackInternal(userId, payload) {
  const { packId, updates } = payload;

  if (!packId || !updates) {
    throw new HttpsError("invalid-argument", "ID do pack e atualizações são obrigatórios");
  }

  const packRef = db.collection('packs').doc(packId);
  const packDoc = await packRef.get();

  if (!packDoc.exists) {
    throw new HttpsError("not-found", "Pack não encontrado");
  }

  const packData = packDoc.data();
  if (packData.authorId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para editar este pack");
  }

  const updateData = {
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (updates.title || updates.description || updates.category || updates.tags) {
    const newTitle = updates.title || packData.title;
    const newDescription = updates.description || packData.description;
    const newCategory = updates.category || packData.category;
    const newTags = updates.tags || packData.tags;

    updateData.searchTerms = [
      newTitle.toLowerCase(),
      newDescription.toLowerCase(),
      newCategory.toLowerCase(),
      ...newTags.map(tag => tag.toLowerCase())
    ].filter(term => term.length > 0);
  }

  await packRef.update(updateData);

  logger.info(`✅ Pack atualizado: ${packId}`);
  return { success: true, packId };
}

async function deletePackInternal(userId, payload) {
  const { packId } = payload;

  if (!packId) {
    throw new HttpsError("invalid-argument", "ID do pack é obrigatório");
  }

  const packRef = db.collection('packs').doc(packId);
  const packDoc = await packRef.get();

  if (!packDoc.exists) {
    throw new HttpsError("not-found", "Pack não encontrado");
  }

  const packData = packDoc.data();
  if (packData.authorId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para deletar este pack");
  }

  await packRef.update({
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalPacks': admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Pack deletado: ${packId}`);
  return { success: true, packId };
}

// Posts Internal Functions
async function createPostInternal(userId, payload) {
  const { content, mediaUrls, visibility } = payload;

  if (!content || content.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Conteúdo do post é obrigatório");
  }

  if (content.length > 2000) {
    throw new HttpsError("invalid-argument", "Conteúdo do post muito longo (máximo 2000 caracteres)");
  }

  const postRef = db.collection('posts').doc();
  const postData = {
    id: postRef.id,
    authorId: userId,
    content: content.trim(),
    mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
    visibility: visibility || 'public',
    likes: 0,
    comments: 0,
    shares: 0,
    isVisible: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    searchTerms: content.toLowerCase().split(' ').filter(term => term.length > 2)
  };

  await postRef.set(postData);

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalPosts': admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Post criado: ${postRef.id} por ${userId}`);
  return { success: true, postId: postRef.id, post: postData };
}

async function updatePostInternal(userId, payload) {
  const { postId, updates } = payload;

  if (!postId || !updates) {
    throw new HttpsError("invalid-argument", "ID do post e atualizações são obrigatórios");
  }

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();

  if (!postDoc.exists) {
    throw new HttpsError("not-found", "Post não encontrado");
  }

  const postData = postDoc.data();
  if (postData.authorId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para editar este post");
  }

  const updateData = {
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (updates.content) {
    updateData.searchTerms = updates.content.toLowerCase().split(' ').filter(term => term.length > 2);
  }

  await postRef.update(updateData);

  logger.info(`✅ Post atualizado: ${postId}`);
  return { success: true, postId };
}

async function deletePostInternal(userId, payload) {
  const { postId } = payload;

  if (!postId) {
    throw new HttpsError("invalid-argument", "ID do post é obrigatório");
  }

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();

  if (!postDoc.exists) {
    throw new HttpsError("not-found", "Post não encontrado");
  }

  const postData = postDoc.data();
  if (postData.authorId !== userId) {
    throw new HttpsError("permission-denied", "Você não tem permissão para deletar este post");
  }

  await postRef.update({
    isVisible: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    'stats.totalPosts': admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info(`✅ Post deletado: ${postId}`);
  return { success: true, postId };
}
