# 🌐 Como Configurar CORS nas Firebase Functions para vixter.com.br

## 📋 Situação Atual

As Firebase Functions usam **Firebase Functions v2** com dois tipos:
- `onCall` - CORS automático (gerenciado pelo Firebase)
- `onRequest` - CORS manual (precisa configurar)

## ✅ Solução

### 1. Adicionar Domínio no Firebase Console (para `onCall`)

As funções `onCall` usam CORS automático, mas você precisa autorizar o domínio:

1. Acesse: https://console.firebase.google.com/project/vixter-451b3/settings/general
2. Vá em **"Autorized domains"** (Domínios autorizados)
3. Clique em **"Add domain"**
4. Adicione: `vixter.com.br`
5. Clique em **"Add"**

**Alternativa via CLI:**
```bash
# Adicionar domínio autorizado (não tem comando direto, use o Console)
```

### 2. Configurar CORS em Funções `onRequest`

Para funções que usam `onRequest`, você precisa configurar o CORS manualmente.

#### Função: `cronProcessVixtips`

Esta função já tem configuração adequada (é chamada por cron job interno), mas se precisar de CORS:

```javascript
export const cronProcessVixtips = onRequest({
  cors: ['https://vixter.com.br', 'https://vixter-react.vercel.app'],
}, async (req, res) => {
  // ... código existente
});
```

#### Função: `scheduledAutoCompleteServices`

Similar, se precisar de acesso externo:

```javascript
export const scheduledAutoCompleteServices = onRequest({
  memory: "256MiB",
  timeoutSeconds: 300,
  cors: ['https://vixter.com.br'],
}, async (request, response) => {
  // ... código existente
});
```

**⚠️ NOTA:** Essas funções são para uso interno (cron jobs), então normalmente não precisam de CORS público.

### 3. Funções `onCall` (maioria das funções)

Para funções como:
- `initializeWallet`
- `createStripeSession`
- `processVixtip`
- `claimDailyBonus`
- etc.

Essas **já funcionam automaticamente** com CORS assim que você adicionar `vixter.com.br` aos domínios autorizados no Firebase Console.

## 🔍 Como Verificar se Está Funcionando

Após adicionar o domínio no Firebase Console e fazer redeploy:

```bash
# Redeploy das functions
firebase deploy --only functions
```

Teste fazendo uma chamada do frontend:

```javascript
// No frontend (vixter.com.br)
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const initializeWallet = httpsCallable(functions, 'initializeWallet');

// Isso deve funcionar sem erro de CORS
const result = await initializeWallet();
```

## 📝 Checklist

- [ ] Adicionar `vixter.com.br` nos domínios autorizados do Firebase Console
- [ ] (Opcional) Configurar CORS explícito em funções `onRequest` se necessário
- [ ] Fazer redeploy: `firebase deploy --only functions`
- [ ] Testar chamadas do frontend em `vixter.com.br`

## ⚠️ Importante

- Funções `onCall` **NÃO precisam** de configuração de CORS no código
- Funções `onCall` **PRECISAM** do domínio autorizado no Firebase Console
- Funções `onRequest` **PRECISAM** de `cors: true` ou `cors: ['dominio']` na definição

## 🔗 Links Úteis

- Firebase Console: https://console.firebase.google.com/project/vixter-451b3
- Documentação CORS v2: https://firebase.google.com/docs/functions/http-events

