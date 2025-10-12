# Solução para Upload de Vídeos - Implementação Original

## Problema Identificado
- Erro 401 e 413 na função `packUploadVideo`
- Problemas de MIME type no Android
- Necessidade de reprocessamento automático de vídeos

## Solução: Voltar à Implementação Original

### 1. **Frontend - Upload Direto para R2**
A implementação original funcionava assim:

```javascript
// No PacksContextR2.jsx (versão original)
const uploadPackContentMedia = useCallback(async (file, packId) => {
  return await uploadFile(file, 'pack-content', packId);
}, [uploadFile]);

// No mediaService.js (versão original)
async uploadFile(file, type, itemId = null) {
  // 1. Gerar URL assinada
  const uploadData = await this.generateUploadUrl(type, file.type, file.name, itemId);
  
  // 2. Upload direto para R2
  const uploadResponse = await fetch(uploadData.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type, // MIME type correto
    },
  });
  
  return {
    key: uploadData.key,
    publicUrl: uploadData.publicUrl,
    size: file.size,
    type: file.type,
    name: file.name,
  };
}
```

### 2. **Backend - Função para Gerar URLs Assinadas**
Precisamos de uma função que gere URLs assinadas para upload direto:

```javascript
// generateUploadUrl.js
exports.generateUploadUrl = onRequest(async (req, res) => {
  // 1. Verificar autenticação
  // 2. Gerar URL assinada para R2
  // 3. Retornar URL para upload direto
});
```

### 3. **Reprocessamento Automático**
A função `packContentVideoReprocessor` já está criada e funcionará:

```javascript
// Trigger quando packContent é atualizado
exports.packContentVideoReprocessor = onDocumentUpdated({
  document: 'packContent/{packId}',
  // ... configurações
}, async (event) => {
  // 1. Detectar mudanças em vídeos
  // 2. Reprocessar vídeos automaticamente
  // 3. Atualizar packContent com status
});
```

## Implementação Recomendada

### Passo 1: Criar Função para URLs Assinadas
```javascript
// generateUploadUrl.js
const { onRequest } = require('firebase-functions/v2/https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

exports.generateUploadUrl = onRequest(async (req, res) => {
  // Implementar geração de URL assinada para R2
});
```

### Passo 2: Manter Implementação Original do Frontend
- Usar `mediaService.uploadFile()` como na versão original
- Upload direto para R2 com MIME type correto
- Sem passar por função intermediária

### Passo 3: Reprocessamento Automático
- A função `packContentVideoReprocessor` já está pronta
- Detecta mudanças em vídeos automaticamente
- Reprocessa vídeos em background

## Vantagens desta Abordagem

1. **✅ MIME Type Correto**: Detectado automaticamente pelo navegador
2. **✅ Sem Problemas de CORS**: Upload direto para R2
3. **✅ Mais Eficiente**: Não passa por Cloud Functions para upload
4. **✅ Compatível com Android**: MIME type correto evita problemas
5. **✅ Reprocessamento Automático**: Vídeos são processados em background
6. **✅ Baseado na Implementação Original**: Que já funcionava

## Próximos Passos

1. **Criar função `generateUploadUrl`** para URLs assinadas
2. **Manter implementação original** do frontend
3. **Deploy da função de reprocessamento** automático
4. **Testar upload direto** com MIME type correto

Esta solução combina o melhor dos dois mundos: a eficiência e compatibilidade da implementação original com o reprocessamento automático de vídeos.