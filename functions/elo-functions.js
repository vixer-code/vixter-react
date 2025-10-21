import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Configurações padrão dos elos baseadas em XP
 */
const DEFAULT_ELO_CONFIG = {
  ferro: {
    name: 'Ferro',
    order: 1,
    requirements: {
      xp: 0
    },
    benefits: {
      badgeColor: '#8B4513',
      description: 'Início da jornada',
      imageUrl: '/images/iron.png'
    }
  },
  bronze: {
    name: 'Bronze',
    order: 2,
    requirements: {
      xp: 1250
    },
    benefits: {
      badgeColor: '#CD7F32',
      description: 'Primeiros passos',
      imageUrl: '/images/bronze.png'
    }
  },
  prata: {
    name: 'Prata',
    order: 3,
    requirements: {
      xp: 5450  // 1250 + 4200
    },
    benefits: {
      badgeColor: '#C0C0C0',
      description: 'Crescimento constante',
      imageUrl: '/images/silver.png'
    }
  },
  ouro: {
    name: 'Ouro',
    order: 4,
    requirements: {
      xp: 13950  // 1250 + 4200 + 8500
    },
    benefits: {
      badgeColor: '#FFD700',
      description: 'Excelência em atividade',
      imageUrl: '/images/gold.png'
    }
  },
  platina: {
    name: 'Platina',
    order: 5,
    requirements: {
      xp: 29300  // 1250 + 4200 + 8500 + 15350
    },
    benefits: {
      badgeColor: '#E5E4E2',
      description: 'Dedicação exemplar',
      imageUrl: '/images/platinum.png'
    }
  },
  esmeralda: {
    name: 'Esmeralda',
    order: 6,
    requirements: {
      xp: 48100  // 1250 + 4200 + 8500 + 15350 + 18800
    },
    benefits: {
      badgeColor: '#50C878',
      description: 'Maestria em engajamento',
      imageUrl: '/images/emerald.png'
    }
  },
  diamante: {
    name: 'Diamante',
    order: 7,
    requirements: {
      xp: 70400  // 1250 + 4200 + 8500 + 15350 + 18800 + 22300
    },
    benefits: {
      badgeColor: '#B9F2FF',
      description: 'Elite da plataforma',
      imageUrl: '/images/diamond.png'
    }
  },
  mestre: {
    name: 'Mestre',
    order: 8,
    requirements: {
      xp: 98600  // 1250 + 4200 + 8500 + 15350 + 18800 + 22300 + 28200
    },
    benefits: {
      badgeColor: '#800080',
      description: 'Lenda da comunidade',
      imageUrl: '/images/master.png'
    }
  }
};

/**
 * Inicializa as configurações dos elos no banco de dados
 */
