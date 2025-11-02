# 🚀 Checklist de Deploy para Produção - vixter.com.br

## ✅ **Tarefas Obrigatórias**

### 1. **Configurar Domínio na Vercel** ⚠️ MANUAL
   - [ ] Acessar Vercel Dashboard
   - [ ] Ir em Settings > Domains
   - [ ] Adicionar domínio `vixter.com.br`
   - [ ] Configurar DNS conforme instruções da Vercel
   - [ ] Aguardar propagação DNS (pode levar algumas horas)

### 2. **Variáveis de Ambiente do Stripe** 🔑

#### Frontend (Vercel)
   - [ ] Adicionar no Vercel Dashboard: `VITE_STRIPE_PUBLISHABLE_KEY`
   - [ ] Valor: `pk_live_...` (chave de produção do Stripe)
   - [ ] Configurar para Production, Preview e Development

#### Backend - Firebase Functions (Secrets)
   **IMPORTANTE:** O código usa Firebase Functions v2 com `defineSecret`, não o método antigo!
   
   Via CLI (Recomendado):
   ```bash
   cd /home/enzo/Documentos/git/zpessoal/vixter-react
   
   # Configurar cada secret (o Firebase vai pedir para colar o valor)
   firebase functions:secrets:set STRIPE_SECRET_KEY
   # Cole: sk_live_... (chave de produção)
   
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Cole: whsec_... (webhook secret de produção)
   
   # Após configurar, fazer redeploy
   firebase deploy --only functions
   ```
   
   **NOTA:** O nome deve ser exatamente `STRIPE_SECRET_KEY` (sem "2-part key" tipo `stripe.secret_key`)
   
   Ver documentação completa: `functions/CONFIGURAR_SECRETS.md`

#### Como obter as chaves:
   1. Acessar https://dashboard.stripe.com/apikeys (modo LIVE)
   2. Copiar "Publishable key" → `VITE_STRIPE_PUBLISHABLE_KEY`
   3. Copiar "Secret key" → `STRIPE_SECRET_KEY`
   4. Para webhook: https://dashboard.stripe.com/webhooks → copiar "Signing secret"

### 3. **URLs Atualizadas no Código** ✅ FEITO
   - [x] Arquivos principais atualizados para usar `vixter.com.br`
   - [x] Fallbacks mantidos para compatibilidade
   - [x] Variáveis de ambiente configuradas

### 4. **Configurar Stripe Connect** ⚠️ MANUAL
   - [ ] Acessar https://dashboard.stripe.com/connect (modo LIVE)
   - [ ] Configurar URLs de retorno:
     - **Return URL**: `https://vixter.com.br/settings?stripe=success`
     - **Refresh URL**: `https://vixter.com.br/settings?stripe=refresh`
   - [ ] Verificar se Connect está ativado para produção
   - [ ] Verificar país (Brasil) e moeda (BRL)

### 5. **Configurar Firebase Auth** ⚠️ MANUAL
   - [ ] Acessar Firebase Console > Authentication > Settings > Authorized domains
   - [ ] Adicionar `vixter.com.br`
   - [ ] Verificar se está na lista de domínios autorizados
   - [ ] Atualizar Email Templates com nova URL:
     - Action URL: `https://vixter.com.br/auth-action`

### 6. **Configurar CORS no Backend** ✅ FEITO
   - [x] Backend já está configurado para aceitar `vixter.com.br`
   - [ ] Verificar se funcionou após deploy

### 7. **Configurar Cloudflare R2 (se aplicável)** ⚠️ MANUAL
   - [ ] Verificar se `ALLOWED_ORIGINS` inclui `https://vixter.com.br`
   - [ ] Atualizar configurações de CORS no R2 se necessário

### 8. **Variáveis de Ambiente do Backend (Vercel)** ⚠️ MANUAL
   - [ ] Verificar `REACT_APP_BACKEND_URL` (se usada)
   - [ ] Configurar para `https://vixter.com.br` ou manter backend separado

## 📋 **Checklist Pré-Deploy**

### Antes de Fazer Deploy:
- [ ] Testar localmente com variáveis de produção (sem processar pagamentos reais)
- [ ] Verificar se todas as dependências estão atualizadas
- [ ] Fazer backup do banco de dados
- [ ] Verificar logs de erro atuais

### Durante o Deploy:
- [ ] Fazer deploy do frontend na Vercel
- [ ] Verificar se o build passou sem erros
- [ ] Fazer deploy das Firebase Functions
- [ ] Verificar se todas as variáveis de ambiente estão configuradas

### Após o Deploy:
- [ ] Testar acesso ao site em `https://vixter.com.br`
- [ ] Testar login/logout
- [ ] Testar fluxo de pagamento (começar com valor pequeno)
- [ ] Verificar webhooks do Stripe estão funcionando
- [ ] Verificar emails de verificação
- [ ] Monitorar logs por 24-48h

## 🔍 **Verificações Pós-Deploy**

### URLs para Testar:
- [ ] `https://vixter.com.br` - Homepage carrega
- [ ] `https://vixter.com.br/login` - Login funciona
- [ ] `https://vixter.com.br/settings` - Settings carrega
- [ ] `https://vixter.com.br/verify-email` - Verificação funciona
- [ ] Stripe Checkout - Redirecionamento funciona

### Funcionalidades Críticas:
- [ ] Autenticação Firebase
- [ ] Pagamentos Stripe (testar com valor mínimo)
- [ ] Stripe Connect (conectar conta de teste)
- [ ] Upload de mídia
- [ ] Mensagens/Chat

## ⚠️ **Observações Importantes**

1. **Backend separado**: O backend (`backend/`) pode continuar na URL atual da Vercel, desde que o CORS esteja configurado corretamente.

2. **Chaves do Stripe**: 
   - **NUNCA** commite chaves de produção no código
   - Use sempre variáveis de ambiente
   - Chaves de teste e produção são diferentes

3. **Webhooks do Stripe**:
   - Atualizar URL do webhook no dashboard do Stripe para produção
   - URL deve ser: `https://[seu-backend]/api/stripe-webhook` (ou função Firebase)

4. **SSL/HTTPS**: 
   - Vercel fornece SSL automático para domínios customizados
   - Certificado Let's Encrypt é provisionado automaticamente

## 🆘 **Problemas Comuns**

### Erro CORS após deploy:
- Verificar se `vixter.com.br` está nas listas de origem permitida
- Verificar headers de resposta do backend

### Erro de autenticação:
- Verificar se domínio está autorizado no Firebase
- Verificar se cookies estão sendo enviados corretamente

### Pagamentos não funcionam:
- Verificar se chaves do Stripe são de PRODUÇÃO (não test)
- Verificar webhooks estão configurados
- Verificar logs do Stripe Dashboard

## 📞 **Recursos**

- Vercel Docs: https://vercel.com/docs/custom-domains
- Stripe Dashboard: https://dashboard.stripe.com
- Firebase Console: https://console.firebase.google.com
- Guia de Migração: `PRODUCTION_MIGRATION_GUIDE.md`

