# Sistema de Elos - Vixter

## 📋 Visão Geral

O sistema de elos foi implementado para gamificar a experiência dos usuários na plataforma Vixter, representando seu nível de engajamento e atividade através de diferentes níveis de elos.

## 🏆 Elos Disponíveis

### 1. Ferro
- **Ordem**: 1
- **Descrição**: Início da jornada
- **Cor**: #8B4513
- **Imagem**: `/images/iron.png`
- **Requisitos**: Todos os usuários começam com este elo

### 2. Bronze
- **Ordem**: 2
- **Descrição**: Primeiros passos
- **Cor**: #CD7F32
- **Imagem**: `/images/bronze.png`
- **Requisitos**:
  - **Clientes**: 1 pack comprado, 1000 VP gastos
  - **Provedores**: 1 pack vendido, 10 VC ganhos

### 3. Prata
- **Ordem**: 3
- **Descrição**: Crescimento constante
- **Cor**: #C0C0C0
- **Imagem**: `/images/silver.png`
- **Requisitos**:
  - **Clientes**: 3 packs comprados, 2 serviços comprados, 5000 VP gastos, 100 VP em gorjetas
  - **Provedores**: 5 packs vendidos, 3 serviços vendidos, 200 VP em gorjetas recebidas, 100 VC ganhos

### 4. Ouro
- **Ordem**: 4
- **Descrição**: Excelência em atividade
- **Cor**: #FFD700
- **Imagem**: `/images/gold.png`
- **Requisitos**:
  - **Clientes**: 8 packs comprados, 5 serviços comprados, 15000 VP gastos, 500 VP em gorjetas
  - **Provedores**: 15 packs vendidos, 10 serviços vendidos, 1000 VP em gorjetas recebidas, 500 VC ganhos

### 5. Platina
- **Ordem**: 5
- **Descrição**: Dedicação exemplar
- **Cor**: #E5E4E2
- **Imagem**: `/images/platinum.png`
- **Requisitos**:
  - **Clientes**: 20 packs comprados, 15 serviços comprados, 35000 VP gastos, 1500 VP em gorjetas
  - **Provedores**: 40 packs vendidos, 25 serviços vendidos, 3000 VP em gorjetas recebidas, 1500 VC ganhos

### 6. Esmeralda
- **Ordem**: 6
- **Descrição**: Maestria em engajamento
- **Cor**: #50C878
- **Imagem**: `/images/emerald.png`
- **Requisitos**:
  - **Clientes**: 50 packs comprados, 35 serviços comprados, 75000 VP gastos, 4000 VP em gorjetas
  - **Provedores**: 100 packs vendidos, 60 serviços vendidos, 8000 VP em gorjetas recebidas, 4000 VC ganhos

### 7. Diamante
- **Ordem**: 7
- **Descrição**: Elite da plataforma
- **Cor**: #B9F2FF
- **Imagem**: `/images/diamond.png`
- **Requisitos**:
  - **Clientes**: 100 packs comprados, 75 serviços comprados, 150000 VP gastos, 10000 VP em gorjetas
  - **Provedores**: 250 packs vendidos, 150 serviços vendidos, 20000 VP em gorjetas recebidas, 10000 VC ganhos

### 8. Mestre
- **Ordem**: 8
- **Descrição**: Lenda da comunidade
- **Cor**: #800080
- **Imagem**: `/images/master.png`
- **Requisitos**:
  - **Clientes**: 200 packs comprados, 150 serviços comprados, 300000 VP gastos, 25000 VP em gorjetas
  - **Provedores**: 500 packs vendidos, 300 serviços vendidos, 50000 VP em gorjetas recebidas, 25000 VC ganhos

## 🔧 Funcionalidades Implementadas

### 1. Cloud Functions
- `initializeEloConfig`: Inicializa as configurações dos elos no banco de dados
- `updateEloConfig`: Atualiza as configurações dos elos
- `getEloConfig`: Obtém as configurações dos elos
- `calculateUserElo`: Calcula o elo atual do usuário baseado nas métricas
- `updateUserElo`: Atualiza o elo do usuário no documento do usuário
- `getUserElo`: Obtém informações do elo de um usuário

### 2. Métricas Rastreadas

#### Para Clientes (accountType = 'client'):
- `totalSpent`: Total de VP gastos
- `totalPacksBought`: Total de packs comprados
- `totalServicesBought`: Total de serviços comprados
- `totalVixtipsSent`: Total de gorjetas enviadas
- `totalVixtipsSentAmount`: Valor total das gorjetas enviadas em VP

#### Para Provedores (accountType = 'provider'):
- `totalPacksSold`: Total de packs vendidos
- `totalServicesSold`: Total de serviços vendidos
- `totalSales`: Total de vendas (packs + serviços)
- `totalPosts`: Total de posts criados
- `totalPostsVixies`: Total de posts Vixies
- `totalPostsFeed`: Total de posts no feed geral
- `totalPostsVixink`: Total de posts Vixink
- `totalVixtipsReceived`: Total de gorjetas recebidas
- `totalVixtipsReceivedAmount`: Valor total das gorjetas recebidas em VP
- `totalVcEarned`: Total de VC ganho (nova métrica)

