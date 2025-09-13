# 🔗 Configuração do Stripe Connect

## 📋 Checklist de Configuração

### 1. **Stripe Dashboard Setup**
- [ ] Acesse: https://dashboard.stripe.com/connect
- [ ] Ative o Stripe Connect (se não estiver ativo)
- [ ] Configure as URLs de retorno:
  - **Return URL**: `https://seu-dominio.com/settings?stripe=success`
  - **Refresh URL**: `https://seu-dominio.com/settings?stripe=refresh`

### 2. **Variáveis de Ambiente**
As mesmas chaves do sandbox funcionam para Connect:

```bash
# Firebase Functions Secrets
STRIPE_SECRET_KEY=sk_test_...  # Sua chave secreta do sandbox
STRIPE_WEBHOOK_SECRET=whsec_...  # Seu webhook secret
```

### 3. **Configurações no Código**
✅ **Já implementado** - O código está configurado para:
- Usar a mesma chave para Connect e pagamentos
- Detectar ambiente (sandbox/produção)
- Configurar contas Express para Brasil
- Pagamentos diários automáticos

### 4. **Testando no Sandbox**

#### Para Testar Connect:
1. **Crie uma conta Stripe Connect** no sandbox
2. **Use dados de teste** do Stripe:
   - Email: `test@example.com`
   - CPF: `000.000.000-00`
   - Telefone: `+5511999999999`

#### Dados de Teste do Stripe:
```
Cartão de Teste: 4242 4242 4242 4242
CVV: 123
Data: 12/34
```

#### Configuração de Pagamentos pelo Provider:
1. **Provider acessa** dashboard do Stripe
2. **Configura PIX** com chave aleatória, CPF, email
3. **Adiciona conta bancária** para transferência
4. **Escolhe frequência** de pagamentos (diário/semanal/mensal)
5. **Recebe pagamentos** automaticamente

### 5. **Fluxo de Teste**

1. **Provider acessa** `/settings`
2. **Clica em "Conectar Conta Stripe"**
3. **Preenche dados** no onboarding do Stripe
4. **Retorna para** `/settings?stripe=success`
5. **Status muda** para "Conta configurada e ativa"
6. **Pode sacar VC** na carteira

### 6. **Monitoramento**

#### No Stripe Dashboard:
- **Connect > Accounts**: Veja contas criadas
- **Connect > Transfers**: Veja transferências
- **Logs**: Monitore erros e eventos

#### No Firebase:
- **Functions Logs**: Monitore execução das funções
- **Firestore**: Coleção `withdrawals` com histórico

### 7. **Produção**

Quando for para produção:
1. **Mude as chaves** para produção
2. **Atualize URLs** para domínio real
3. **Teste com valores pequenos** primeiro
4. **Configure webhooks** se necessário

## 🚨 **Problemas Comuns**

### Erro: "Connect not enabled"
- **Solução**: Ative Connect no dashboard do Stripe

### Erro: "Invalid return URL"
- **Solução**: Configure URLs corretas no dashboard

### Erro: "Account not ready"
- **Solução**: Complete o onboarding no Stripe

## 📞 **Suporte**

- **Stripe Docs**: https://stripe.com/docs/connect
- **Stripe Support**: https://support.stripe.com
- **Firebase Functions**: https://firebase.google.com/docs/functions