const initializeEloConfig = onCall({
  region: 'us-central1',
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    logger.info('🔄 Inicializando configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    
    await eloConfigRef.set({
      config: DEFAULT_ELO_CONFIG,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0.0'
    }, { merge: true });
    
    logger.info('✅ Configurações dos elos inicializadas com sucesso');
    
    return {
      success: true,
      message: 'Configurações dos elos inicializadas com sucesso',
      config: DEFAULT_ELO_CONFIG
    };
    
  } catch (error) {
    logger.error('❌ Erro ao inicializar configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao inicializar configurações dos elos");
  }
});

/**
 * Atualiza as configurações dos elos
 */
const updateEloConfig = onCall({
  region: "us-central1",
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { newConfig } = request.data;
  
  if (!newConfig) {
    throw new HttpsError("invalid-argument", "Configuração é obrigatória");
  }

  try {
    logger.info('🔄 Atualizando configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    
    await eloConfigRef.set({
      config: newConfig,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0.1'
    }, { merge: true });
    
    logger.info('✅ Configurações dos elos atualizadas com sucesso');
    
    return {
      success: true,
      message: 'Configurações dos elos atualizadas com sucesso'
    };
    
  } catch (error) {
    logger.error('❌ Erro ao atualizar configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao atualizar configurações dos elos");
  }
});

/**
 * Obtém as configurações dos elos
 */
const getEloConfig = onCall({
  region: 'us-central1',
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  try {
    logger.info('🔄 Obtendo configurações dos elos...');
    
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    const eloConfigSnap = await eloConfigRef.get();
    
    if (!eloConfigSnap.exists) {
      // Se não existir, retorna configuração padrão
      return {
        success: true,
        config: DEFAULT_ELO_CONFIG,
        isDefault: true
      };
    }
    
    const eloConfig = eloConfigSnap.data();
    
    logger.info('✅ Configurações dos elos obtidas com sucesso');
    
    return {
      success: true,
      config: eloConfig.config,
      lastUpdated: eloConfig.lastUpdated,
      version: eloConfig.version
    };
    
  } catch (error) {
    logger.error('❌ Erro ao obter configurações dos elos:', error);
    throw new HttpsError("internal", "Erro interno ao obter configurações dos elos");
  }
});

/**
 * Calcula o elo atual do usuário baseado nas métricas (versão interna)
 */
const calculateUserEloInternal = async (targetUserId) => {
  try {
    logger.info(`🔄 Calculando elo para usuário: ${targetUserId}`);
    
    // Obter configurações dos elos
    const eloConfigRef = db.collection('systemConfig').doc('eloConfig');
    const eloConfigSnap = await eloConfigRef.get();
    
    const eloConfig = eloConfigSnap.exists ? eloConfigSnap.data().config : DEFAULT_ELO_CONFIG;
    
    // Obter dados do usuário
    const userRef = db.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new Error("Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const accountType = userData.accountType || 'client';
    const stats = userData.stats || {};
    const currentXp = stats.xp || 0;
    
    // Determinar elo baseado no XP
    let currentElo = 'ferro';
    let currentEloData = eloConfig.ferro;
    
    // Ordenar elos por XP necessário (maior para menor)
    const eloEntries = Object.entries(eloConfig).sort((a, b) => (b[1].requirements.xp || 0) - (a[1].requirements.xp || 0));
    
    for (const [eloKey, eloData] of eloEntries) {
      const requiredXp = eloData.requirements.xp || 0;
      
      if (currentXp >= requiredXp) {
        currentElo = eloKey;
        currentEloData = eloData;
        break;
      }
    }
    
    // Calcular progresso para o próximo elo
    let nextElo = null;
    let progress = null;
    
    const currentEloOrder = currentEloData.order;
    const nextEloEntry = eloEntries.find(([_, data]) => data.order === currentEloOrder + 1);
    
    if (nextEloEntry) {
      const [nextEloKey, nextEloData] = nextEloEntry;
      nextElo = nextEloKey;
      
      const nextRequiredXp = nextEloData.requirements.xp || 0;
      const currentRequiredXp = currentEloData.requirements.xp || 0;
      
      if (nextRequiredXp > currentRequiredXp) {
        const progressValue = Math.min(100, Math.max(0, 
          ((currentXp - currentRequiredXp) / (nextRequiredXp - currentRequiredXp)) * 100
        ));
        
        progress = {
          xp: {
            current: currentXp,
            required: nextRequiredXp,
            progress: Math.round(progressValue)
          }
        };
      }
    }
    
    logger.info(`✅ Elo calculado para ${targetUserId}: ${currentElo}`);
    
    return {
      success: true,
      elo: {
        current: currentElo,
        name: currentEloData.name,
        order: currentEloData.order,
        benefits: currentEloData.benefits,
        nextElo: nextElo,
        progress: progress
      },
      stats: stats,
      accountType: accountType
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao calcular elo para ${targetUserId}:`, error);
    throw error;
  }
};

/**
 * Calcula o elo atual do usuário baseado nas métricas (Cloud Function)
 */
const calculateUserElo = onCall({
  region: 'us-central1',
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    return await calculateUserEloInternal(targetUserId);
  } catch (error) {
    logger.error(`❌ Erro ao calcular elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao calcular elo do usuário");
  }
});

/**
 * Atualiza o elo do usuário no documento do usuário
 */
const updateUserElo = onCall({
  region: 'us-central1',
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    logger.info(`🔄 Atualizando elo para usuário: ${targetUserId}`);
    
    // Calcular elo atual
    const eloResult = await calculateUserEloInternal(targetUserId);
    
    if (!eloResult.success) {
      throw new HttpsError("internal", "Erro ao calcular elo do usuário");
    }
    
    const { elo } = eloResult;
    
    // Atualizar documento do usuário
    const userRef = db.collection('users').doc(targetUserId);
    await userRef.update({
      elo: {
        current: elo.current,
        name: elo.name,
        order: elo.order,
        benefits: elo.benefits,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info(`✅ Elo atualizado para ${targetUserId}: ${elo.current}`);
    
    return {
      success: true,
      elo: elo,
      message: `Elo atualizado para ${elo.name}`
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao atualizar elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao atualizar elo do usuário");
  }
});

/**
 * Obtém informações do elo de um usuário
 */
const getUserElo = onCall({
  region: 'us-central1',
  memory: "64MiB",
  timeoutSeconds: 15,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId } = request.data;
  const targetUserId = userId || request.auth.uid;

  try {
    logger.info(`🔄 Obtendo elo para usuário: ${targetUserId}`);
    
    // Obter dados do usuário
    const userRef = db.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const elo = userData.elo || null;
    
    logger.info(`✅ Elo obtido para ${targetUserId}: ${elo?.current || 'ferro'}`);
    
    return {
      success: true,
      elo: elo,
      userId: targetUserId
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao obter elo para ${targetUserId}:`, error);
    throw new HttpsError("internal", "Erro interno ao obter elo do usuário");
  }
});

/**
 * Calcula XP baseado na nova fórmula: (x*0.67)*2y=z
 * x = valor em VP do produto
 * y = tipo do produto (1 = vixtips, 1.5 = packs, 2 = serviços)
 * z = valor total de XP
 */
const calculateXpFromTransaction = (transactionType, vpAmount, productType = null) => {
  // Determinar o tipo de produto (y) baseado na transação
  let productMultiplier = 1; // Default para vixtips
  
  if (productType) {
    // Se o tipo do produto foi especificado, usar ele
    productMultiplier = productType;
  } else {
    // Determinar baseado no tipo de transação
    switch (transactionType) {
      case 'PACK_SALE':
      case 'PACK_PURCHASE':
        productMultiplier = 1.5; // Packs
        break;
      case 'SERVICE_SALE':
      case 'SERVICE_PURCHASE':
        productMultiplier = 2; // Serviços
        break;
      case 'VIXTIP_SENT':
      case 'VIXTIP_RECEIVED':
        productMultiplier = 1; // Vixtips
        break;
      default:
        productMultiplier = 1; // Default para vixtips
    }
  }
  
  // Aplicar fórmula: (x*0.67)*2y = z
  // x = vpAmount (valor em VP)
  // y = productMultiplier (tipo do produto)
  const xp = Math.floor((vpAmount * 0.67) * (2 * productMultiplier));
  
  return xp;
};

/**
 * Adiciona XP ao usuário e atualiza o elo (versão interna)
 */
const addXpToUserInternal = async (userId, xpAmount, transactionType, transactionId) => {
  try {
    logger.info(`🔄 Adicionando ${xpAmount} XP para usuário: ${userId}`);
    
    // Atualizar XP do usuário
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      throw new Error("Usuário não encontrado");
    }
    
    const userData = userSnap.data();
    const currentXp = userData.stats?.xp || 0;
    const newXp = currentXp + xpAmount;
    
    // Atualizar stats do usuário
    await userRef.update({
      'stats.xp': newXp,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Registrar transação de XP
    await db.collection('xpTransactions').add({
      userId: userId,
      xpAmount: xpAmount,
      transactionType: transactionType,
      transactionId: transactionId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Recalcular elo do usuário
    const eloResult = await calculateUserEloInternal(userId);
    
    if (eloResult.success) {
      const { elo } = eloResult;
      
      // Atualizar elo no documento do usuário
      await userRef.update({
        elo: {
          current: elo.current,
          name: elo.name,
          order: elo.order,
          benefits: elo.benefits,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    }
    
    logger.info(`✅ ${xpAmount} XP adicionado para ${userId}. Total: ${newXp}`);
    
    return {
      success: true,
      newXp: newXp,
      xpAdded: xpAmount
    };
    
  } catch (error) {
    logger.error(`❌ Erro ao adicionar XP para ${userId}:`, error);
    throw error;
  }
};

/**
 * Adiciona XP ao usuário e atualiza o elo (Cloud Function)
 */
const addXpToUser = onCall({
  region: 'us-central1',
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const { userId, xpAmount, transactionType, transactionId } = request.data;

  try {
    return await addXpToUserInternal(userId, xpAmount, transactionType, transactionId);
  } catch (error) {
    logger.error(`❌ Erro ao adicionar XP para ${userId}:`, error);
    throw new HttpsError("internal", "Erro interno ao adicionar XP");
  }
});

/**
 * Sincroniza XP e elo de todos os usuários existentes
 */
const syncAllUsersXpAndElo = onCall({
  region: 'us-central1',
  memory: "512MiB",
  timeoutSeconds: 540, // 9 minutos
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    logger.info('🔄 Iniciando sincronização de XP e elo para todos os usuários...');
    
    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    logger.info(`📊 Encontrados ${totalUsers} usuários para sincronizar`);
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Processar usuários em lotes de 50
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
      batches.push(usersSnapshot.docs.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (userDoc) => {
        try {
          const userId = userDoc.id;
          const userData = userDoc.data();
          
          // Verificar se o usuário já tem XP calculado
          const currentXp = userData.stats?.xp || 0;
          
          if (currentXp > 0) {
            // Se já tem XP, apenas recalcular o elo
            await calculateUserEloInternal(userId);
            logger.info(`✅ Elo recalculado para usuário ${userId}`);
          } else {
            // Se não tem XP, calcular baseado nas transações existentes
            await calculateAndSetUserXpFromTransactions(userId);
            logger.info(`✅ XP calculado e elo atualizado para usuário ${userId}`);
          }
          
          processedCount++;
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Erro ao sincronizar usuário ${userDoc.id}: ${error.message}`;
          errors.push(errorMsg);
          logger.error(`💥 ${errorMsg}`, error);
        }
      });
      
      // Aguardar o lote atual terminar
      await Promise.all(batchPromises);
      
      // Pequena pausa entre lotes para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const result = {
      success: true,
      message: `Sincronização concluída: ${processedCount} usuários processados, ${errorCount} erros`,
      processed: processedCount,
      errors: errorCount,
      totalUsers: totalUsers,
      errorDetails: errors
    };
    
    logger.info(`🎉 Sincronização de XP e elo concluída: ${processedCount} processados, ${errorCount} erros`);
    return result;
    
  } catch (error) {
    logger.error('💥 Erro na sincronização de XP e elo:', error);
    throw new HttpsError("internal", "Erro interno na sincronização de XP e elo");
  }
});

/**
 * Calcula e define XP do usuário baseado nas transações existentes
 */
const calculateAndSetUserXpFromTransactions = async (userId) => {
  try {
    logger.info(`🔄 Calculando XP para usuário ${userId} baseado nas transações...`);
    
    // Buscar todas as transações do usuário
    const transactionsSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();
    
    let totalXp = 0;
    const xpTransactions = [];
    
    // Processar cada transação
    for (const transactionDoc of transactionsSnapshot.docs) {
      const transactionData = transactionDoc.data();
      const transactionType = transactionData.type;
      const amounts = transactionData.amounts || {};
      
      let xpAmount = 0;
      let vpAmount = 0;
      
      // Determinar o valor em VP e tipo de produto
      switch (transactionType) {
        case 'PACK_PURCHASE':
          vpAmount = Math.abs(amounts.vp || 0);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 1.5);
          break;
        case 'PACK_SALE':
        case 'PACK_SALE_COMPLETED':
          // Converter VC para VP (1 VC = 1.5 VP)
          vpAmount = Math.ceil((amounts.vc || 0) * 1.5);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 1.5);
          break;
        case 'SERVICE_PURCHASE':
          vpAmount = Math.abs(amounts.vp || 0);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 2);
          break;
        case 'SERVICE_SALE':
        case 'SERVICE_SALE_COMPLETED':
        case 'SERVICE_SALE_AUTO_COMPLETED':
          // Converter VC para VP (1 VC = 1.5 VP)
          vpAmount = Math.ceil((amounts.vc || 0) * 1.5);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 2);
          break;
        case 'VIXTIP_SENT':
          vpAmount = Math.abs(amounts.vp || 0);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 1);
          break;
        case 'VIXTIP_RECEIVED':
          // Converter VC para VP (1 VC = 1.5 VP)
          vpAmount = Math.ceil((amounts.vc || 0) * 1.5);
          xpAmount = calculateXpFromTransaction(transactionType, vpAmount, 1);
          break;
        default:
          // Ignorar outros tipos de transação
          continue;
      }
      
      if (xpAmount > 0) {
        totalXp += xpAmount;
        xpTransactions.push({
          transactionId: transactionDoc.id,
          transactionType: transactionType,
          vpAmount: vpAmount,
          xpAmount: xpAmount,
          timestamp: transactionData.createdAt || transactionData.timestamp
        });
      }
    }
    
    if (totalXp > 0) {
      // Atualizar XP do usuário
      await db.collection('users').doc(userId).update({
        'stats.xp': totalXp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Criar transações de XP para histórico
      const batch = db.batch();
      for (const xpTransaction of xpTransactions) {
        const xpTransactionRef = db.collection('xpTransactions').doc();
        batch.set(xpTransactionRef, {
          userId: userId,
          xpAmount: xpTransaction.xpAmount,
          transactionType: xpTransaction.transactionType,
          transactionId: xpTransaction.transactionId,
          timestamp: xpTransaction.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          isRetroactive: true // Marcar como retroativo
        });
      }
      await batch.commit();
      
      // Recalcular elo do usuário
      await calculateUserEloInternal(userId);
      
      logger.info(`✅ XP calculado para ${userId}: ${totalXp} XP (${xpTransactions.length} transações)`);
    } else {
      logger.info(`ℹ️ Nenhum XP calculado para ${userId} (sem transações elegíveis)`);
    }
    
  } catch (error) {
    logger.error(`❌ Erro ao calcular XP para ${userId}:`, error);
    throw error;
  }
};

