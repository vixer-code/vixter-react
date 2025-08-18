# 🏦 Guia Completo de Integração - Sistema de Carteira Vixter

## 📋 Visão Geral

Este guia detalha a implementação completa do sistema de carteira digital do Vixter, incluindo:
- **VP (Vixter Points)**: Para compra de serviços
- **VC (Vixter Credits)**: Ganhos que podem ser sacados (1 VC = R$ 1,00)
- **VBP (Vixter Bonus Points)**: Moedas de bônus da plataforma
- **VC Pending**: VC em escrow até confirmação de serviços

## 🎯 Arquitetura do Sistema

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │────│  Firebase Auth   │────│  Cloud Functions│
│   (Frontend)    │    │                  │    │   (Backend)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                ┌───────────────────────────────┐
                │         Firestore             │
                │  ┌─────────┬─────────────────┐│
                │  │ wallets │   transactions  ││
                │  └─────────┴─────────────────┘│
                └───────────────────────────────┘
                                │
                ┌───────────────────────────────┐
                │          Stripe               │
                │    (Processamento de          │
                │      Pagamentos)              │
                └───────────────────────────────┘
```

## 🚀 Passo 1: Configuração do Ambiente

### 1.1 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_seu_stripe_publishable_key_aqui

# Firebase Configuration (opcional - se não usar config padrão)
VITE_FIREBASE_API_KEY=sua_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id

# Frontend URL para redirects do Stripe
VITE_FRONTEND_URL=https://seu-dominio.com
```

### 1.2 Configuração do Firebase Functions

No arquivo `functions/.env`:

```bash
# Stripe Secret Key
STRIPE_SECRET_KEY=sk_live_seu_stripe_secret_key_aqui

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_seu_webhook_secret_aqui

# Frontend URL
FRONTEND_URL=https://seu-dominio.com
```

## 🔧 Passo 2: Deploy das Cloud Functions

```bash
# Navegar para o diretório functions
cd functions

# Instalar dependências
npm install

# Deploy das funções
firebase deploy --only functions
```

### Functions Disponíveis:
- `initializeWallet` - Inicializa carteira do usuário
- `createStripeSession` - Cria sessão de pagamento Stripe
- `stripeWebhook` - Processa webhooks do Stripe
- `processPackSale` - Processa venda de packs (VC imediato)
- `processServicePurchase` - Processa compra de serviços (VC pendente)
- `confirmServiceDelivery` - Confirma entrega e libera VC
- `rejectServiceOrder` - Rejeita pedido e reembolsa VP
- `claimDailyBonus` - Concede bônus diário VBP
- `autoReleaseServices` - Liberação automática após 24h

## 🛡️ Passo 3: Configuração de Segurança

### 3.1 Deploy das Regras Firestore

```bash
# Deploy das regras de segurança
firebase deploy --only firestore:rules
```

### 3.2 Deploy das Regras Storage

```bash
# Deploy das regras de storage
firebase deploy --only storage
```

### 3.3 Configuração do Stripe Webhook

1. **Acesse o Dashboard do Stripe**
2. **Vá em "Developers" → "Webhooks"**
3. **Clique "Add endpoint"**
4. **Configure:**
   - **URL**: `https://us-central1-SEU_PROJECT.cloudfunctions.net/stripeWebhook`
   - **Events**: Selecione:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.payment_failed`

## 💳 Passo 4: Configuração dos Pacotes VP

Os pacotes já estão configurados nas Cloud Functions. Para modificar:

```javascript
// Em wallet-functions.js, linha ~86
const packages = {
  'pack-20': { amount: 2000, vpAmount: 30, vbpBonus: 0, name: 'Pacote Iniciante' },
  'pack-45': { amount: 4500, vpAmount: 66, vbpBonus: 0, name: 'Pacote Essencial' },
  // ... adicione mais pacotes conforme necessário
};
```

## 🎨 Passo 5: Integração Frontend

### 5.1 Uso do WalletContext

```jsx
import { useWallet } from '../contexts/WalletContext';

