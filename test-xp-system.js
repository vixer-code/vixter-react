#!/usr/bin/env node

/**
 * Script para testar o sistema de XP e elo
 * Execute com: node test-xp-system.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin (ajuste o caminho do service account conforme necessário)
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
 * Testa o cálculo de XP
 */
function testXpCalculation() {
  console.log('🧪 Testando cálculo de XP...');
  
  // Fórmula: (x*0.67)*2y = z
  // x = vpAmount, y = productMultiplier
  
  const testCases = [
    { type: 'PACK_PURCHASE', vpAmount: 100, productType: 1.5, expectedMin: 200 },
    { type: 'SERVICE_PURCHASE', vpAmount: 100, productType: 2, expectedMin: 268 },
    { type: 'VIXTIP_SENT', vpAmount: 50, productType: 1, expectedMin: 67 },
    { type: 'PACK_SALE', vpAmount: 150, productType: 1.5, expectedMin: 301 },
    { type: 'SERVICE_SALE', vpAmount: 200, productType: 2, expectedMin: 536 }
  ];
  
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
  
  let allPassed = true;
  
  for (const testCase of testCases) {
    const xp = calculateXpFromTransaction(testCase.type, testCase.vpAmount, testCase.productType);
    const passed = xp >= testCase.expectedMin;
    allPassed = allPassed && passed;
    
    console.log(`  ${testCase.type}: ${xp} XP (esperado: >=${testCase.expectedMin}) - ${passed ? '✅' : '❌'}`);
  }
  
  console.log(`\n📊 Resultado do teste de cálculo: ${allPassed ? '✅ TODOS PASSARAM' : '❌ ALGUNS FALHARAM'}\n`);
  
  return allPassed;
}

/**
 * Verifica transações de XP existentes
 */
async function checkExistingXpTransactions() {
  console.log('🔍 Verificando transações de XP existentes...');
  
  try {
    const xpTransactionsSnapshot = await db.collection('xpTransactions').limit(10).get();
    
    if (xpTransactionsSnapshot.empty) {
      console.log('  ℹ️ Nenhuma transação de XP encontrada');
      return 0;
    }
    
    console.log(`  📊 Encontradas ${xpTransactionsSnapshot.size} transações de XP:`);
    
    xpTransactionsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`    ${index + 1}. ${data.transactionType}: ${data.xpAmount} XP para usuário ${data.userId}`);
    });
    
    return xpTransactionsSnapshot.size;
  } catch (error) {
    console.error('  ❌ Erro ao verificar transações de XP:', error.message);
    return 0;
  }
}

/**
 * Verifica usuários com XP
 */
async function checkUsersWithXp() {
  console.log('👥 Verificando usuários com XP...');
  
  try {
    const usersSnapshot = await db.collection('users')
      .where('stats.xp', '>', 0)
      .limit(10)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('  ℹ️ Nenhum usuário com XP encontrado');
      return 0;
    }
    
    console.log(`  📊 Encontrados ${usersSnapshot.size} usuários com XP:`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const xp = data.stats?.xp || 0;
      const elo = data.elo?.current || 'ferro';
      console.log(`    ${index + 1}. ${doc.id}: ${xp} XP, Elo: ${elo}`);
    });
    
    return usersSnapshot.size;
  } catch (error) {
    console.error('  ❌ Erro ao verificar usuários com XP:', error.message);
    return 0;
  }
}

/**
 * Verifica transações de compra/venda recentes
 */
async function checkRecentTransactions() {
  console.log('💳 Verificando transações recentes...');
  
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const transactionsSnapshot = await db.collection('transactions')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(oneDayAgo))
      .where('type', 'in', ['PACK_PURCHASE', 'PACK_SALE', 'SERVICE_PURCHASE', 'SERVICE_SALE', 'VIXTIP_SENT', 'VIXTIP_RECEIVED'])
      .limit(10)
      .get();
    
    if (transactionsSnapshot.empty) {
      console.log('  ℹ️ Nenhuma transação recente encontrada');
      return 0;
    }
    
    console.log(`  📊 Encontradas ${transactionsSnapshot.size} transações recentes:`);
    
    transactionsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const amounts = data.amounts || {};
      const vpAmount = amounts.vp || 0;
      const vcAmount = amounts.vc || 0;
      console.log(`    ${index + 1}. ${data.type}: ${vpAmount} VP / ${vcAmount} VC`);
    });
    
    return transactionsSnapshot.size;
  } catch (error) {
    console.error('  ❌ Erro ao verificar transações recentes:', error.message);
    return 0;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando teste do sistema de XP e elo...\n');
  
  // Teste 1: Cálculo de XP
  const calculationTestPassed = testXpCalculation();
  
  // Teste 2: Verificar transações de XP existentes
  const xpTransactionsCount = await checkExistingXpTransactions();
  console.log('');
  
  // Teste 3: Verificar usuários com XP
  const usersWithXpCount = await checkUsersWithXp();
  console.log('');
  
  // Teste 4: Verificar transações recentes
  const recentTransactionsCount = await checkRecentTransactions();
  console.log('');
  
  // Resumo
  console.log('📋 RESUMO DOS TESTES:');
  console.log(`  ✅ Cálculo de XP: ${calculationTestPassed ? 'PASSOU' : 'FALHOU'}`);
  console.log(`  📊 Transações de XP: ${xpTransactionsCount}`);
  console.log(`  👥 Usuários com XP: ${usersWithXpCount}`);
  console.log(`  💳 Transações recentes: ${recentTransactionsCount}`);
  
  if (calculationTestPassed && xpTransactionsCount > 0 && usersWithXpCount > 0) {
    console.log('\n🎉 Sistema de XP está funcionando corretamente!');
  } else if (calculationTestPassed && recentTransactionsCount > 0) {
    console.log('\n⚠️ Sistema de XP está configurado, mas pode precisar de sincronização para usuários existentes.');
    console.log('💡 Execute a função syncAllUsersXpAndElo para sincronizar usuários existentes.');
  } else {
    console.log('\n❌ Sistema de XP pode ter problemas. Verifique os logs das funções.');
  }
  
  console.log('\n🔧 Para sincronizar usuários existentes, execute:');
  console.log('   firebase functions:call syncAllUsersXpAndElo');
  
  console.log('\n🧪 Para testar o sistema, execute:');
  console.log('   firebase functions:call testXpSystem');
  
  process.exit(0);
}

// Executar teste
main().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});