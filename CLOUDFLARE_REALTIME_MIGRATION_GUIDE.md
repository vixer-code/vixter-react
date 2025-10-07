# 🔧 Guia de Migração: Dyte SDK → Cloudflare Realtime

## ❌ Problema Identificado

Você estava usando o **Dyte SDK** (`@cloudflare/realtimekit`) mas gerando tokens para **Cloudflare Realtime** diretamente. Estes são dois serviços diferentes!

### Erro:
```
DyteError: [ERR0004]: {DyteClient} Invalid auth token
```

## ✅ Solução Implementada

### 1. **Novo Hook: `useCloudflareRealtimeCall`**
- Substitui `useRealtimeKitCall`
- Usa Cloudflare Realtime API diretamente
- Implementação WebRTC nativa

### 2. **Backend Atualizado**
- Tokens corrigidos para Cloudflare Realtime
- Estrutura JWT adequada
- Comentários atualizados

## 🚀 Como Migrar

### Passo 1: Instalar Dependências
```bash
# Remover Dyte SDK (se não usado em outros lugares)
npm uninstall @cloudflare/realtimekit

# As dependências WebRTC já estão disponíveis no navegador
```

### Passo 2: Atualizar Componentes
```jsx
// ❌ Antes (Dyte SDK)
import useRealtimeKitCall from '../hooks/useRealtimeKitCall';

// ✅ Depois (Cloudflare Realtime)
import useCloudflareRealtimeCall from '../hooks/useCloudflareRealtimeCall';
```

### Passo 3: Verificar Variáveis de Ambiente
Certifique-se de que no Vercel você tem:
```env
CLOUDFLARE_APP_ID=your_app_id
CLOUDFLARE_APP_SECRET=your_app_secret
```

### Passo 4: Testar a Implementação
1. Use o componente `CallInterfaceExample.jsx` como referência
2. Teste a criação de chamadas
3. Verifique se os tokens são válidos

## 🔍 Diferenças Principais

### Dyte SDK (❌ Removido)
```jsx
const meeting = await RealtimeKit.init({
  authToken: token,  // Token específico do Dyte
  defaults: { audio: true, video: true }
});
```

### Cloudflare Realtime (✅ Implementado)
```jsx
// Cria sessão diretamente na API
const session = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/new`);

// Usa WebRTC nativo
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
});
```

## 🛠️ Próximos Passos

### 1. **Testar Localmente**
```bash
# Verificar se as variáveis estão configuradas
echo $CLOUDFLARE_APP_ID
echo $CLOUDFLARE_APP_SECRET
```

### 2. **Verificar Logs**
- Backend: Verificar se tokens são gerados corretamente
- Frontend: Verificar se sessões são criadas

### 3. **Implementar Funcionalidades Adicionais**
- Screen sharing
- Múltiplos participantes
- Gravação de chamadas

## 📋 Checklist de Migração

- [ ] Remover `@cloudflare/realtimekit` do package.json
- [ ] Substituir `useRealtimeKitCall` por `useCloudflareRealtimeCall`
- [ ] Atualizar componentes que usam o hook
- [ ] Verificar variáveis de ambiente no Vercel
- [ ] Testar criação de chamadas
- [ ] Testar entrada em chamadas existentes
- [ ] Verificar controle de áudio/vídeo
- [ ] Testar finalização de chamadas

## 🆘 Troubleshooting

### Token Inválido
- Verificar se `CLOUDFLARE_APP_ID` e `CLOUDFLARE_APP_SECRET` estão corretos
- Verificar se o token não expirou (1 hora de validade)

### Falha na Criação de Sessão
- Verificar conectividade com `rtc.live.cloudflare.com`
- Verificar se o App ID está correto

### Problemas de Mídia
- Verificar permissões de câmera/microfone
- Verificar se HTTPS está habilitado (requerido para WebRTC)

## 📚 Documentação Útil

- [Cloudflare Realtime API](https://developers.cloudflare.com/realtime/https-api/)
- [WebRTC MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Cloudflare Realtime Examples](https://github.com/cloudflare/calls-examples)