### 3. Atualização Automática
- As métricas são atualizadas automaticamente quando:
  - Um pack é vendido/comprado
  - Um serviço é vendido/comprado
  - Uma gorjeta é enviada/recebida
  - Um post é criado
- O elo é recalculado automaticamente após cada atualização de métricas

### 4. Interface do Usuário
- **EloBadge**: Componente para exibir o elo do usuário com imagens
- **EloDetails**: Componente para exibir informações detalhadas do elo
- **EloList**: Componente para exibir todos os elos disponíveis
- **EloSystem**: Página completa do sistema de elos
- **Painel de Administração**: Interface para gerenciar configurações dos elos

### 5. Sistema de Imagens
- **Imagens Personalizadas**: Cada elo possui uma imagem única em `/public/images/`
- **Fallback Automático**: Se a imagem não carregar, exibe a primeira letra do elo
- **Responsivo**: Imagens se adaptam aos diferentes tamanhos de badge
- **Otimizado**: Imagens são carregadas de forma eficiente com lazy loading

## 🚀 Como Usar

### 1. Inicialização
Para inicializar o sistema de elos pela primeira vez:

```javascript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const initializeEloConfig = httpsCallable(functions, 'initializeEloConfig');
const result = await initializeEloConfig();
```

### 2. Exibir Elo do Usuário
```jsx
import { EloBadge } from '../components/EloBadge';

// Badge simples com imagem
<EloBadge userId={userId} />

// Badge com progresso e imagem
<EloBadge userId={userId} showProgress={true} />

// Badge grande com imagem
<EloBadge userId={userId} size="large" />

// Badge pequeno para header/navbar
<EloBadge userId={userId} size="small" className="header-elo-badge" />
```

### 3. Exibir Detalhes do Elo
```jsx
import { EloDetails } from '../components/EloBadge';

<EloDetails userId={userId} />
```

### 4. Usar Hook de Elo
```jsx
import { useUserElo } from '../hooks/useElo';

const { userElo, loading, error, calculateUserElo, updateUserElo } = useUserElo(userId);
```

## 📊 Estrutura de Dados

### Documento do Usuário
```javascript
{
  // ... outros campos do usuário
  stats: {
    // Métricas do usuário
    totalSpent: 0,
    totalPacksBought: 0,
    // ... outras métricas
  },
  elo: {
    current: 'ferro',
    name: 'Ferro',
    order: 1,
    benefits: {
      badgeColor: '#8B4513',
      description: 'Início da jornada',
      imageUrl: '/images/iron.png'
    },
    lastUpdated: timestamp
  }
}
```

### Configurações dos Elos
```javascript
{
  config: {
    ferro: {
      name: 'Ferro',
      order: 1,
      requirements: {
        client: { /* requisitos para clientes */ },
        provider: { /* requisitos para provedores */ }
      },
      benefits: {
        badgeColor: '#8B4513',
        description: 'Início da jornada',
        imageUrl: '/images/iron.png'
      }
    },
    // ... outros elos
  },
  lastUpdated: timestamp,
  version: '1.0.0'
}
```

## 🔄 Atualizações Automáticas

O sistema atualiza automaticamente as métricas e recalcula o elo quando:

1. **Venda de Pack**: Incrementa `totalPacksSold` e `totalVcEarned` para o vendedor
2. **Compra de Pack**: Incrementa `totalPacksBought` e `totalSpent` para o comprador
3. **Venda de Serviço**: Incrementa `totalServicesSold` e `totalVcEarned` para o vendedor
4. **Compra de Serviço**: Incrementa `totalServicesBought` e `totalSpent` para o comprador
5. **Envio de Gorjeta**: Incrementa `totalVixtipsSent` e `totalVixtipsSentAmount` para o remetente
6. **Recebimento de Gorjeta**: Incrementa `totalVixtipsReceived`, `totalVixtipsReceivedAmount` e `totalVcEarned` para o destinatário
7. **Criação de Post**: Incrementa as métricas de posts apropriadas

## 🎯 Benefícios do Sistema

1. **Gamificação**: Motiva os usuários a serem mais ativos na plataforma
2. **Reconhecimento**: Diferencia usuários com diferentes níveis de engajamento
3. **Retenção**: Incentiva o uso contínuo da plataforma
4. **Flexibilidade**: Configurações podem ser ajustadas sem alterar código
5. **Transparência**: Usuários podem ver seu progresso e próximos objetivos

## 🔧 Manutenção

### Atualizar Configurações
As configurações dos elos podem ser atualizadas através da interface de administração ou diretamente no banco de dados na coleção `systemConfig` no documento `eloConfig`.

### Monitoramento
O sistema registra logs detalhados de todas as operações para facilitar o debug e monitoramento.

### Performance
- As funções são otimizadas para performance com timeouts apropriados
- O cálculo de elos é feito de forma eficiente usando índices
- As atualizações são feitas em lote quando possível
