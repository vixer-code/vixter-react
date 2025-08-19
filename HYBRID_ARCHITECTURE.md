# 🚀 Arquitetura Híbrida Vixter - RTDB + Firestore

## 📋 Visão Geral

Esta documentação descreve a nova arquitetura híbrida do Vixter, otimizada para performance e consistência de dados.

## 🏗️ Estrutura da Arquitetura

### 🔥 **Firestore** (Dados Persistentes + Queries Complexas)

#### `users/{uid}` - Perfis de Usuário
```javascript
{
  // Dados básicos
  uid: string,
  email: string,
  displayName: string,
  username: string,
  name: string,
  
  // Perfil detalhado
  bio: string,
  aboutMe: string,
  location: string,
  languages: string,
  hobbies: string,
  interests: string,
  
  // URLs de mídia
  profilePictureURL: string | null,
  coverPhotoURL: string | null,
  
  // Configurações
  accountType: 'provider' | 'customer' | 'both',
  profileComplete: boolean,
  specialAssistance: boolean,
  selectedStatus: string,
  communicationPreferences: object,
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastDailyBonus: Timestamp | null,
  
  // Índices para busca
  searchTerms: string[], // [displayname, username, location]
  
  // Contadores para performance
  stats: {
    totalPosts: number,
    totalServices: number,
    totalPacks: number,
    totalSales: number
  }
}
```

#### `wallets/{uid}` - Sistema de Carteira
```javascript
{
  uid: string,
  vp: number,        // Vixter Points (moeda de compra)
  vc: number,        // Vixter Credits (conversível para real)
  vbp: number,       // Vixter Bonus Points (ganhos grátis)
  vcPending: number, // VC aguardando confirmação
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `transactions/{id}` - Histórico de Transações
```javascript
{
  id: string,
  userId: string,
  type: 'BUY_VP' | 'SALE_PACK' | 'SALE_SERVICE' | 'BONUS' | 'REFUND',
  amounts: {
    vp?: number,
    vc?: number,
    vbp?: number,
    vcPending?: number
  },
  ref: {
    stripeSessionId?: string,
    packId?: string,
    serviceId?: string,
    serviceOrderId?: string,
    targetUserId?: string
  },
  status: 'PENDING' | 'CONFIRMED' | 'FAILED',
  metadata: {
    description: string,
    conversionRate?: number,
    originalAmount?: number
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `packs/{id}` - Pacotes de Conteúdo
```javascript
{
  id: string,
  authorId: string,
  title: string,
  description: string,
  price: number, // em VP
  category: string,
  tags: string[],
  mediaUrls: string[],
  isActive: boolean,
  purchaseCount: number,
  rating: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `services/{id}` - Serviços
```javascript
{
  id: string,
  providerId: string,
  title: string,
  description: string,
  price: number, // em VP
  category: string,
  tags: string[],
  deliveryTime: string,
  isActive: boolean,
  orderCount: number,
  rating: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### `posts/{id}` - Posts do Feed
```javascript
{
  id: string,
  authorId: string,
  content: string,
  mediaUrls: string[],
  likes: number,
  comments: number,
  isVisible: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### ⚡ **Realtime Database** (Tempo Real Crítico)

#### `status/{uid}` - Presença de Usuário
```javascript
{
  online: boolean,
  lastSeen: timestamp,
  status: 'online' | 'away' | 'busy' | 'offline'
}
```

#### `chats/{chatId}/messages` - Mensagens em Tempo Real
```javascript
{
  messageId: {
    senderId: string,
    content: string,
    timestamp: timestamp,
    type: 'text' | 'image' | 'file',
    read: boolean
  }
}
```

#### `calls/{callId}/signal` - Sinalização WebRTC
```javascript
{
  participants: string[],
  offer: object,
  answer: object,
  candidates: object[],
  status: 'calling' | 'connected' | 'ended'
}
```

## 🔄 Processo de Migração

### 1. **Cloud Functions de Migração**

```javascript
// Migrar usuário individual
const migrateUser = httpsCallable(functions, 'migrateUserToFirestore');
await migrateUser();

// Migração em massa (admin only)
const migrateAll = httpsCallable(functions, 'migrateAllUsers');
await migrateAll();
```

### 2. **Contextos React Atualizados**

- **`UserContext`**: Gerencia dados de usuário do Firestore
- **`WalletContext`**: Sistema de carteira (já implementado)
- **`AuthContext`**: Autenticação (mantido)
- **`StatusContext`**: Presença (RTDB)

### 3. **Componentes Migrados**

- **Header**: Agora usa `UserContext` + `WalletContext`
- **Profile**: Lê/escreve no Firestore via `UserContext`
- **Wallet**: Usa apenas Firestore (sem sincronização RTDB)

## 📊 Vantagens da Nova Arquitetura

### 🎯 **Performance**
- **Queries Eficientes**: Firestore permite filtros e ordenação complexos
- **Índices Planejados**: Configuração otimizada para consultas frequentes
- **Cache Local**: React Query + Zustand para cache inteligente
- **Paginação**: `.limit()` + `.startAfter()` para listagens grandes

### 🔒 **Consistência**
- **Transações Atômicas**: Operações de carteira são todas-ou-nada
- **Validação Centralizada**: Cloud Functions garantem integridade
- **Tipos Estruturados**: Schemas bem definidos para cada collection

### ⚡ **Tempo Real**
- **Chat Ultra-Rápido**: RTDB para latência mínima
- **WebRTC Otimizado**: Sinalização em tempo real
- **Presença Confiável**: Status online/offline instantâneo

### 💰 **Custos Otimizados**
- **Reads Inteligentes**: Cache reduz consultas desnecessárias
- **Writes Batched**: Operações agrupadas quando possível
- **Índices Mínimos**: Apenas o necessário para performance

## 🛠️ Implementação

### **Cloud Functions**
```bash
# Deploy das novas functions
firebase deploy --only functions
```

### **Frontend React**
```jsx
// App.jsx - Nova estrutura de providers
<AuthProvider>
  <UserProvider>
    <WalletProvider>
      <StatusProvider>
        <App />
      </StatusProvider>
    </WalletProvider>
  </UserProvider>
</AuthProvider>
```

### **Índices Firestore**
```javascript
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "fields": [
        { "fieldPath": "location", "order": "ASCENDING" },
        { "fieldPath": "accountType", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 🚀 Próximos Passos

1. **✅ Migração de Usuários**: Implementada
2. **✅ Sistema de Carteira**: Otimizado 
3. **✅ Cloud Functions**: Atualizadas
4. **🔄 Frontend**: Em migração
5. **📋 Packs & Services**: Próxima fase
6. **📝 Posts & Feed**: Próxima fase
7. **🧹 Limpeza RTDB**: Fase final

## 📋 Checklist de Migração

- [x] Cloud Functions de migração
- [x] UserContext implementado
- [x] Header migrado para Firestore
- [x] WalletContext otimizado
- [ ] Profile page migrada
- [ ] Packs/Services migrados
- [ ] Posts/Feed migrados
- [ ] Limpeza final do RTDB

## 🔍 Monitoramento

### **Métricas Importantes**
- Latência de queries Firestore
- Uso de reads/writes
- Performance do RTDB para chat
- Taxa de erro nas migrações

### **Logs Estruturados**
```javascript
// Exemplo de log das Cloud Functions
logger.info(`✅ Usuário ${userId} migrado para Firestore`, {
  operation: 'user_migration',
  userId,
  timestamp: new Date().toISOString()
});
```

---

🎉 **Resultado**: Sistema híbrido otimizado que aproveita o melhor de ambas as tecnologias Firebase!
