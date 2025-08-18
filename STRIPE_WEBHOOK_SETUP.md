# 🔗 Configuração do Webhook Stripe - Vixter

## 📋 **Informações do Seu Webhook**

**URL do Webhook:** `https://us-east1-vixter-451b3.cloudfunctions.net/stripeWebhook`

## 🚀 **Passo a Passo para Configurar**

### **1. Acessar o Dashboard do Stripe**
1. Faça login em [dashboard.stripe.com](https://dashboard.stripe.com)
2. Vá em **"Developers"** → **"Webhooks"**
3. Clique em **"Add endpoint"**

### **2. Configurar o Endpoint**

**📝 Configurações Obrigatórias:**

| Campo | Valor |
|-------|--------|
| **Endpoint URL** | `https://us-east1-vixter-451b3.cloudfunctions.net/stripeWebhook` |
| **Description** | `Vixter Wallet System Webhook` |
| **Events to send** | Selecionar específicos (ver abaixo) |

### **3. Eventos para Selecionar**

✅ **Marque APENAS estes eventos:**

- `checkout.session.completed` - Pagamento concluído com sucesso
- `checkout.session.expired` - Sessão expirou sem pagamento
- `payment_intent.payment_failed` - Falha no pagamento

⚠️ **NÃO selecione outros eventos** para evitar processamento desnecessário.

### **4. Finalizar Configuração**
1. Clique em **"Add endpoint"**
2. Na tela seguinte, você verá o **"Signing secret"**
3. **COPIE este secret** (começa com `whsec_...`)

### **5. Configurar o Secret no Firebase**

**Opção A: Via Firebase CLI (Recomendado)**
```bash
# Configure o secret do webhook
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Cole o valor copiado do Stripe (whsec_...)

# Configure também sua secret key se ainda não fez
firebase functions:secrets:set STRIPE_SECRET_KEY
# Cole sua secret key do Stripe (sk_live_... ou sk_test_...)
```

**Opção B: Via Console Firebase**
1. Vá em [console.firebase.google.com](https://console.firebase.google.com)
2. Selecione seu projeto `vixter-451b3`
3. **Functions** → **Secrets**
4. Adicione:
   - `STRIPE_WEBHOOK_SECRET` = valor copiado do Stripe
   - `STRIPE_SECRET_KEY` = sua secret key do Stripe

### **6. Redesploy das Functions**
```bash
# Redeploy para aplicar os secrets
firebase deploy --only functions

# Ou apenas a função específica
firebase deploy --only functions:stripeWebhook
```

## 🧪 **Testar o Webhook**

### **Teste Manual no Stripe**
1. No dashboard Stripe → **Webhooks**
2. Clique no webhook criado
3. Vá na aba **"Testing"**
4. Clique **"Send test webhook"**
5. Selecione `checkout.session.completed`
6. Clique **"Send test webhook"**

**✅ Status esperado:** `200 OK`

### **Verificar Logs**
```bash
# Ver logs em tempo real
firebase functions:log --only stripeWebhook

# Deve aparecer algo como:
# ✅ Webhook processado com sucesso
# 💰 Processando pagamento bem-sucedido
```

## 🔍 **Verificar se Está Funcionando**

### **1. Teste de Compra Real**
1. Acesse `/wallet` no seu app
2. Tente comprar um pacote VP
3. Complete o pagamento no Stripe
4. Verifique se VP foi creditado

### **2. Verificar no Firestore**
- **Collection `stripePayments`** deve ter o registro
- **Collection `transactions`** deve ter a transação
- **Collection `wallets/{userId}`** deve ter VP atualizado

### **3. Logs Esperados**
```
✅ Sessão Stripe criada: cs_xxxxx para usuário xxxxx
💰 Processando pagamento bem-sucedido: cs_xxxxx
✅ VP creditado: 120 VP + 22 VBP para usuário xxxxx
```

## 🚨 **Troubleshooting**

### **Erro 401 - Unauthorized**
```
💥 Webhook signature verification failed
```
**Solução:** Verificar se `STRIPE_WEBHOOK_SECRET` está correto

### **Erro 500 - Internal Server Error**
```
💥 STRIPE_WEBHOOK_SECRET not configured
```
**Solução:** Configurar secret e redesploy

### **Erro 400 - Bad Request**
```
Webhook Error: Invalid signature
```
**Solução:** Verificar se URL do webhook está exatamente igual

### **VP Não Creditado**
**Verificações:**
1. ✅ Evento `checkout.session.completed` está selecionado?
2. ✅ Secret está configurado corretamente?
3. ✅ Logs mostram processamento bem-sucedido?
4. ✅ Firestore tem as permissões corretas?

## 📊 **Monitoramento**

### **Stripe Dashboard**
- **Webhooks** → Seu webhook → **Logs**
- Deve mostrar `200 OK` para eventos enviados

### **Firebase Console**
- **Functions** → **Logs**
- Buscar por `stripeWebhook` para ver atividade

### **Firestore**
- **Collections** verificadas automaticamente
- Transações aparecem em tempo real

## 🔐 **Segurança**

### **✅ Já Implementado**
- Verificação de assinatura obrigatória
- Idempotência para evitar duplicação
- Logs detalhados para auditoria
- Validação de eventos específicos

### **🔒 Recomendações**
- Use sempre `sk_live_` em produção
- Monitore logs regularmente
- Configure alertas para falhas
- Teste webhook após mudanças

## 🎯 **Próximos Passos**

### **Após Configurar:**
1. ✅ Testar compra de VP
2. ✅ Verificar creditação automática
3. ✅ Monitorar logs por alguns dias
4. ✅ Configurar alertas de falha

### **Para Produção:**
1. ✅ Usar chaves `sk_live_` e `pk_live_`
2. ✅ Webhook em produção no Stripe
3. ✅ Monitoramento ativo
4. ✅ Backup dos secrets

---

## 📞 **Suporte Específico**

**Webhook URL:** `https://us-east1-vixter-451b3.cloudfunctions.net/stripeWebhook`
**Região:** `us-east1`
**Projeto:** `vixter-451b3`

**Comandos úteis:**
```bash
# Ver status das functions
firebase functions:list

# Ver logs específicos
firebase functions:log --only stripeWebhook --num 50

# Redesploy apenas webhook
firebase deploy --only functions:stripeWebhook
```

🎉 **Após seguir este guia, seu webhook estará 100% funcional!**