/**
 * Função de teste para verificar o sistema de XP
 */
const testXpSystem = onCall({
  region: 'us-central1',
  memory: "128MiB",
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  try {
    logger.info('🧪 Testando sistema de XP...');
    
    const testResults = {
      calculateXpTests: [],
      addXpTests: [],
      errors: []
    };
    
    // Testar cálculo de XP para diferentes tipos de transação
    const testCases = [
      { type: 'PACK_PURCHASE', vpAmount: 100, productType: 1.5, expectedMin: 200 },
      { type: 'SERVICE_PURCHASE', vpAmount: 100, productType: 2, expectedMin: 268 },
      { type: 'VIXTIP_SENT', vpAmount: 50, productType: 1, expectedMin: 67 },
      { type: 'PACK_SALE', vpAmount: 150, productType: 1.5, expectedMin: 301 },
      { type: 'SERVICE_SALE', vpAmount: 200, productType: 2, expectedMin: 536 }
    ];
    
    for (const testCase of testCases) {
      try {
        const xp = calculateXpFromTransaction(testCase.type, testCase.vpAmount, testCase.productType);
        const passed = xp >= testCase.expectedMin;
        
        testResults.calculateXpTests.push({
          type: testCase.type,
          vpAmount: testCase.vpAmount,
          productType: testCase.productType,
          calculatedXp: xp,
          expectedMin: testCase.expectedMin,
          passed: passed
        });
        
        logger.info(`🧪 Teste ${testCase.type}: ${xp} XP (esperado: >=${testCase.expectedMin}) - ${passed ? '✅' : '❌'}`);
      } catch (error) {
        testResults.errors.push(`Erro no teste ${testCase.type}: ${error.message}`);
      }
    }
    
    // Testar adição de XP para o usuário atual
    try {
      const testXpAmount = 100;
      const result = await addXpToUserInternal(request.auth.uid, testXpAmount, 'TEST_XP', 'test-transaction-id');
      
      testResults.addXpTests.push({
        userId: request.auth.uid,
        xpAmount: testXpAmount,
        result: result,
        passed: result.success
      });
      
      logger.info(`🧪 Teste de adição de XP: ${result.success ? '✅' : '❌'}`);
    } catch (error) {
      testResults.errors.push(`Erro no teste de adição de XP: ${error.message}`);
    }
    
    // Verificar se existem transações de XP para o usuário
    const xpTransactionsSnapshot = await db.collection('xpTransactions')
      .where('userId', '==', request.auth.uid)
      .limit(5)
      .get();
    
    const xpTransactions = xpTransactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    testResults.xpTransactions = xpTransactions;
    testResults.totalXpTransactions = xpTransactionsSnapshot.size;
    
    logger.info(`🧪 Encontradas ${xpTransactionsSnapshot.size} transações de XP para o usuário`);
    
    return {
      success: true,
      message: "Teste do sistema de XP concluído",
      results: testResults
    };
    
  } catch (error) {
    logger.error('💥 Erro no teste do sistema de XP:', error);
    throw new HttpsError("internal", "Erro interno no teste do sistema de XP");
  }
});

