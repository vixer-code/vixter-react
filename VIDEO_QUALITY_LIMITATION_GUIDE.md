# Guia de Limitação de Qualidade de Vídeo por Account Type

## 📋 Visão Geral

Este guia documenta como implementar limitação de qualidade de transmissão de vídeo baseada no `accountType` do usuário, permitindo a monetização através de um plano "Nitro" para assistir em Full HD.

## 🎯 Objetivo

- **Usuários `client` (gratuito)**: Limitados a qualidade SD (480p)
- **Usuários `provider` ou com "Nitro"**: Acesso a Full HD (1080p)

## 🏗️ Arquitetura

### 1. **Backend: Configuração de Presets**

A limitação de qualidade deve ser configurada nos **Presets** do Cloudflare Realtime.

#### Criar Preset para Clientes (SD)
```bash
curl --request POST \
  --url https://api.realtime.cloudflare.com/v2/presets \
  --header 'Authorization: Basic YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "group_call_participant_sd",
  "video": {
    "codec": "H264",
    "max_resolution": {
      "width": 640,
      "height": 480
    },
    "max_framerate": 24,
    "max_bitrate": 500000
  },
  "audio": {
    "codec": "opus",
    "max_bitrate": 64000
  }
}'
```

#### Criar Preset para Providers/Nitro (Full HD)
```bash
curl --request POST \
  --url https://api.realtime.cloudflare.com/v2/presets \
  --header 'Authorization: Basic YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "group_call_host_hd",
  "video": {
    "codec": "H264",
    "max_resolution": {
      "width": 1920,
      "height": 1080
    },
    "max_framerate": 30,
    "max_bitrate": 2500000
  },
  "audio": {
    "codec": "opus",
    "max_bitrate": 128000
  }
}'
```

### 2. **Backend: Lógica de Seleção de Preset**

Atualizar `backend/lib/cloudflare-sfu.js`:

```javascript
async function getRealtimeAuthToken(userId, roomId, presetName = 'group_call_participant', username = null, accountType = 'client', hasNitro = false) {
  // Determinar preset baseado em accountType e Nitro
  let finalPresetName = presetName;
  
  if (accountType === 'provider' || hasNitro) {
    // Provider ou usuário com Nitro: Full HD
    finalPresetName = presetName.includes('host') ? 'group_call_host_hd' : 'group_call_participant_hd';
  } else {
    // Client sem Nitro: SD
    finalPresetName = presetName.includes('host') ? 'group_call_host_sd' : 'group_call_participant_sd';
  }
  
  console.log(`🎬 Using preset: ${finalPresetName} for user ${userId} (accountType: ${accountType}, hasNitro: ${hasNitro})`);
  
  // ... resto do código
  const participant = await addParticipantToMeeting(meetingId, userId, roomId, finalPresetName, username);
  // ...
}
```

### 3. **Backend: API Endpoint**

Atualizar `backend/app/api/rooms/[roomId]/join/route.ts`:

```typescript
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const { userId, conversationId, role = 'participant', accountType, username, hasNitro = false } = await request.json();
  
  // ... código existente ...
  
  // Passar hasNitro para getRealtimeAuthToken
  const authTokenData = await getRealtimeAuthToken(
    userId, 
    roomId, 
    presetName, 
    username,
    finalAccountType,
    hasNitro  // ← Nova flag
  );
  
  return NextResponse.json({
    // ...
    qualityTier: (finalAccountType === 'provider' || hasNitro) ? 'hd' : 'sd'
  });
}
```

### 4. **Frontend: Adicionar Campo `hasNitro`**

Atualizar `src/components/CallInterface.jsx`:

```javascript
const getAuthToken = async () => {
  // ... código existente ...
  
  // Verificar se usuário tem Nitro
  const hasNitro = currentUser.hasNitro || currentUser.subscriptionTier === 'nitro' || false;
  
  const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.uid,
      conversationId: conversation.id,
      role: 'participant',
      accountType: userAccountType,
      username: currentUser.displayName || currentUser.email || `User ${currentUser.uid.substring(0, 8)}`,
      hasNitro: hasNitro  // ← Passar flag
    })
  });
  
  const data = await response.json();
  console.log('🎬 Quality tier:', data.qualityTier);
  
  // ... resto do código
};
```

