# Cloudflare Realtime SFU Setup Guide

Este guia explica como configurar o Cloudflare Realtime SFU para chamadas de voz e vídeo 1:1 na aplicação Vixter.

## Sobre o Cloudflare Realtime SFU

O [Cloudflare Realtime SFU](https://developers.cloudflare.com/realtime/) é um servidor de mídia poderoso que roteia eficientemente streams de vídeo e áudio entre participantes. Ele roda na rede global da Cloudflare em centenas de cidades ao redor do mundo.

## Visão Geral

O sistema de chamadas utiliza:
- **Cloudflare SFU** para roteamento de mídia
- **Centrifugo** para sinalização em tempo real
- **WebRTC** para conexões peer-to-peer
- **JWT tokens** para autenticação

## Configuração do Cloudflare

### 1. Criar conta Cloudflare

1. Acesse [cloudflare.com](https://cloudflare.com)
2. Crie uma conta ou faça login
3. Anote seu **Account ID** (encontrado no dashboard)

### 2. Configurar API Token

1. Vá para **My Profile** > **API Tokens**
2. Clique em **Create Token**
3. Use o template **Custom token**
4. Configure as permissões:
   - **Account** > **Cloudflare Stream** > **Edit**
   - **Zone** > **Zone** > **Read** (opcional)
5. Salve o token gerado

### 3. Configurar variáveis de ambiente

#### No Vercel Dashboard:

1. Acesse seu projeto no [Vercel Dashboard](https://vercel.com/dashboard)
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:

```env
# Cloudflare Realtime SFU Configuration
# Obtenha essas credenciais em: Cloudflare Dashboard > Realtime > SFU
CLOUDFLARE_APP_ID=seu_app_id_aqui
CLOUDFLARE_APP_SECRET=seu_app_secret_aqui

# Optional: Custom RTC API URL (defaults to Cloudflare's API)
CLOUDFLARE_RTC_URL=https://rtc.live.cloudflare.com/v1

# JWT Secret para tokens de autenticação (opcional)
JWT_SECRET=sua_chave_secreta_aqui
```

#### Como obter as credenciais do Cloudflare:

1. **Acesse o Cloudflare Dashboard**
2. **Vá para Realtime** → **SFU**
3. **Crie um novo App** ou use um existente
4. **Copie o App ID e App Secret**

#### ⚠️ Importante:
- Certifique-se de que as variáveis estão configuradas para **Production**, **Preview** e **Development**
- Após adicionar as variáveis, faça um novo **deploy** do projeto
- Verifique os logs do Vercel para confirmar que as variáveis estão sendo carregadas

## Arquitetura do Sistema

```
Frontend (React)
    ↓ WebRTC + Cloudflare STUN
Cloudflare Realtime SFU
    ↓ Sinalização
Centrifugo (WebSocket)
    ↓ API Calls
Backend (Next.js)
```

## Fluxo de Chamada (Modelo de Sala)

### 1. Criar Sala de Chamada
1. Usuário A clica em "🏠 Criar Sala" no chat
2. Frontend chama `/api/start-call`
3. Backend cria sessão no Cloudflare Realtime SFU
4. Usuário A entra automaticamente na sala
5. Sistema envia notificação para Usuário B: "Sala de Chamada Disponível"

### 2. Entrar na Sala
1. Usuário B recebe notificação: "Usuário A criou uma sala de vídeo. Clique para entrar!"
2. Usuário B clica em "🚪 Entrar na Sala"
3. Frontend chama `/api/accept-call`
4. Usuário B entra na sala existente
5. Ambos os usuários estão conectados via WebRTC

### 3. Durante a Chamada
1. Usuários podem mutar/desmutar áudio
2. Usuários podem ligar/desligar vídeo
3. Usuários podem compartilhar tela
4. Sistema gerencia conexões WebRTC automaticamente

### 4. Vantagens do Modelo de Sala
- ✅ **Sem spam**: Apenas uma notificação por sala criada
- ✅ **Flexível**: Usuário B pode entrar quando quiser
- ✅ **Intuitivo**: Interface clara de "criar sala" vs "entrar na sala"
- ✅ **Persistente**: Sala fica disponível até ser fechada

## APIs Implementadas

### POST /api/start-call
Inicia uma nova chamada.

**Request:**
```json
{
  "conversationId": "conv_123",
  "callerId": "userA",
  "calleeId": "userB"
}
```

**Response:**
```json
{
  "success": true,
  "roomId": "call_conv_123_1234567890",
  "callerToken": "jwt_token_here",
  "calleeToken": "jwt_token_here",
  "expires": 1234567890000
}
```

### POST /api/accept-call
Aceita uma chamada existente.

**Request:**
```json
{
  "roomId": "call_conv_123_1234567890",
  "userId": "userB",
  "conversationId": "conv_123"
}
```

**Response:**
```json
{
  "success": true,
  "roomId": "call_conv_123_1234567890",
  "token": "jwt_token_here",
  "expires": 1234567890000
}
```

### POST /api/end-call
Encerra uma chamada.

**Request:**
```json
{
  "roomId": "call_conv_123_1234567890",
  "userId": "userA",
  "conversationId": "conv_123"
}
```

## Componentes Frontend

### useCall Hook
Gerencia estado e lógica WebRTC:
- Conexão peer-to-peer
- Captura de mídia
- Controles de áudio/vídeo
- Compartilhamento de tela

### CallInterface Component
Interface de usuário para chamadas:
- Botões de controle
- Visualização de vídeo
- Modal de chamada recebida

### Integração no ChatInterface
- Botão "Ligar" em conversas 1:1
- Notificações de chamada recebida
- Estado de chamada ativa

## Recursos Implementados

### ✅ Funcionalidades Básicas
- [x] Chamadas 1:1 (áudio + vídeo)
- [x] Sinalização via Centrifugo
- [x] Tokens JWT para autenticação
- [x] Interface de usuário responsiva
- [x] Controles de áudio/vídeo
- [x] Notificações de chamada

### ✅ Recursos Avançados
- [x] Compartilhamento de tela
- [x] Mute/unmute
- [x] Ligar/desligar câmera
- [x] Estados de chamada (calling, ringing, connected)
- [x] Cleanup automático

### 🔄 Próximos Passos (Futuro)
- [ ] Chamadas em grupo
- [x] Gravação de chamadas
- [ ] Controle de qualidade adaptativa
- [ ] Presença em tempo real
- [ ] Histórico de chamadas

## Custos

### Cloudflare SFU
- **Gratuito** até 1 TB/mês de egress
- **$0.10/GB** após o limite gratuito
- **$0.50/GB** para gravações

### Centrifugo
- **Gratuito** (já configurado)
- Sem custo adicional para sinalização

### Estimativa de Uso
- 1 chamada de 1 hora = ~100MB
- 1 TB = ~10.000 horas de chamadas
- Custo mensal: **$0** até 1 TB

## Troubleshooting

### Problemas Comuns

1. **Erro de permissão de câmera/microfone**
   - Verifique se o site tem permissão
   - Use HTTPS (obrigatório para WebRTC)

2. **Falha na conexão WebRTC**
   - Verifique configuração de STUN/TURN
   - Teste em rede local primeiro

3. **Token JWT inválido**
   - Verifique `CLOUDFLARE_API_TOKEN`
   - Confirme Account ID correto

4. **Centrifugo não conecta**
   - Verifique `CENTRIFUGO_WS_URL`
   - Confirme token de autenticação

### Logs de Debug

Ative logs detalhados no console:
```javascript
// No useCall hook
console.log('WebRTC connection state:', peerConnection.connectionState);
console.log('Call status:', callStatus);
```

## Segurança

### Tokens JWT
- Expiração de 1 hora
- Claims específicos por usuário
- Validação no backend

### Permissões de Canal
- Apenas participantes da conversa
- Validação de room ID
- Cleanup automático

### WebRTC
- Conexões criptografadas
- Sem armazenamento de mídia
- Controle de permissões do navegador

## Troubleshooting

### Erro: "SDP contains no ice-ufrag. Please ensure the SDP is valid."
- **Causa**: O SDP estava vazio e precisa conter campos obrigatórios como `ice-ufrag`, `ice-pwd`, etc.
- **Solução**: ✅ Corrigido automaticamente - o sistema agora gera um SDP válido com todos os campos necessários

### Erro: "Body JSON validation error: sessionDescription"
- **Causa**: A API do Cloudflare Realtime SFU espera um campo `sessionDescription` no body da requisição
- **Solução**: ✅ Corrigido automaticamente - o sistema agora envia o payload correto

### Erro: "Invalid bearer token"
- **Causa**: Variáveis de ambiente `CLOUDFLARE_APP_ID` e `CLOUDFLARE_APP_SECRET` não configuradas
- **Solução**: Configure as variáveis no Vercel Dashboard e faça um novo deploy

### Debug Logs
O sistema agora inclui logs detalhados para debug:
- 🔧 Status das variáveis de ambiente
- 📦 Payload da requisição
- ✅ Resposta da API
- ❌ Erros detalhados

Verifique os logs do Vercel para diagnosticar problemas.

## Monitoramento

### Métricas Importantes
- Taxa de sucesso de chamadas
- Latência de conexão
- Qualidade de áudio/vídeo
- Uso de largura de banda

### Alertas Recomendados
- Falhas de autenticação > 5%
- Latência > 500ms
- Uso de banda > 80% do limite

---

**Nota:** Este sistema está otimizado para chamadas 1:1. Para chamadas em grupo, será necessário implementar lógica adicional de gerenciamento de múltiplos peers.
