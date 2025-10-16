# Sistema de Avisos - Configuração e Uso

## Visão Geral
Foi implementado um sistema de avisos oficiais para os feeds do Vixter React. Os avisos são posts especiais que apenas administradores podem criar e que geram notificações para todos os usuários.

## Funcionalidades Implementadas

### 1. Nova Tab "Avisos"
- Adicionada uma nova tab "Avisos" em todos os feeds (Lobby, Vixies, Vixink)
- Tab com ícone de megafone (bullhorn) para fácil identificação
- Visual diferenciado com bordas douradas para destacar avisos oficiais

### 2. Sistema de Permissões
- Apenas usuários com `admin = true` no perfil podem criar avisos
- Verificação automática da flag admin no Firebase
- Flag admin só pode ser ativada manualmente no Firebase (não há interface de registro)

### 3. Notificações Automáticas
- Quando um admin cria um aviso, todos os usuários recebem uma notificação
- Notificação no formato: "Novo aviso no [Lobby/Vixies/Vixink]"
- Notificações aparecem no centro de notificações com ícone de megafone dourado

### 4. Armazenamento de Dados
- Avisos do Lobby: `announcements` no Realtime Database
- Avisos do Vixies: `vixies_announcements` no Realtime Database  
- Avisos do Vixink: `vixink_announcements` no Realtime Database

## Como Configurar um Usuário como Admin

### Via Firebase Console:
1. Acesse o Firebase Console
2. Vá para Firestore Database
3. Navegue para a coleção `users`
4. Encontre o documento do usuário pelo UID
5. Adicione o campo `admin: true` (boolean)
6. Salve as alterações

### Estrutura do Documento:
```json
{
  "uid": "user_uid_here",
  "displayName": "Nome do Usuário",
  "email": "email@example.com",
  "admin": true,  // ← Campo adicionado manualmente
  // ... outros campos do perfil
}
```

## Arquivos Criados/Modificados

### Novos Arquivos:
- `src/hooks/useAdminStatus.js` - Hook para verificar se usuário é admin
- `src/components/AnnouncementsTab.jsx` - Componente da tab de avisos
- `src/components/AnnouncementsTab.css` - Estilos para avisos

### Arquivos Modificados:
- `src/services/notificationService.js` - Adicionada função de notificação de avisos
- `src/components/NotificationCenter.jsx` - Suporte a notificações de avisos
- `src/pages/Feed.jsx` - Integração da tab de avisos no Lobby
- `src/pages/Vixies.jsx` - Integração da tab de avisos no Vixies
- `src/pages/Vixink.jsx` - Integração da tab de avisos no Vixink

## Como Usar

### Para Administradores:
1. Faça login com uma conta que tenha `admin: true`
2. Acesse qualquer feed (Lobby, Vixies ou Vixink)
3. Clique na tab "Avisos"
4. Clique no botão "Criar Aviso"
5. Escreva o aviso (pode incluir texto e mídia)
6. Publique o aviso

### Para Usuários:
1. Acesse qualquer feed
2. Clique na tab "Avisos" para ver avisos oficiais
3. Receba notificações automáticas quando novos avisos forem criados
4. Visualize avisos com destaque visual especial

## Características Técnicas

- **Responsivo**: Funciona em desktop e mobile
- **Real-time**: Atualizações em tempo real via Firebase
- **Seguro**: Apenas admins podem criar avisos
- **Notificações**: Sistema integrado com notificações existentes
- **Mídia**: Suporte a imagens e vídeos nos avisos
- **Design**: Visual consistente com o tema do projeto

## Notas Importantes

1. A flag `admin` deve ser definida manualmente no Firebase
2. Não há interface para gerenciar admins no frontend (por segurança)
3. Avisos são separados por feed (cada feed tem seus próprios avisos)
4. Notificações são enviadas para TODOS os usuários quando um aviso é criado
5. O sistema usa o mesmo PostCreator existente, mas com validações especiais para admins