function MeuComponente() {
  const {
    vpBalance,
    vcBalance,
    vbpBalance,
    vcPendingBalance,
    buyVP,
    claimDaily,
    processPackSale,
    processServicePurchase
  } = useWallet();

  const handleBuyVP = async () => {
    const success = await buyVP('pack-85'); // Pacote Prata
    if (success) {
      console.log('Redirecionando para Stripe...');
    }
  };

  return (
    <div>
      <p>VP: {vpBalance}</p>
      <p>VC: {vcBalance}</p>
      <p>VBP: {vbpBalance}</p>
      <p>VC Pendente: {vcPendingBalance}</p>
      <button onClick={handleBuyVP}>Comprar VP</button>
    </div>
  );
}
```

### 5.2 Processamento de Vendas

```jsx
// Para venda de pack (VC imediato)
const handlePackSale = async (buyerId, packId, packName, vpAmount) => {
  const result = await processPackSale(buyerId, packId, packName, vpAmount);
  if (result) {
    console.log(`Pack vendido! ${result.vcCredited} VC creditados.`);
  }
};

// Para venda de serviço (VC pendente)
const handleServiceSale = async (sellerId, serviceId, serviceName, serviceDescription, vpAmount) => {
  const result = await processServicePurchase(sellerId, serviceId, serviceName, serviceDescription, vpAmount);
  if (result.success) {
    console.log(`Serviço adquirido! Order ID: ${result.serviceOrderId}`);
  }
};
```

## 🔄 Passo 6: Fluxo de Transações

### 6.1 Conversão VP → VC

```
Regra: 1 VC = 1.5 VP
Fórmula: vcAmount = Math.floor(vpAmount / 1.5)

Exemplos:
- 150 VP → 100 VC
- 120 VP → 80 VC
- 100 VP → 66 VC (arredondado para baixo)
```

### 6.2 Fluxo de Serviços

```
1. PENDING_ACCEPTANCE → Comprador faz pedido (VP debitado, VC vai para pending)
2. ACCEPTED → Vendedor aceita o pedido
3. DELIVERED → Vendedor marca como entregue
4. CONFIRMED → Comprador confirma (VC pendente → VC real)
5. AUTO_RELEASED → Liberação automática após 24h
```

## 🎯 Passo 7: Testando o Sistema

### 7.1 Teste de Compra VP

1. Acesse `/wallet`
2. Clique "Comprar VP"
3. Selecione um pacote
4. Complete o pagamento no Stripe
5. Verifique se VP foi creditado

### 7.2 Teste de Venda Pack

```javascript
// Simular venda de pack
const testPackSale = async () => {
  await processPackSale(
    'buyer_user_id',
    'pack_test_123',
    'Pack de Teste',
    150 // 150 VP = 100 VC
  );
};
```

### 7.3 Teste de Serviço

```javascript
// Simular compra de serviço
const testServicePurchase = async () => {
  const result = await processServicePurchase(
    'seller_user_id',
    'service_test_123',
    'Serviço de Teste',
    'Descrição do serviço',
    150 // 150 VP
  );
  
  // Para confirmar depois:
  await confirmServiceDelivery(result.serviceOrderId, 'Ótimo trabalho!');
};
```

## 📊 Passo 8: Monitoramento e Logs

### 8.1 Verificar Logs das Functions

```bash
# Ver logs em tempo real
firebase functions:log

