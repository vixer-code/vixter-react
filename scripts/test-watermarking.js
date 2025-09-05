#!/usr/bin/env node

/**
 * Script para testar o watermarking do Firebase Functions
 * Uso: node scripts/test-watermarking.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'vixter-production.appspot.com'
  });
}

const db = admin.firestore();
const storage = admin.storage();

async function testWatermarking() {
  try {
    console.log('🧪 Testando watermarking...');
    
    // Buscar serviços sem coverImageURL ou com status de processamento
    const servicesSnapshot = await db.collection('services')
      .where('mediaProcessing.status', '==', 'processing')
      .limit(5)
      .get();
    
    console.log(`📊 Encontrados ${servicesSnapshot.size} serviços em processamento`);
    
    for (const doc of servicesSnapshot.docs) {
      const service = { id: doc.id, ...doc.data() };
      console.log(`\n🔍 Serviço: ${service.title} (${service.id})`);
      console.log(`📷 Cover Image URL: ${service.coverImageURL}`);
      console.log(`⚙️ Media Processing:`, service.mediaProcessing);
      
      // Verificar se há arquivos no storage
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `servicesMedia/${service.userId}/${service.id}/`,
        maxResults: 10
      });
      
      console.log(`📁 Arquivos encontrados: ${files.length}`);
      files.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata?.contentType})`);
      });
      
      // Verificar se há arquivos watermarked
      const watermarkedFiles = files.filter(file => 
        file.name.includes('wm_') || file.metadata?.watermarked === 'true'
      );
      
      console.log(`🎨 Arquivos watermarked: ${watermarkedFiles.length}`);
      watermarkedFiles.forEach(file => {
        console.log(`  - ${file.name}`);
      });
    }
    
    // Buscar serviços com erro de processamento
    const errorServicesSnapshot = await db.collection('services')
      .where('mediaProcessing.status', '==', 'error')
      .limit(5)
      .get();
    
    console.log(`\n❌ Encontrados ${errorServicesSnapshot.size} serviços com erro`);
    
    for (const doc of errorServicesSnapshot.docs) {
      const service = { id: doc.id, ...doc.data() };
      console.log(`\n🔍 Serviço com erro: ${service.title} (${service.id})`);
      console.log(`❌ Erro: ${service.mediaProcessing?.error}`);
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testWatermarking().then(() => {
    console.log('✅ Teste concluído');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erro no teste:', error);
    process.exit(1);
  });
}

module.exports = { testWatermarking };
