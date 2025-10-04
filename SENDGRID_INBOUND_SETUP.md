# 📧 Configuração SendGrid Inbound Parse para Réplicas

## 🎯 Objetivo

Configurar o SendGrid para processar automaticamente réplicas de email dos usuários nos tickets de suporte.

## 🚀 Passo a Passo

### 1. Configurar Inbound Parse no SendGrid

#### 1.1 Acessar Inbound Parse
1. Faça login no [SendGrid Dashboard](https://app.sendgrid.com)
2. Vá para **Settings** > **Inbound Parse**
3. Clique em **Add Host & URL**

#### 1.2 Configurar Host
```
Hostname: support.vixter.com.br
URL: https://us-east1-vixter-451b3.cloudfunctions.net/processEmailReply
Spam Check: Enabled
Send Raw: Enabled
```

#### 1.3 Configurações Avançadas
```
POST the raw, full MIME message: ✅ Enabled
Inbound Parse Webhook: ✅ Enabled
Spam Check: ✅ Enabled
```

### 2. Configurar DNS

#### 2.1 Registro MX
Adicione este registro MX no seu provedor de DNS:

```
Tipo: MX
Nome: support.vixter.com.br
Valor: mx.sendgrid.net
Prioridade: 10
TTL: 3600
```

#### 2.2 Verificar Configuração
```bash
# Testar resolução MX
dig MX support.vixter.com.br

# Deve retornar:
# support.vixter.com.br. 3600 IN MX 10 mx.sendgrid.net.
```

### 3. Configurar Cloud Function

#### 3.1 Deploy da Function
```bash
# Deploy apenas a function de webhook
firebase deploy --only functions:processEmailReply

# URL será: https://us-east1-vixter-451b3.cloudfunctions.net/processEmailReply
```

#### 3.2 Configurar Secrets
```bash
# Configurar secrets necessários
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set SUPPORT_EMAIL
```

### 4. Testar Configuração

#### 4.1 Teste Manual
```bash
# Testar webhook diretamente
curl -X POST https://us-east1-vixter-451b3.cloudfunctions.net/testEmailReply \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "TKT-1703123456-ABC12",
    "userMessage": "Obrigado pela resposta! Funcionou perfeitamente.",
    "userEmail": "joao@email.com"
  }'
```

#### 4.2 Teste com Email Real
1. Crie um ticket de teste
2. Responda o email recebido
3. Verifique se o webhook foi chamado
4. Confirme atualização no Firestore

## 📧 Como Funciona

### Fluxo Completo:

```
1. Usuário cria ticket → Email enviado com assunto: [TKT-123] Problema
2. Usuário responde email → Email vai para support@vixter.com.br
3. SendGrid recebe email → Chama webhook processEmailReply
4. Webhook extrai ticketId → Atualiza Firestore
5. Admin é notificado → Pode responder normalmente
```

### Assunto do Email:

```
Original: [TKT-1703123456-ABC12] Ticket de Suporte Criado - Problema com pagamento
Réplica:  Re: [TKT-1703123456-ABC12] Ticket de Suporte Criado - Problema com pagamento
```

### Processamento:

```javascript
// Webhook recebe email
const subject = "Re: [TKT-1703123456-ABC12] Problema com pagamento";
const ticketId = extractTicketIdFromSubject(subject); // "TKT-1703123456-ABC12"

// Atualiza ticket
await ticketRef.update({
  status: 'waiting_admin',
  lastUserMessage: "Obrigado pela resposta!",
  lastUserMessageAt: Date.now()
});

// Notifica admin
await notifyAdminNewReply(ticketData, userMessage, userEmail);
```

## 🔧 Configurações Avançadas

### 1. Rate Limiting

```javascript
// No webhook, adicionar rate limiting
const rateLimitKey = `reply_${ticketId}_${Date.now()}`;
const rateLimitWindow = 60000; // 1 minuto

// Verificar se já processou recentemente
const lastProcessed = await redis.get(rateLimitKey);
if (lastProcessed) {
  return res.status(429).json({ error: 'Rate limited' });
}

// Marcar como processado
await redis.setex(rateLimitKey, rateLimitWindow / 1000, 'processed');
```

### 2. Validação de Email

```javascript
// Verificar se email é válido
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Verificar se é do usuário do ticket
if (ticketData.userEmail !== fromEmail) {
  logger.warn(`Email from ${fromEmail} doesn't match ticket user ${ticketData.userEmail}`);
  return;
}
```

### 3. Logs Detalhados

```javascript
// Log de todas as operações
logger.info(`Processing email reply:`, {
  ticketId,
  fromEmail,
  subject,
  messageLength: userMessage.length,
  timestamp: new Date().toISOString()
});
```

## 🚨 Troubleshooting

### Problemas Comuns:

#### 1. Webhook não é chamado
```bash
# Verificar logs do SendGrid
# Verificar se DNS está correto
dig MX support.vixter.com.br

# Verificar se function está deployada
firebase functions:log --only processEmailReply
```

#### 2. Ticket não é encontrado
```javascript
// Verificar se ticketId está correto
const ticketId = extractTicketIdFromSubject(subject);
console.log('Extracted ticket ID:', ticketId);

// Verificar se ticket existe
const ticketSnap = await ticketRef.get();
if (!ticketSnap.exists) {
  logger.warn(`Ticket not found: ${ticketId}`);
}
```

#### 3. Email não é do usuário
```javascript
// Verificar correspondência de email
if (ticketData.userEmail !== fromEmail) {
  logger.warn(`Email mismatch: ${fromEmail} vs ${ticketData.userEmail}`);
}
```

### Logs Úteis:

```bash
# Ver logs da function
firebase functions:log --only processEmailReply

# Ver logs do SendGrid
# Dashboard > Activity > Inbound Parse
```

## 📊 Monitoramento

### Métricas Importantes:

1. **Taxa de Processamento**: % de emails processados com sucesso
2. **Tempo de Resposta**: Tempo entre email e atualização do ticket
3. **Taxa de Erro**: % de emails que falharam no processamento
4. **Volume**: Número de réplicas processadas por dia

### Alertas:

```javascript
// Alertar se taxa de erro > 5%
if (errorRate > 0.05) {
  await sendAlert('High error rate in email processing', errorRate);
}

// Alertar se volume > 100 emails/hora
if (hourlyVolume > 100) {
  await sendAlert('High email volume detected', hourlyVolume);
}
```

## 🔒 Segurança

### Validações:

1. **Autenticação**: Verificar se webhook é do SendGrid
2. **Rate Limiting**: Evitar spam
3. **Validação**: Verificar dados antes de processar
4. **Logs**: Registrar todas as operações

### Headers de Segurança:

```javascript
// Verificar headers do SendGrid
const sgSignature = req.headers['x-twilio-email-event-webhook-signature'];
const sgTimestamp = req.headers['x-twilio-email-event-webhook-timestamp'];

// Validar assinatura (opcional)
if (!validateSignature(sgSignature, sgTimestamp, req.body)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

## 🎯 Resultado Final

Após configuração completa:

✅ **Emails são processados automaticamente**
✅ **Tickets são atualizados em tempo real**
✅ **Admins são notificados instantaneamente**
✅ **Sistema funciona 24/7**
✅ **Logs completos para debugging**

### URLs Importantes:

- **Webhook**: `https://us-east1-vixter-451b3.cloudfunctions.net/processEmailReply`
- **Teste**: `https://us-east1-vixter-451b3.cloudfunctions.net/testEmailReply`
- **SendGrid Dashboard**: `https://app.sendgrid.com/settings/inbound_parse`

---

**Status**: 🚀 Pronto para configuração e teste
