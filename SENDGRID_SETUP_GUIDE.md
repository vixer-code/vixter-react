# 📧 Guia de Configuração do SendGrid para Vixter

## 🎯 Visão Geral

Este guia mostra como configurar o SendGrid para enviar emails profissionais de suporte da Vixter com templates cyberpunk personalizados.

## 🚀 Passo a Passo

### 1. Criar Conta no SendGrid

1. Acesse [sendgrid.com](https://sendgrid.com)
2. Clique em "Start for Free"
3. Preencha os dados da empresa:
   - **Nome da Empresa**: Vixter
   - **Website**: vixter-react.vercel.app
   - **Tipo de Conta**: Business
   - **Uso Principal**: Customer Support

### 2. Verificar Domínio (Recomendado)

#### 2.1 Configurar Domínio
1. No painel do SendGrid, vá para **Settings** > **Sender Authentication**
2. Clique em **Authenticate Your Domain**
3. Adicione seu domínio: `vixter.com.br` (ou domínio de produção)
4. Siga as instruções de DNS

#### 2.2 Configurações DNS
Adicione estes registros no seu provedor de DNS:

```
Tipo: CNAME
Nome: mail.vixter.com.br
Valor: mail.sendgrid.net

Tipo: CNAME  
Nome: s1._domainkey.vixter.com.br
Valor: s1.domainkey.u1234567.wl123.sendgrid.net

Tipo: CNAME
Nome: s2._domainkey.vixter.com.br  
Valor: s2.domainkey.u1234567.wl123.sendgrid.net
```

### 3. Obter API Key

1. No SendGrid, vá para **Settings** > **API Keys**
2. Clique em **Create API Key**
3. Configure:
   - **API Key Name**: `Vixter Support System`
   - **API Key Permissions**: **Full Access** (ou apenas Mail Send)
4. Copie a API Key (ela só aparece uma vez!)

### 4. Configurar Firebase Secrets

#### 4.1 Via Firebase CLI
```bash
# Instalar Firebase CLI se não tiver
npm install -g firebase-tools

# Login no Firebase
firebase login

# Configurar secrets
firebase functions:secrets:set SENDGRID_API_KEY
# Cole a API Key quando solicitado

firebase functions:secrets:set SUPPORT_EMAIL
# Digite: support@vixter.com.br
```

#### 4.2 Via Firebase Console (Alternativo)
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto `vixter-451b3`
3. Vá para **Functions** > **Secrets**
4. Adicione:
   - `SENDGRID_API_KEY`: sua API key do SendGrid
   - `SUPPORT_EMAIL`: support@vixter.com.br

### 5. Instalar Dependência

```bash
cd functions
npm install @sendgrid/mail
```

### 6. Deploy das Functions

```bash
# Deploy apenas as functions
firebase deploy --only functions

# Ou deploy completo
firebase deploy
```

## 📧 Templates de Email

### Templates Disponíveis

1. **Ticket Criado** - Confirmação para usuário
2. **Notificação Admin** - Alerta para equipe de suporte  
3. **Status Atualizado** - Mudança de status
4. **Resposta Admin** - Resposta da equipe
5. **Ticket Resolvido** - Confirmação de resolução
6. **Ticket Fechado** - Notificação de fechamento

### Características dos Templates

- ✅ **Design Cyberpunk**: Gradientes roxo/ciano
- ✅ **Responsivo**: Funciona em mobile e desktop
- ✅ **Acessível**: Cores contrastantes e texto legível
- ✅ **Profissional**: Layout limpo e organizado
- ✅ **Interativo**: Botões de ação funcionais

## 🎨 Personalização dos Templates

### Cores da Marca
```css
--vixter-primary: #8A2BE2 (Roxo)
--vixter-secondary: #00FFCA (Ciano)
--vixter-bg: #0F0F1A (Fundo escuro)
--vixter-text: #FFFFFF (Texto branco)
```

### Elementos Visuais
- **Gradientes**: Linear gradients roxo → ciano
- **Glass Morphism**: Backdrop blur e transparência
- **Badges**: Status e prioridades coloridos
- **Ícones**: FontAwesome para elementos visuais

## 📊 Monitoramento

### SendGrid Analytics
1. Acesse **Activity** no painel SendGrid
2. Monitore:
   - **Delivered**: Emails entregues
   - **Opens**: Taxa de abertura
   - **Clicks**: Cliques em links
   - **Bounces**: Emails rejeitados

### Firebase Logs
```bash
# Ver logs das functions
firebase functions:log

# Logs específicos de tickets
firebase functions:log --only emailTicketApi
```

## 🔧 Configurações Avançadas

### 1. Webhook para Status
Configure webhook no SendGrid para receber notificações de:
- Email entregue
- Email aberto
- Link clicado
- Email rejeitado

### 2. Templates Dinâmicos
Para personalização avançada, use SendGrid Dynamic Templates:
1. Crie templates no SendGrid
2. Use variáveis dinâmicas
3. Integre com a API

### 3. Automações
Configure automações para:
- Resposta automática por categoria
- Escalação por prioridade
- Follow-up após resolução

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Email não enviado
```bash
# Verificar logs
firebase functions:log --only createSupportTicket

# Verificar API Key
firebase functions:secrets:access SENDGRID_API_KEY
```

#### 2. Template não carregado
- Verificar import no `email-ticket-functions.js`
- Confirmar que `email-templates.js` está no mesmo diretório

#### 3. Domínio não verificado
- Verificar configurações DNS
- Aguardar propagação (até 24h)
- Testar com domínio verificado

### Logs Úteis
```javascript
// Adicionar logs detalhados
logger.info('Sending email to:', to);
logger.info('Email subject:', subject);
logger.info('SendGrid response:', result);
```

## 📈 Métricas de Sucesso

### KPIs para Monitorar
- **Tempo de Resposta**: < 24 horas
- **Taxa de Entrega**: > 95%
- **Taxa de Abertura**: > 60%
- **Satisfação**: Pesquisa pós-resolução

### Relatórios
Configure relatórios semanais/mensais:
- Tickets criados por categoria
- Tempo médio de resolução
- Volume de emails enviados
- Taxa de resolução na primeira resposta

## 🔒 Segurança

### Boas Práticas
- ✅ **API Key**: Mantenha secreta, nunca no código
- ✅ **Rate Limiting**: Configure limites no SendGrid
- ✅ **Validação**: Valide emails antes de enviar
- ✅ **Logs**: Monitore tentativas de spam

### Compliance
- **LGPD**: Emails com opt-out
- **GDPR**: Para usuários europeus
- **CAN-SPAM**: Headers corretos

## 🎯 Próximos Passos

### Melhorias Futuras
1. **Templates A/B**: Testar diferentes designs
2. **Personalização**: Emails baseados no perfil do usuário
3. **Integração**: Slack/Discord para notificações
4. **Analytics**: Dashboard de métricas de suporte

### Integrações
- **CRM**: Conectar com sistema de clientes
- **Chatbot**: Respostas automáticas
- **Knowledge Base**: Links para documentação
- **Feedback**: Sistema de avaliação

---

## 📞 Suporte

Se precisar de ajuda com a configuração:
- **Email**: contato@vixter.com.br
- **Documentação**: [SendGrid Docs](https://docs.sendgrid.com)
- **Firebase**: [Firebase Functions Docs](https://firebase.google.com/docs/functions)

**Status**: ✅ Sistema pronto para produção após configuração do SendGrid
