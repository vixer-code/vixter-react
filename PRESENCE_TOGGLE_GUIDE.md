# Guia da Funcionalidade de Presença Manual

## Visão Geral

Foi implementada uma funcionalidade que permite ao usuário definir manualmente seu status de presença (online/offline) no sidebar-header da mensageria. Quando o usuário escolhe ficar offline, sua presença será totalmente ignorada e ele será tratado como offline permanentemente até que escolha mudar o status.

## Como Funciona

### 1. Interface do Usuário
- **Localização**: Sidebar-header da mensageria (`src/pages/EnhancedMessages.jsx`)
- **Componente**: Botão de toggle com indicador visual
- **Estados Visuais**:
  - 🟢 **Online**: Botão verde com texto "Online"
  - 🔴 **Offline**: Botão vermelho com texto "Offline"

### 2. Lógica de Presença

#### Status Automático vs Manual
- **Automático**: Sistema define status baseado na conexão e visibilidade da página
- **Manual**: Usuário define explicitamente seu status através do botão

#### Comportamento do Sistema
1. **Quando usuário está online automaticamente**:
   - Sistema detecta conexão e define como "online"
   - Usuário pode escolher ficar "offline" manualmente
   - Status manual tem prioridade sobre automático

2. **Quando usuário escolhe ficar offline**:
   - Status é definido como "offline" com flag `manual: true`
   - Sistema não altera automaticamente para "online"
   - Usuário permanece offline até escolher voltar online

3. **Quando usuário escolhe voltar online**:
   - Status é definido como "online" com flag `manual: false`
   - Sistema volta a gerenciar automaticamente o status

### 3. Implementação Técnica

#### Arquivos Modificados
- `src/pages/EnhancedMessages.jsx`: Interface do usuário
- `src/pages/EnhancedMessages.css`: Estilos do botão
- `src/contexts/StatusContext.jsx`: Lógica de presença

#### Estrutura de Dados
```javascript
// Firebase Realtime Database
status/{userId}: {
  state: 'online' | 'offline',
  last_changed: timestamp,
  manual: true | false  // Flag para indicar se é manual
}

users/{userId}/selectedStatus: 'online' | 'offline'
```

#### Funções Principais
- `handlePresenceToggle()`: Alterna status entre online/offline
- `updateUserStatus()`: Atualiza status no Firebase
- Lógica de conexão modificada para respeitar status manual

### 4. Fluxo de Funcionamento

```
1. Usuário clica no botão de presença
   ↓
2. handlePresenceToggle() é chamado
   ↓
3. updateUserStatus() atualiza Firebase
   ↓
4. Status é salvo com flag 'manual: true'
   ↓
5. Sistema respeita status manual
   ↓
6. Outros usuários veem o status correto
```

### 5. Casos de Uso

#### Cenário 1: Usuário Online Normal
- Sistema detecta conexão → define como "online"
- Usuário pode escolher ficar "offline" se desejar
- Status automático funciona normalmente

#### Cenário 2: Usuário Escolhe Ficar Offline
- Usuário clica para ficar offline
- Status é definido como "offline" com flag manual
- Sistema não altera automaticamente para online
- Usuário permanece offline até escolher voltar

#### Cenário 3: Usuário Volta Online
- Usuário clica para voltar online
- Status é definido como "online" com flag manual: false
- Sistema volta a gerenciar automaticamente

### 6. Benefícios

1. **Controle Total**: Usuário tem controle completo sobre sua presença
2. **Privacidade**: Pode escolher aparecer offline mesmo estando conectado
3. **Flexibilidade**: Pode alternar entre automático e manual conforme necessário
4. **Persistência**: Status manual é mantido até ser alterado pelo usuário

### 7. Considerações Técnicas

- **Performance**: Uso mínimo de recursos, apenas atualizações no Firebase
- **Sincronização**: Status é sincronizado em tempo real entre dispositivos
- **Fallback**: Se houver erro, sistema volta ao comportamento padrão
- **Responsivo**: Interface adapta-se a diferentes tamanhos de tela

## Testando a Funcionalidade

1. Acesse a página de mensagens
2. Observe o botão de presença no header do sidebar
3. Clique para alternar entre online/offline
4. Verifique se o status é mantido mesmo ao navegar pela aplicação
5. Teste em diferentes dispositivos para verificar sincronização
