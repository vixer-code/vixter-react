# 📋 Schema de Dados - Support Tickets

## 🗄️ Estrutura no Firestore

### **Coleção: `supportTickets`**

#### **Documento: `TKT-1703123456-ABC12`**

```javascript
{
  // Identificação
  ticketId: "TKT-1703123456-ABC12",           // ID único do ticket
  userId: "user_uid_123",                     // UID do usuário
  userEmail: "joao@email.com",                // Email do usuário
  userName: "João Silva",                    // Nome do usuário
  
  // Conteúdo do Ticket
  subject: "Problema com pagamento",          // Assunto do ticket
  description: "Não consigo fazer pagamento com cartão...", // Descrição inicial
  category: "payment",                        // Categoria do problema
  priority: "high",                          // Prioridade (low, medium, high, urgent)
  
  // Status e Fluxo
  status: "waiting_admin",                   // Status atual do ticket
  assignedTo: "admin_uid_456",              // Admin responsável (opcional)
  
  // Anexos
  attachments: [                             // Arquivos anexados
    {
      name: "screenshot.png",
      url: "https://storage.../screenshot.png",
      size: 1024000,
      type: "image/png"
    }
  ],
  
  // Metadados
  metadata: {
    platform: "web",                        // Plataforma (web, mobile, api)
    userAgent: "Mozilla/5.0...",            // User agent do navegador
    ipAddress: "192.168.1.1",              // IP do usuário (opcional)
    source: "support_page"                  // Origem do ticket
  },
  
  // Timestamps
  timestamps: {
    createdAt: 1703123456789,              // Quando foi criado
    updatedAt: 1703124000000,              // Última atualização
    resolvedAt: null,                      // Quando foi resolvido
    closedAt: null,                        // Quando foi fechado
    lastMessageAt: 1703124000000           // Última mensagem
  },
  
  // Contadores
  messageCount: 5,                          // Número total de mensagens
  
  // Última mensagem do usuário (para réplicas)
  lastUserMessage: "Obrigado pela resposta! Funcionou perfeitamente.", // Última réplica
  lastUserMessageAt: 1703124000000,         // Timestamp da última réplica
  
  // Histórico de mensagens (opcional - para auditoria)
  messageHistory: [                        // Histórico completo de mensagens
    {
      id: "msg_1",
      senderId: "user_uid_123",
      senderType: "user",                   // user, admin, system
      content: "Não consigo fazer pagamento...",
      timestamp: 1703123456789,
      type: "initial"                       // initial, reply, admin_response
    },
    {
      id: "msg_2", 
      senderId: "admin_uid_456",
      senderType: "admin",
      content: "Olá! Vou verificar seu problema...",
      timestamp: 1703123600000,
      type: "admin_response"
    },
    {
      id: "msg_3",
      senderId: "user_uid_123", 
      senderType: "user",
      content: "Obrigado pela resposta!",
      timestamp: 1703124000000,
      type: "reply"
    }
  ]
}
```

## 📊 Status do Ticket

### **Estados Possíveis:**

```javascript
const TICKET_STATUSES = {
  'open': 'Aberto',                    // Ticket criado, aguardando análise
  'in_progress': 'Em Andamento',      // Admin está trabalhando
  'waiting_user': 'Aguardando Usuário', // Aguardando resposta do usuário
  'waiting_admin': 'Aguardando Admin', // Usuário respondeu, aguardando admin
  'resolved': 'Resolvido',            // Problema solucionado
  'closed': 'Fechado'                // Ticket finalizado
};
```

### **Fluxo de Status:**

```
open → in_progress → waiting_user → waiting_admin → resolved → closed
  ↓         ↓            ↓             ↓            ↓         ↓
Criado   Trabalhando   Aguardando   Usuário      Resolvido  Fechado
         na solução    usuário      respondeu
```

## 🔄 Processamento de Réplicas

### **Quando Usuário Responde Email:**