### 5. **Frontend: UI para Upgrade**

Adicionar banner para upgrade quando qualidade é limitada:

```jsx
const RealtimeKitMeetingWrapper = ({ authToken, conversation, otherUser, onClose, isNewMeeting, qualityTier }) => {
  // ... código existente ...
  
  return (
    <div className="call-interface-inline">
      {/* Quality limitation banner */}
      {qualityTier === 'sd' && (
        <div className="quality-limitation-banner">
          <span>📺 Qualidade limitada a SD (480p)</span>
          <button onClick={() => window.open('/upgrade-nitro', '_blank')}>
            ⚡ Upgrade para Nitro e assista em Full HD
          </button>
        </div>
      )}
      
      {/* ... resto do componente ... */}
    </div>
  );
};
```

### 6. **Firestore: Adicionar Campo `hasNitro`**

Estrutura do documento do usuário:

```javascript
{
  uid: "user123",
  displayName: "John Doe",
  accountType: "client", // 'client' ou 'provider'
  hasNitro: false,       // ← Nova flag
  subscriptionTier: null, // null, 'nitro', 'premium', etc
  subscriptionExpiry: null, // Timestamp
  // ... outros campos
}
```

## 💰 Fluxo de Monetização

### 1. **Página de Upgrade**
- Criar `/pages/UpgradeNitro.jsx`
- Mostrar benefícios (Full HD, outras features)
- Integrar com Stripe ou outro gateway de pagamento

### 2. **Após Pagamento**
```javascript
// Cloud Function após pagamento confirmado
async function activateNitro(userId) {
  await db.collection('users').doc(userId).update({
    hasNitro: true,
    subscriptionTier: 'nitro',
    subscriptionExpiry: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
    )
  });
}
```

### 3. **Verificação de Expiração**
```javascript
// Hook para verificar se Nitro expirou
export const useNitroStatus = (user) => {
  const [hasActiveNitro, setHasActiveNitro] = useState(false);
  
  useEffect(() => {
    if (!user?.hasNitro) {
      setHasActiveNitro(false);
      return;
    }
    
    const checkExpiry = () => {
      const expiry = user.subscriptionExpiry?.toDate();
      const now = new Date();
      setHasActiveNitro(expiry && expiry > now);
    };
    
    checkExpiry();
    const interval = setInterval(checkExpiry, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [user]);
  
  return hasActiveNitro;
};
```

## 🎨 Estilos para Banner de Qualidade

Adicionar em `CallInterface.css`:

```css
.quality-limitation-banner {
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%);
  border-bottom: 1px solid rgba(255, 193, 7, 0.4);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
}

.quality-limitation-banner span {
  color: #ffc107;
  font-weight: 600;
}

.quality-limitation-banner button {
  background: linear-gradient(135deg, #00FFCA 0%, #8A2BE2 100%);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.quality-limitation-banner button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 255, 202, 0.4);
}
```

## 📊 Monitoramento

### Logs Importantes
```javascript
console.log('🎬 Quality tier assigned:', qualityTier);
console.log('📺 Preset used:', presetName);
console.log('💎 Has Nitro:', hasNitro);
console.log('👤 Account type:', accountType);
```

### Métricas a Acompanhar
- Número de usuários em SD vs HD
- Taxa de conversão para Nitro
- Uso de bandwidth por tier

## 🚀 Roadmap Futuro

1. **Tiers Adicionais**
   - `free`: 360p
   - `basic`: 480p (SD)
   - `nitro`: 1080p (Full HD)
   - `premium`: 4K

2. **Outras Limitações**
   - Duração máxima de chamada
   - Número de participantes
   - Gravação de chamadas
   - Compartilhamento de tela em HD

3. **Features Premium**
   - Filtros de vídeo
   - Backgrounds virtuais
   - Transcrição em tempo real
   - Gravação local

## 📚 Referências

- [Cloudflare Realtime Presets API](https://docs.realtime.cloudflare.com/api/?v=v2#/operations/create_preset)
- [Video Quality Settings](https://docs.realtime.cloudflare.com/guides/video-quality)
- [WebRTC Quality Control](https://webrtc.org/getting-started/media-constraints)

---

**Nota**: Esta implementação já considera a arquitetura atual do projeto e pode ser ativada gradualmente conforme a necessidade de monetização.

