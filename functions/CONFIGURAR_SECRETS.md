# 🔐 Como Configurar Secrets nas Firebase Functions

## ⚠️ Importante
O código usa **Firebase Functions v2** com `defineSecret`, que funciona diferente do método antigo.

## 📋 Como Funciona

No código (`functions/wallet-functions.js`):
```javascript
import { defineSecret } from 'firebase-functions/params';

const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
```

A função busca o secret pelo **nome exato** que você passar para `defineSecret()`.

## ✅ Como Configurar (Método Correto)

### Opção 1: Via Firebase CLI (Recomendado)

```bash
# 1. Navegue até a pasta do projeto
cd /home/enzo/Documentos/git/zpessoal/vixter-react

# 2. Configure cada secret individualmente
# ⚠️ IMPORTANTE: Use APENAS o nome, sem passar o valor no comando!
firebase functions:secrets:set STRIPE_SECRET_KEY

# O Firebase vai perguntar:
# "Enter a value for STRIPE_SECRET_KEY"
# → Aí você cola: sk_live_51RHQQB... (chave completa do Stripe)

# 3. Configure o webhook secret (mesma coisa)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# → Quando pedir o valor, cole: whsec_... (webhook secret)

# 4. (Opcional) Configure FRONTEND_URL como variável de ambiente normal
# Para variáveis normais (não secrets), use:
firebase functions:config:set frontend.url="https://vixter.com.br"
```

**⚠️ ERRO COMUM:** Não faça isso:
```bash
# ❌ ERRADO - Não passe o valor no comando!
firebase functions:secrets:set STRIPE_SECRET_KEY=sk_live_...
```

**✅ CORRETO:**
```bash
# ✅ CORRETO - Apenas o nome
firebase functions:secrets:set STRIPE_SECRET_KEY
# Depois cola o valor quando o Firebase pedir
```

**Nota:** Quando você rodar `firebase functions:secrets:set STRIPE_SECRET_KEY`, o Firebase vai:
1. Pedir para você colar o valor do secret interativamente
2. Perguntar se você quer dar acesso a todas as functions ou específicas
3. Criar o secret no Secret Manager do Google Cloud

### Opção 2: Via Google Cloud Console

1. Acesse: https://console.cloud.google.com/security/secret-manager
2. Clique em "CREATE SECRET"
3. Nome do secret: `STRIPE_SECRET_KEY` (exatamente esse nome)
4. Valor: Cole sua chave do Stripe (`sk_live_...`)
5. Repita para `STRIPE_WEBHOOK_SECRET`

Depois, você precisa dar permissão às functions para acessar esses secrets.

## 🔄 Após Configurar

```bash
# Redeploy das functions para usar os novos secrets
firebase deploy --only functions
```

## 📝 Verificar Secrets Configurados

```bash
# Listar todos os secrets
firebase functions:secrets:access

# Ou via Google Cloud CLI
gcloud secrets list
```

## ⚠️ Erro Comum: "2-part key"

Se você está vendo esse erro, provavelmente está tentando usar o método antigo:

**❌ ERRADO (método antigo v1):**
```bash
firebase functions:config:set stripe.secret_key="sk_live_..."
```

**✅ CORRETO (método novo v2):**
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

## 🎯 Resumo dos Secrets Necessários

1. **STRIPE_SECRET_KEY** - Chave secreta do Stripe (`sk_live_...` para produção)
2. **STRIPE_WEBHOOK_SECRET** - Secret do webhook do Stripe (`whsec_...`)

## 🔍 Como o Código Acessa

```javascript
// No código, a função acessa assim:
const stripe = new Stripe(STRIPE_SECRET.value(), {
  apiVersion: '2024-06-20',
});
```

O `.value()` retorna o valor do secret configurado.

## 💡 Dica

Se você já tem secrets configurados mas não funcionam:
1. Verifique o nome exato: `STRIPE_SECRET_KEY` (case-sensitive)
2. Verifique se as functions têm permissão para acessar o secret
3. Faça redeploy: `firebase deploy --only functions`