# Ver logs específicos
firebase functions:log --only stripeWebhook
```

### 8.2 Verificar Transações no Firestore

```javascript
// Console do Firebase → Firestore → Collections
- wallets/{userId} → Saldos dos usuários
- transactions/ → Histórico de transações
- stripePayments/ → Pagamentos Stripe
- serviceOrders/ → Pedidos de serviços
```

## 🚨 Passo 9: Pontos de Rollback e Recuperação

### 9.1 Webhook Duplicado
- Sistema usa `webhookProcessed` collection para prevenir duplicação
- Cada evento tem chave de idempotência: `${event.id}_${event.type}`

### 9.2 Falha em Transação
- Todas as operações usam Firestore transactions
- Em caso de falha, nenhuma alteração é persistida
- Logs detalhados para debugging

### 9.3 Pagamento Stripe Falhou
- Webhook marca pagamento como `failed`
- Nenhum VP é creditado
- Usuário pode tentar novamente

### 9.4 Serviço Não Entregue
- VC fica em `pending` por 24h
- Após 24h, liberação automática via `autoReleaseServices`
- Comprador pode rejeitar pedido antes da entrega

## 🔧 Passo 10: Manutenção e Atualizações

### 10.1 Adicionar Novo Pacote VP

1. **Atualize `wallet-functions.js`:**

```javascript
const packages = {
  // ... pacotes existentes
  'pack-NEW': { 
    amount: 5000,      // R$ 50,00 em centavos
    vpAmount: 75,      // VP a ser creditado
    vbpBonus: 15,      // VBP de bônus
    name: 'Novo Pacote' 
  }
};
```

2. **Atualize `WalletContext.jsx`:**

```javascript
const VP_PACKAGES = {
  // ... pacotes existentes
  'pack-NEW': { 
    amount: 75, 
    bonus: 15, 
    price: 'R$ 50,00', 
    name: 'Novo Pacote', 
    priceInCents: 5000 
  }
};
```

3. **Atualize o componente `Wallet.jsx`** na lista de pacotes

### 10.2 Modificar Taxa de Conversão

**⚠️ ATENÇÃO**: Modificar a taxa afeta todas as transações futuras

```javascript
// Em todas as functions que fazem conversão, altere:
const vcAmount = Math.floor(vpAmount / 1.5); // Taxa atual: 1 VC = 1.5 VP

// Para nova taxa (ex: 1 VC = 2 VP):
const vcAmount = Math.floor(vpAmount / 2.0);
```

## 📱 Passo 11: Integração Mobile (Futuro)

O sistema já está preparado para integração mobile:

```typescript
// React Native / Expo
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const buyVP = httpsCallable(functions, 'createStripeSession');

// Uso idêntico ao web
const result = await buyVP({ packageId: 'pack-85' });
```

## 🎉 Conclusão

Seu sistema de carteira está completo e pronto para produção! Principais características:

✅ **Segurança Total**: Regras Firestore impedem manipulação client-side
✅ **Transações Atômicas**: Firestore transactions garantem consistência
✅ **Idempotência**: Webhooks Stripe não processam eventos duplicados
✅ **Auditoria Completa**: Toda transação gera logs detalhados
✅ **Auto-Recovery**: Sistema de liberação automática e reembolsos
✅ **Escalabilidade**: Cloud Functions auto-escalam conforme demanda

## 🆘 Suporte e Troubleshooting

### Problemas Comuns:

1. **VP não creditado após pagamento**
   - Verificar logs do webhook: `firebase functions:log --only stripeWebhook`
   - Verificar se STRIPE_WEBHOOK_SECRET está configurado
   - Verificar endpoint webhook no Stripe Dashboard

2. **Erro de permissão Firestore**
   - Verificar se regras foram deployadas: `firebase deploy --only firestore:rules`
   - Verificar se usuário está autenticado

3. **Função não encontrada**
   - Verificar deploy: `firebase deploy --only functions`
   - Verificar região nas functions (southamerica-east1)

### Contatos de Suporte:
- **Documentação**: Este arquivo
- **Logs**: Firebase Console → Functions → Logs
- **Monitoramento**: Firebase Console → Performance

---

**🎯 Sistema implementado com sucesso! Sua plataforma agora possui um sistema de carteira completo, seguro e escalável.**
