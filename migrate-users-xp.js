#!/usr/bin/env node

/**
 * Script para migrar usuários existentes e sincronizar XP/elo
 * Execute com: node migrate-users-xp.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
try {
  const serviceAccount = require('./functions/service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://vixter-8b8c8-default-rtdb.firebaseio.com"
  });
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  console.log('💡 Certifique-se de que o arquivo service-account.json existe em ./functions/');
  process.exit(1);
}

const db = admin.firestore();

/**
 * Configuração dos elos
 */
const ELO_CONFIG = {
  ferro: { name: 'Ferro', order: 1, xp: 0, color: '#8B4513' },
  bronze: { name: 'Bronze', order: 2, xp: 1250, color: '#CD7F32' },
  prata: { name: 'Prata', order: 3, xp: 5450, color: '#C0C0C0' },
  ouro: { name: 'Ouro', order: 4, xp: 13950, color: '#FFD700' },
  platina: { name: 'Platina', order: 5, xp: 29300, color: '#E5E4E2' },
  esmeralda: { name: 'Esmeralda', order: 6, xp: 48100, color: '#50C878' },
  diamante: { name: 'Diamante', order: 7, xp: 70400, color: '#B9F2FF' },
  mestre: { name: 'Mestre', order: 8, xp: 98600, color: '#800080' }
};

/**
 * Calcula XP baseado na transação
 */
function calculateXpFromTransaction(transactionType, vpAmount, productType = null) {
  let productMultiplier = 1;
  
  if (productType) {
    productMultiplier = productType;
  } else {
    switch (transactionType) {
      case 'PACK_SALE':
      case 'PACK_PURCHASE':
        productMultiplier = 1.5;
        break;
      case 'SERVICE_SALE':
      case 'SERVICE_PURCHASE':
        productMultiplier = 2;
        break;
      case 'VIXTIP_SENT':
      case 'VIXTIP_RECEIVED':
        productMultiplier = 1;
        break;
      default:
        productMultiplier = 1;
    }
  }
  
  return Math.floor((vpAmount * 0.67) * (2 * productMultiplier));
}

/**
 * Calcula elo baseado no XP
 */
function calculateEloFromXp(xp) {
  const eloEntries = Object.entries(ELO_CONFIG).sort((a, b) => b[1].xp - a[1].xp);
  
  for (const [eloKey, eloData] of eloEntries) {
    if (xp >= eloData.xp) {
      return {
        current: eloKey,
        name: eloData.name,
        order: eloData.order,
        benefits: {
          badgeColor: eloData.color,
          description: eloData.description || 'Elo calculado',
          imageUrl: `/images/${eloKey}.png`
        }
      };
    }
  }
  
  // Fallback para ferro
  return {
    current: 'ferro',
    name: 'Ferro',
    order: 1,
    benefits: {
      badgeColor: '#8B4513',
      description: 'Início da jornada',
      imageUrl: '/images/iron.png'
    }
  };
}

/**
 * Migra um usuário específico
 */
async function migrateUser(userId) {
  try {
    console.log(`🔄 Migrando usuário: ${userId}`);
    
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
      // Calcular elo
      const elo = calculateEloFromXp(totalXp);
      
      // Atualizar usuário
      await db.collection('users').doc(userId).update({
        'stats.xp': totalXp,
        elo: {
          ...elo,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        },
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
          isRetroactive: true
        });
      }
      await batch.commit();
      
      console.log(`  ✅ ${userId}: ${totalXp} XP, Elo: ${elo.name} (${xpTransactions.length} transações)`);
      return { success: true, xp: totalXp, elo: elo.current, transactions: xpTransactions.length };
    } else {
      console.log(`  ℹ️ ${userId}: Nenhum XP calculado (sem transações elegíveis)`);
      return { success: true, xp: 0, elo: 'ferro', transactions: 0 };
    }
    
  } catch (error) {
    console.error(`  ❌ Erro ao migrar ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando migração de usuários para sistema de XP...\n');
  
  try {
    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    console.log(`📊 Encontrados ${totalUsers} usuários para migrar\n`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalXp = 0;
    const errors = [];
    
    // Processar usuários em lotes de 10
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
      batches.push(usersSnapshot.docs.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (userDoc) => {
        const result = await migrateUser(userDoc.id);
        processedCount++;
        
        if (result.success) {
          successCount++;
          totalXp += result.xp;
        } else {
          errorCount++;
          errors.push(`${userDoc.id}: ${result.error}`);
        }
        
        return result;
      });
      
      // Aguardar o lote atual terminar
      await Promise.all(batchPromises);
      
      // Pequena pausa entre lotes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`📈 Progresso: ${processedCount}/${totalUsers} usuários processados\n`);
    }
    
    // Resumo final
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!');
    console.log(`📊 Estatísticas:`);
    console.log(`  👥 Total de usuários: ${totalUsers}`);
    console.log(`  ✅ Sucessos: ${successCount}`);
    console.log(`  ❌ Erros: ${errorCount}`);
    console.log(`  💎 Total de XP distribuído: ${totalXp.toLocaleString()}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Erros encontrados:`);
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n🔧 Para verificar o resultado, execute:');
    console.log('   node test-xp-system.js');
    
  } catch (error) {
    console.error('💥 Erro fatal na migração:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Executar migração
main().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});