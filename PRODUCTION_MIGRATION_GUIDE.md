# 🚀 Guia de Migração: Sandbox → Produção

## ✅ **O que Funciona Automaticamente**

### Código
- ✅ **Cloud Functions**: Mesma lógica funciona
- ✅ **Interface**: Mesma experiência
- ✅ **Validações**: Mesmas regras de negócio
- ✅ **Taxas**: Mesma configuração (5%)

### Stripe Connect
- ✅ **Onboarding**: Mesmo fluxo
- ✅ **Transferências**: Mesma API
- ✅ **Webhooks**: Mesma estrutura

## 🔧 **O que Você PRECISA Configurar**

### 1. **Variáveis de Ambiente (Firebase Functions)**

#### Sandbox (atual):
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Produção (novo):
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Como alterar:
```bash
# 1. Acesse o Firebase Console
# 2. Vá em Functions > Configurações
# 3. Adicione as novas variáveis
# 4. Ou use CLI:
firebase functions:config:set stripe.secret_key="sk_live_..."
```

### 2. **Stripe Dashboard - Produção**

#### Ativar Connect:
1. **Acesse**: https://dashboard.stripe.com/connect (conta de produção)
2. **Ative Connect** se não estiver ativo
3. **Configure URLs**:
   - Return URL: `https://seu-dominio-real.com/settings?stripe=success`
   - Refresh URL: `https://seu-dominio-real.com/settings?stripe=refresh`

#### Verificar Configurações:
- ✅ **Charges habilitado**
- ✅ **Payouts habilitado**
- ✅ **País configurado** (Brasil)
- ✅ **Moeda configurada** (BRL)

### 3. **Domínio e URLs**

#### Atualizar URLs no código:
```javascript
// Em Settings.jsx - linha ~193
const returnUrl = `${window.location.origin}/settings?stripe=success`;
const refreshUrl = `${window.location.origin}/settings?stripe=refresh`;
```

#### Verificar CORS:
- ✅ **Stripe**: URLs de retorno configuradas
- ✅ **Firebase**: Domínio autorizado
- ✅ **Vercel/Netlify**: Domínio configurado

### 4. **Testes de Produção**

#### Teste com Valores Pequenos:
1. **Configure conta Stripe** de produção
2. **Teste saque** com 50 VC (valor mínimo)
3. **Verifique transferência** no Stripe
4. **Confirme recebimento** na conta do provider

#### Dados de Teste (Produção):
- **Use dados reais** (não de teste)
- **Valores pequenos** primeiro
- **Monitor logs** do Firebase

## 🔍 **Verificação de Ambiente**

### Função de Debug:
```javascript
// Chame esta função para verificar ambiente
const checkConfig = httpsCallable(functions, 'checkStripeConnectConfig');
const result = await checkConfig();
console.log(result.data.environment);
```

### O que verificar:
- ✅ **isProduction**: true
- ✅ **stripeKeyPrefix**: "live"
- ✅ **hasConnect**: true
- ✅ **chargesEnabled**: true
- ✅ **payoutsEnabled**: true

## ⚠️ **Cuidados Importantes**

### 1. **Dados Reais**
- **Sandbox**: Dados de teste
- **Produção**: Dados reais de clientes

### 2. **Valores Monetários**
- **Sandbox**: Sem impacto financeiro
- **Produção**: Dinheiro real

### 3. **Compliance**
- **LGPD**: Dados pessoais
- **Bacen**: Regulamentações financeiras
- **Stripe**: Termos de uso

### 4. **Monitoramento**
- **Logs**: Firebase Functions
- **Erros**: Stripe Dashboard
- **Transações**: Firestore

## 📋 **Checklist de Migração**

### Antes da Migração:
- [ ] **Teste completo** no sandbox
- [ ] **Documentação** atualizada
- [ ] **Backup** dos dados
- [ ] **Plano de rollback**

### Durante a Migração:
- [ ] **Alterar variáveis** de ambiente
- [ ] **Configurar URLs** no Stripe
- [ ] **Deploy** das functions
- [ ] **Teste** com valores pequenos

### Após a Migração:
- [ ] **Monitorar** logs e erros
- [ ] **Verificar** transferências
- [ ] **Testar** fluxo completo
- [ ] **Documentar** problemas

## 🆘 **Problemas Comuns**

### Erro: "Invalid API key"
- **Causa**: Chave de sandbox em produção
- **Solução**: Usar chave `sk_live_...`

### Erro: "Connect not enabled"
- **Causa**: Connect não ativado na produção
- **Solução**: Ativar no dashboard Stripe

### Erro: "Invalid return URL"
- **Causa**: URL não configurada no Stripe
- **Solução**: Configurar URL real no dashboard

### Erro: "Account not ready"
- **Causa**: Onboarding incompleto
- **Solução**: Completar no Stripe

## 📞 **Suporte**

- **Stripe Support**: https://support.stripe.com
- **Firebase Support**: https://firebase.google.com/support
- **Documentação**: Este guia + código comentado

## 🎯 **Resumo**

**Sim, é basicamente trocar as variáveis!** Mas configure:
1. ✅ **Variáveis** de ambiente
2. ✅ **URLs** no Stripe
3. ✅ **Teste** com valores pequenos
4. ✅ **Monitore** logs e erros

**Tempo estimado**: 30-60 minutos
**Complexidade**: Baixa
**Risco**: Baixo (com testes)
