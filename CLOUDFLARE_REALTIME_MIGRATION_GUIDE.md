# 🔧 Guia de Migração: Correção do RealtimeKit

## ❌ Problema Identificado

Você estava usando o **RealtimeKit** (`@cloudflare/realtimekit`) mas com implementação incorreta. O erro ocorria porque:

1. **Token inválido**: O backend estava gerando tokens para Cloudflare Realtime API, mas o frontend usava RealtimeKit SDK
2. **Implementação incorreta**: Não estava seguindo a documentação oficial do RealtimeKit

### Erro:
```
DyteError: [ERR0004]: {DyteClient} Invalid auth token
```

## ✅ Solução Implementada

### 1. **Hook Corrigido: `useCloudflareRealtimeCall`**
- Usa `useRealtimeKitClient` do `@cloudflare/realtimekit-react`
- Segue a documentação oficial do RealtimeKit
- Implementação correta de eventos e callbacks

### 2. **Componente com RealtimeKitProvider**
- Implementa `RealtimeKitProvider` conforme documentação
- Usa `RtkMeeting` para UI completa
- Integração correta com backend

## 🚀 Como Migrar

### Passo 1: Instalar Dependências Corretas
```bash
# Instalar RealtimeKit oficial
npm install @cloudflare/realtimekit-react @cloudflare/realtimekit-react-ui

# Remover dependências antigas se existirem
npm uninstall @cloudflare/realtimekit
```

### Passo 2: Usar Componente Correto
```jsx
// ❌ Antes (implementação incorreta)
import useRealtimeKitCall from '../hooks/useRealtimeKitCall';

// ✅ Depois (implementação correta)
import CloudflareRealtimeCall from '../components/CloudflareRealtimeCall';
```

### Passo 3: Verificar Variáveis de Ambiente
Certifique-se de que no Vercel você tem:
```env
CLOUDFLARE_APP_ID=your_app_id
CLOUDFLARE_APP_SECRET=your_app_secret
```

### Passo 4: Usar o Componente Correto
```jsx
// Em vez de CallInterface, use:
<CloudflareRealtimeCall 
  conversation={conversation} 
  onClose={handleClose} 
/>
```

## 🔍 Diferenças Principais

### Implementação Incorreta (❌ Antes)
```jsx
// Hook personalizado com implementação incorreta
const meeting = await RealtimeKit.init({
  authToken: token,  // Token inválido
  defaults: { audio: true, video: true }
});
```

### RealtimeKit Oficial (✅ Implementado)
```jsx
// Usando hooks oficiais do RealtimeKit
import { useRealtimeKitClient, RealtimeKitProvider } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';

const [meeting, initMeeting] = useRealtimeKitClient();

await initMeeting({
  authToken: token,  // Token correto do backend
  defaults: { audio: true, video: true }
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

### Token Inválido (RESOLVIDO ✅)
- **Problema**: `DyteError: [ERR0004]: Invalid auth token`
- **Causa**: Event listeners configurados antes do meeting estar disponível
- **Solução**: Movido configuração de event listeners para useEffect que monitora o meeting

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