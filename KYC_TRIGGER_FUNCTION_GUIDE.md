# Guia da Função Trigger KYC

## 📋 Visão Geral

A função `onKycStatusChange` foi criada para automatizar a atualização dos campos `kyc` e `kycState` no documento do usuário sempre que o status do KYC for alterado no Firestore.

## 🔧 Como Funciona

### Trigger Automático
- **Evento**: Mudança no documento `kyc/{userId}` no Firestore
- **Ação**: Atualiza automaticamente os campos `kyc` e `kycState` no Realtime Database
- **Condição**: Só executa se o status realmente mudou

### Mapeamento de Status
```javascript
// Status KYC → Campos do Usuário
'VERIFIED' → kyc: true, kycState: 'VERIFIED'
'PENDING_VERIFICATION' → kyc: false, kycState: 'PENDING_VERIFICATION'  
'PENDING_UPLOAD' → kyc: false, kycState: 'PENDING_UPLOAD'
```

## 🚀 Como Usar

### 1. Deploy da Função
```bash
cd functions
npm run deploy
```

### 2. Verificar KYC (Admin)
Quando você alterar o status do KYC para "VERIFIED" no Firestore, a função automaticamente:

1. ✅ Detecta a mudança de status
2. ✅ Atualiza `kyc: true` no usuário
3. ✅ Atualiza `kycState: 'VERIFIED'` no usuário
4. ✅ Registra logs detalhados

### 3. Exemplo de Uso
```javascript
// No Firestore, documento: kyc/{userId}
{
  status: 'VERIFIED',  // ← Mudança aqui
  verifiedAt: Date.now(),
  verifiedBy: 'admin-uid'
}

// Automaticamente atualiza no Realtime Database: users/{userId}
{
  kyc: true,           // ← Atualizado automaticamente
  kycState: 'VERIFIED', // ← Atualizado automaticamente
  updatedAt: Date.now()
}
```

## 📊 Logs e Monitoramento

### Logs da Função
A função gera logs detalhados para monitoramento:

```javascript
// Log de mudança detectada
[onKycStatusChange] KYC status changed for user {userId}: {
  before: 'PENDING_VERIFICATION',
  after: 'VERIFIED'
}

// Log de atualização
[onKycStatusChange] Setting kyc=true for verified user {userId}
[onKycStatusChange] Successfully updated user {userId} with status VERIFIED
```

### Verificar Logs
```bash
# Firebase CLI
firebase functions:log --only onKycStatusChange

# Ou no Firebase Console
# Functions → Logs → Filtrar por "onKycStatusChange"
```

## 🧪 Testando a Função

### Script de Teste
Use o script `test-kyc-trigger.js` para testar:

```bash
cd functions
node test-kyc-trigger.js
```

### Teste Manual
1. Crie um documento KYC no Firestore
2. Altere o status para "VERIFIED"
3. Verifique se o usuário foi atualizado no Realtime Database

## ⚠️ Considerações Importantes

### Segurança
- ✅ A função só atualiza dados, não lê dados sensíveis
- ✅ Logs não expõem informações pessoais
- ✅ Tratamento de erros evita loops infinitos

### Performance
- ✅ Executa apenas quando há mudança real de status
- ✅ Operações atômicas no Realtime Database
- ✅ Timeout configurado para evitar travamentos

### Confiabilidade
- ✅ Retry automático em caso de falha
- ✅ Logs detalhados para debugging
- ✅ Não falha silenciosamente

## 🔍 Troubleshooting

### Problema: Função não executa
**Solução**: Verificar se a função foi deployada corretamente
```bash
firebase functions:list
```

### Problema: Usuário não é atualizado
**Solução**: Verificar logs da função
```bash
firebase functions:log --only onKycStatusChange
```

### Problema: Status não muda
**Solução**: Verificar se o documento KYC existe e tem o campo `status`

## 📈 Benefícios

### Para Administradores
- ✅ **Automação**: Não precisa mais atualizar manualmente
- ✅ **Consistência**: Dados sempre sincronizados
- ✅ **Auditoria**: Logs completos de todas as mudanças

### Para o Sistema
- ✅ **Confiabilidade**: Menos erros manuais
- ✅ **Performance**: Atualizações em tempo real
- ✅ **Manutenibilidade**: Código centralizado e testável

## 🎯 Próximos Passos

1. **Deploy da função** em produção
2. **Monitorar logs** nas primeiras execuções
3. **Testar com usuários reais**
4. **Documentar casos especiais** se necessário

---

**Nota**: Esta função substitui o processo manual de atualização dos campos `kyc` e `kycState` no usuário, automatizando completamente o fluxo de verificação KYC.