/**
 * Trigger que atualiza o elo automaticamente quando uma transação é criada/atualizada
 */
const onTransactionUpdated = onDocumentUpdated({
  document: "transactions/{transactionId}",
  region: 'us-central1',
  memory: "256MiB",
  timeoutSeconds: 30,
}, async (event) => {
  try {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    // Verificar se é uma transação válida com userId
    if (!afterData?.userId) {
      logger.warn('Transaction without userId, skipping elo update');
      return;
    }
    
    const userId = afterData.userId;
    const transactionType = afterData.type;
    
    // Verificar se é uma transação que deve gerar XP
    const xpGeneratingTypes = [
      'PACK_PURCHASE',
      'PACK_SALE_COMPLETED', 
      'SERVICE_PURCHASE',
      'SERVICE_SALE_COMPLETED',
      'SERVICE_SALE_AUTO_COMPLETED',
      'VIXTIP_SENT',
      'VIXTIP_RECEIVED'
    ];
    
    if (!xpGeneratingTypes.includes(transactionType)) {
      logger.info(`Transaction type ${transactionType} does not generate XP, skipping elo update`);
      return;
    }
    
    // Verificar se a transação foi completada
    if (afterData.status !== 'COMPLETED') {
      logger.info(`Transaction ${event.params.transactionId} not completed, skipping elo update`);
      return;
    }
    
    // Verificar se houve mudança relevante (status mudou para COMPLETED)
    const wasCompleted = beforeData?.status === 'COMPLETED';
    const isCompleted = afterData.status === 'COMPLETED';
    
    if (wasCompleted && isCompleted) {
      logger.info(`Transaction ${event.params.transactionId} already completed, skipping elo update`);
      return;
    }
    
    logger.info(`🔄 Updating elo for user ${userId} due to transaction ${event.params.transactionId} (${transactionType})`);
    
    // Recalcular elo do usuário
    const eloResult = await calculateUserEloInternal(userId);
    
    if (eloResult.success) {
      const { elo } = eloResult;
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        elo: {
          current: elo.current,
          name: elo.name,
          order: elo.order,
          benefits: elo.benefits,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
      });
      logger.info(`✅ Elo updated for user ${userId}: ${elo.current} after transaction ${event.params.transactionId}`);
    } else {
      logger.warn(`⚠️ Failed to calculate elo for user ${userId} after transaction ${event.params.transactionId}`);
    }
    
  } catch (error) {
    logger.error(`❌ Error updating elo for transaction ${event.params.transactionId}:`, error);
    // Não falhar o trigger se houver erro
  }
});

export {
  initializeEloConfig,
  updateEloConfig,
  getEloConfig,
  calculateUserElo,
  calculateUserEloInternal,
  updateUserElo,
  getUserElo,
  calculateXpFromTransaction,
  addXpToUser,
  addXpToUserInternal,
  syncAllUsersXpAndElo,
  calculateAndSetUserXpFromTransactions,
  testXpSystem,
  onTransactionUpdated
};
