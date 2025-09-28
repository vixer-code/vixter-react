# Configuração do Sistema de Gorjetas (Vixtip)

## 📋 Visão Geral

O sistema de gorjetas foi implementado com as seguintes funcionalidades:

1. **Envio de Gorjetas**: Clients podem enviar gorjetas para qualquer usuário
2. **Processamento Imediato**: Gorjetas são processadas imediatamente via Cloud Function
3. **Cron Job**: Processamento em lote a cada 24 horas para gorjetas pendentes
4. **Conversão Automática**: 1 VP = 0.67 VC (arredondado para cima, conforme especificado)

## 🔧 Cloud Functions Criadas

### 1. `processVixtip`
- **Tipo**: Callable Function
- **Propósito**: Processa uma gorjeta individual
- **Chamada**: Automática após envio da gorjeta
- **Ação**: Credita VC na carteira do vendedor

### 2. `processPendingVixtips`
- **Tipo**: Callable Function
- **Propósito**: Processa todas as gorjetas pendentes
- **Chamada**: Manual (via código ou console)
- **Ação**: Processa até 100 gorjetas por execução

## ⚙️ Como Usar as Functions

### 1. Processamento Automático
- As gorjetas são processadas **automaticamente** quando enviadas
- Não é necessário fazer nada manualmente

### 2. Processamento Manual (Opcional)
Se houver gorjetas pendentes, você pode processá-las manualmente:

```javascript
// No console do navegador ou código
import { httpsCallable } from 'firebase/functions';

const processPendingVixtips = httpsCallable(functions, 'processPendingVixtips');
const result = await processPendingVixtips();
console.log(result.data);
```

## 📊 Estrutura de Dados

### Coleção `vixtips`
```javascript
{
  postId: "string",
  postType: "vixies" | "vixink",
  authorId: "string",
  authorName: "string",
  authorUsername: "string",
  buyerId: "string",
  buyerName: "string",
  buyerUsername: "string",
  vpAmount: number,
  vcAmount: number,
  status: "pending" | "completed",
  createdAt: timestamp,
  processedAt: timestamp
}
```

### Transações
- **VIXTIP_SENT**: Registrada na carteira do comprador
- **VIXTIP_RECEIVED**: Registrada na carteira do vendedor

## 🚀 Deploy das Functions

```bash
# Navegar para a pasta functions
cd functions

# Instalar dependências
npm install

# Deploy das functions
firebase deploy --only functions
```

**Pronto!** As functions estarão disponíveis e as gorjetas serão processadas automaticamente.

## 🔍 Monitoramento

### Logs das Functions
```bash
# Ver logs em tempo real
firebase functions:log --only processVixtip,processPendingVixtips,cronProcessVixtips

# Ver logs específicos
firebase functions:log --only processVixtip
```

### Verificar Status das Gorjetas
```javascript
// Query para gorjetas pendentes
const pendingVixtips = await db.collection('vixtips')
  .where('status', '==', 'pending')
  .get();

// Query para gorjetas processadas hoje
const today = new Date();
today.setHours(0, 0, 0, 0);
const processedToday = await db.collection('vixtips')
  .where('status', '==', 'completed')
  .where('processedAt', '>=', today)
  .get();
```

## 🛠️ Testes

### Testar Processamento Individual
```javascript
import { httpsCallable } from 'firebase/functions';

const processVixtip = httpsCallable(functions, 'processVixtip');
const result = await processVixtip({ vixtipId: 'vixtip-id-aqui' });
console.log(result.data);
```

### Testar Processamento em Lote
```javascript
const processPendingVixtips = httpsCallable(functions, 'processPendingVixtips');
const result = await processPendingVixtips();
console.log(result.data);
```

## 🔒 Segurança

1. **Autenticação**: Todas as functions requerem autenticação
2. **Validação**: Dados são validados antes do processamento
3. **Transações**: Operações são atômicas para evitar inconsistências
4. **Rate Limiting**: Processamento limitado a 100 gorjetas por execução
5. **Logs**: Todas as operações são logadas para auditoria

## 📈 Performance

- **Processamento Imediato**: Gorjetas são processadas instantaneamente
- **Fallback**: Cron job processa gorjetas que falharam
- **Batch Processing**: Até 100 gorjetas por execução do cron
- **Error Handling**: Erros são capturados e logados
- **Retry Logic**: Gorjetas falhadas podem ser reprocessadas

## 🎯 Próximos Passos

1. **Deploy das Functions**: Executar `firebase deploy --only functions`
2. **Testar Sistema**: Enviar gorjetas de teste
3. **Monitorar Logs**: Verificar funcionamento
4. **Processar Pendentes**: Usar `processPendingVixtips` se necessário

## 📞 Suporte

Para dúvidas ou problemas:
- Verificar logs das functions
- Consultar documentação do Firebase
- Verificar configurações de segurança
- Testar com dados de exemplo