1. **Webhook SendGrid** recebe email
2. **Extrai ticketId** do assunto
3. **Valida** se email é do usuário do ticket
4. **Atualiza ticket** no Firestore:
   ```javascript
   await ticketRef.update({
     status: 'waiting_admin',           // Muda para aguardando admin
     updatedAt: Date.now(),
     lastMessageAt: Date.now(),
     messageCount: admin.firestore.FieldValue.increment(1),
     lastUserMessage: userMessage,      // Nova mensagem do usuário
     lastUserMessageAt: Date.now()
   });
   ```
5. **Notifica admin** por email
6. **Log** da operação

### **Quando Admin Responde:**

1. **Admin envia email** para usuário
2. **Admin atualiza status** manualmente:
   ```javascript
   await ticketRef.update({
     status: 'waiting_user',            // Muda para aguardando usuário
     updatedAt: Date.now(),
     lastMessageAt: Date.now(),
     messageCount: admin.firestore.FieldValue.increment(1)
   });
   ```
3. **Sistema envia email** de confirmação para usuário

## 📧 Templates de Email por Status

### **Réplica do Usuário → Admin:**
```
💬 Nova Réplica no Ticket
├─ Detalhes do ticket
├─ Nova mensagem do usuário
├─ Como responder
└─ [Responder ao Ticket]
```

### **Resposta do Admin → Usuário:**
```
💬 Resposta da Equipe de Suporte
├─ Detalhes do ticket
├─ Resposta da equipe
├─ Como continuar
└─ [Ver Ticket]
```

## 🔍 Queries Úteis

### **Tickets Aguardando Admin:**
```javascript
const waitingAdminTickets = await firestore
  .collection('supportTickets')
  .where('status', '==', 'waiting_admin')
  .orderBy('lastMessageAt', 'desc')
  .get();
```

### **Tickets por Usuário:**
```javascript
const userTickets = await firestore
  .collection('supportTickets')
  .where('userId', '==', userId)
  .orderBy('timestamps.createdAt', 'desc')
  .get();
```

### **Tickets Resolvidos Hoje:**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const resolvedToday = await firestore
  .collection('supportTickets')
  .where('status', '==', 'resolved')
  .where('timestamps.resolvedAt', '>=', today.getTime())
  .get();
```

### **Tickets por Prioridade:**
```javascript
const urgentTickets = await firestore
  .collection('supportTickets')
  .where('priority', '==', 'urgent')
  .where('status', 'in', ['open', 'in_progress', 'waiting_admin'])
  .get();
```

## 📈 Métricas e Analytics

### **KPIs Importantes:**

```javascript
// Tempo médio de resposta
const avgResponseTime = tickets.reduce((acc, ticket) => {
  const responseTime = ticket.timestamps.resolvedAt - ticket.timestamps.createdAt;
  return acc + responseTime;
}, 0) / tickets.length;

// Taxa de resolução na primeira resposta
const firstResponseResolved = tickets.filter(ticket => 
  ticket.messageCount <= 2 && ticket.status === 'resolved'
).length / tickets.length;

// Volume por categoria
const categoryStats = tickets.reduce((acc, ticket) => {
  acc[ticket.category] = (acc[ticket.category] || 0) + 1;
  return acc;
}, {});
```

## 🔒 Segurança e Validação

### **Validações:**

1. **Email do usuário** deve corresponder ao ticket
2. **Ticket deve existir** no Firestore
3. **Mensagem** deve ter conteúdo válido (> 10 caracteres)
4. **Rate limiting** para evitar spam
5. **Logs** de todas as operações

### **Permissões:**

- **Usuários**: Podem ver apenas seus próprios tickets
- **Admins**: Podem ver e atualizar todos os tickets
- **Sistema**: Pode processar webhooks automaticamente

## 🚀 Implementação

### **Configuração do SendGrid:**

1. **Inbound Parse** configurado para domínio
2. **Webhook** apontando para Cloud Function
3. **Headers** corretos para identificação
4. **Rate limiting** configurado

### **Deploy:**

```bash
# Deploy das functions
firebase deploy --only functions:processEmailReply

# Configurar webhook no SendGrid
# URL: https://us-east1-vixter-451b3.cloudfunctions.net/processEmailReply
```

---

**Status**: ✅ Schema definido e pronto para implementação
