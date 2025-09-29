# Guia de Auto-Conclusão de Serviços

## 📋 Visão Geral

O sistema de auto-conclusão de serviços foi implementado para automaticamente marcar serviços em status `DELIVERED` há mais de 24 horas como `AUTO_RELEASED`, liberando automaticamente os VC (Vixter Coins) para a vendedora.

## 🔧 Funcionalidades Implementadas

### 1. **Verificação Automática**
- Verifica serviços com status `DELIVERED` há mais de 24 horas
- Processa em lotes para evitar timeouts
- Registra logs detalhados de todas as operações

### 2. **Liberação Automática de VC**
- Move VC de `vcPending` para `vc` na carteira da vendedora
- Atualiza status do pedido para `AUTO_RELEASED`
- Cria transação de histórico para auditoria

### 3. **Processamento em Lotes**
- Processa até 10 serviços por lote
- Evita timeouts em grandes volumes
- Tratamento de erros individual por serviço

## 🚀 Cloud Function Criada

### `scheduledAutoCompleteServices`
- **Tipo**: HTTP Function (para cron jobs)
- **Propósito**: Execução automática da auto-conclusão
- **Uso**: Configurar cron job para executar a cada 2 horas
- **Retorno**: Status HTTP com detalhes do processamento

## ⚙️ Como Usar

### Execução Automática (Cron Job)

Configure um cron job para chamar a função HTTP:

```bash
# Executar a cada 2 horas
0 */2 * * * curl -X POST https://your-region-your-project.cloudfunctions.net/scheduledAutoCompleteServices
```

Ou usando serviços como:
- **Google Cloud Scheduler**
- **Cron-job.org**
- **GitHub Actions**

### Via Google Cloud Scheduler

1. Acesse o Google Cloud Console
2. Vá para Cloud Scheduler
3. Crie um novo job com:
   - **Nome**: `auto-complete-services`
   - **Frequência**: `0 */2 * * *` (a cada 2 horas)
   - **Target**: HTTP
   - **URL**: `https://us-east1-your-project.cloudfunctions.net/scheduledAutoCompleteServices`
   - **Método**: POST

## 📊 Estrutura de Dados

### Status de Pedidos Atualizados
```javascript
{
  status: 'AUTO_RELEASED',  // Novo status
  paymentStatus: 'COMPLETED',
  timestamps: {
    updatedAt: timestamp,
    autoCompletedAt: timestamp  // Novo campo
  }
}
```

### Transações Criadas
```javascript
{
  type: 'SERVICE_SALE_AUTO_COMPLETED',
  amounts: { vc: number },
  metadata: {
    description: 'Serviço auto-concluído após 24h: [Nome do Serviço]',
    orderId: 'string',
    serviceId: 'string',
    buyerId: 'string',
    vpAmount: number,
    autoCompleted: true
  },
  status: 'COMPLETED'
}
```

## 🔍 Logs e Monitoramento

### Logs Importantes
- `⏰ Scheduled auto-completion of delivered services triggered (every 2 hours)...`
- `🔍 Checking for services delivered more than 24 hours ago...`
- `📦 Found X services to auto-complete`
- `🔄 Auto-completing service: [ID]`
- `✅ Batch X committed successfully`
- `✅ Auto-completion process finished. Processed: X, Errors: Y`

### Monitoramento
- Verifique os logs do Firebase Functions
- Monitore o número de serviços processados
- Acompanhe erros individuais se houver

## ⚠️ Considerações Importantes

### 1. **Timing**
- A verificação é baseada no campo `timestamps.updatedAt`
- Serviços são marcados como `DELIVERED` quando a vendedora entrega
- Após 24 horas, são automaticamente concluídos

### 2. **Segurança**
- Função interna não requer autenticação (execução automática)
- Função callable pode ser chamada por usuários autenticados
- Todas as operações são registradas em logs

### 3. **Performance**
- Processamento em lotes de 10 serviços
- Timeout de 5 minutos para operações grandes
- Memória configurada para 256MiB

### 4. **Recuperação de Erros**
- Erros individuais não param o processamento
- Relatório detalhado de erros
- Possibilidade de reprocessamento manual

## 🛠️ Manutenção

### Verificação Manual
```javascript
// Verificar serviços que precisam de auto-conclusão
const query = db.collection('serviceOrders')
  .where('status', '==', 'DELIVERED')
  .where('timestamps.updatedAt', '<', twentyFourHoursAgo);

const snapshot = await query.get();
console.log(`Serviços pendentes: ${snapshot.size}`);
```

### Limpeza de Dados
- Transações são mantidas para auditoria
- Status `AUTO_RELEASED` é permanente
- Timestamp `autoCompletedAt` registra quando foi processado

## 📈 Métricas Sugeridas

1. **Número de serviços auto-concluídos por dia**
2. **Tempo médio entre entrega e auto-conclusão**
3. **Taxa de erro no processamento**
4. **Volume de VC liberado automaticamente**

## 🔧 Troubleshooting

### Problemas Comuns

1. **Timeout na função**
   - Reduza o tamanho do lote
   - Aumente o timeout da função

2. **Erros de permissão**
   - Verifique as regras do Firestore
   - Confirme as permissões da função

3. **Serviços não processados**
   - Verifique se o campo `timestamps.updatedAt` está correto
   - Confirme se o status é exatamente `DELIVERED`

### Logs de Debug
```javascript
// Verificar logs detalhados
firebase functions:log --only scheduledAutoCompleteServices
```

---

**✅ Sistema implementado e pronto para uso!**

A função foi integrada ao sistema existente e será executada automaticamente via cron job a cada 2 horas para garantir que os VC sejam liberados automaticamente para as vendedoras após 24 horas de entrega.
