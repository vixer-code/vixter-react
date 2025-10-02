# Guia de Atualização de Versão

## Visão Geral

Este sistema implementa uma funcionalidade para detectar automaticamente quando uma nova versão da aplicação está disponível e notificar o usuário para recarregar a página.

## Como Funciona

### 1. Detecção de Versão (`useVersionCheck.js`)
- Compara o timestamp de modificação do arquivo principal com uma versão armazenada no localStorage
- Verifica atualizações automaticamente a cada 5 minutos
- Verifica atualizações quando a página ganha foco (usuário volta para a aba)
- Armazena a versão atual no localStorage na primeira execução

### 2. Interface de Notificação (`UpdateNotification.jsx`)
- Modal elegante com design responsivo
- Suporte a modo escuro automático
- Animações suaves de entrada
- Botões para recarregar ou adiar a atualização

### 3. Integração no App
- Hook integrado no componente principal da aplicação
- Modal aparece automaticamente quando uma atualização é detectada
- Não interfere com outras funcionalidades da aplicação

## Arquivos Criados/Modificados

- `src/hooks/useVersionCheck.js` - Hook para detecção de versão
- `src/components/UpdateNotification.jsx` - Componente do modal de atualização
- `src/components/UpdateNotification.css` - Estilos do modal (seguindo o design system do Vixter)
- `src/App.jsx` - Integração da funcionalidade

## Design System

O modal segue o padrão visual do Vixter:
- **Cores principais**: Gradiente roxo (#8A2BE2) para ciano (#00FFCA)
- **Fundo**: Gradiente escuro (#1A1A2E → #16213E → #0F0F1A)
- **Tipografia**: Gradiente de texto com as cores da marca
- **Bordas**: Bordas sutis com rgba(255, 255, 255, 0.1)
- **Sombras**: Sombras profundas com blur para profundidade
- **Animações**: Transições suaves e efeitos hover consistentes

## Como Testar

### Método 1: Simulação Manual
1. Abra o DevTools do navegador
2. Execute o script `test-mobile-update.js` no console
3. Use `simulateVersionUpdate()` para simular mudança
4. O modal deve aparecer imediatamente

### Método 2: Deploy Real
1. Faça um deploy da aplicação
2. Acesse a versão antiga em uma aba
3. Faça uma nova versão com mudanças
4. Acesse a nova versão em outra aba
5. Volte para a aba da versão antiga
6. O modal deve aparecer automaticamente

### Método 3: Teste Mobile
1. Use o DevTools para simular dispositivos móveis
2. Execute `testMobileModal()` no console
3. Teste diferentes tamanhos de tela
4. Verifique a responsividade do modal

### Método 4: Debug Completo
1. Execute `debugVersion()` no console
2. Verifique informações de versão e headers
3. Confirme se a detecção está funcionando

## Personalização

### Alterar Intervalo de Verificação
```javascript
// Em useVersionCheck.js, linha ~45
const interval = setInterval(checkForUpdates, 5 * 60 * 1000); // 5 minutos
```

### Personalizar Mensagem
```javascript
// Em UpdateNotification.jsx
<h2 className="update-notification-title">
  Sua mensagem personalizada aqui
</h2>
```

### Alterar Estilos
Modifique o arquivo `UpdateNotification.css` para personalizar:
- Cores do tema
- Animações
- Layout responsivo
- Modo escuro

## Melhorias para Mobile

### Design Responsivo
- **Layout Mobile-First**: Modal otimizado para telas pequenas
- **Animação Slide-Up**: Entrada suave de baixo para cima no mobile
- **Touch-Friendly**: Botões maiores e área de toque adequada
- **Safe Areas**: Respeita áreas seguras do iPhone (notch, home indicator)

### Detecção Aprimorada
- **Visibility API**: Detecta quando app volta do background
- **Service Worker**: Suporte para PWA e cache
- **Múltiplos Headers**: Usa ETag e Last-Modified para maior precisão
- **Fallback Robusto**: Sistema de backup em caso de erro

### Performance Mobile
- **Touch Actions**: Otimizado para gestos de toque
- **Overscroll Behavior**: Previne scroll indesejado
- **Hardware Acceleration**: Usa transform3d para animações suaves

## Benefícios

1. **Experiência do Usuário**: Elimina a tela cinza sem feedback
2. **Atualizações Automáticas**: Detecta mudanças sem intervenção manual
3. **Não Intrusivo**: Permite ao usuário escolher quando atualizar
4. **Responsivo**: Funciona perfeitamente em todos os dispositivos
5. **Acessível**: Suporte a leitores de tela e navegação por teclado
6. **Mobile-Optimized**: Especialmente otimizado para dispositivos móveis

## Considerações Técnicas

- Usa localStorage para persistir a versão entre sessões
- Implementa fallback para casos de erro na verificação
- Não afeta a performance da aplicação
- Compatível com Service Workers (se implementados)
- Funciona com cache do navegador

## Troubleshooting

### Modal não aparece
- Verifique se o localStorage está habilitado
- Confirme que não há erros no console
- Teste removendo manualmente a chave `app-version`

### Verificação muito frequente
- Ajuste o intervalo no hook
- Considere implementar debounce se necessário

### Problemas de estilo
- Verifique se o CSS está sendo importado corretamente
- Confirme que não há conflitos com outros estilos
