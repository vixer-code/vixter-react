# API Unificada - Documentação

## Função: `api`

A função `api` é uma Cloud Function (`onCall`) que centraliza todas as operações CRUD para services, packs e posts.

### Estrutura da Chamada

```javascript
const result = await httpsCallable(functions, 'api')({
  resource: 'service' | 'pack' | 'post',
  action: 'create' | 'update' | 'delete',
  payload: { /* dados específicos para cada operação */ }
});
```

## Services

### Create Service
```javascript
{
  resource: 'service',
  action: 'create',
  payload: {
    title: string,           // Obrigatório
    description: string,     // Obrigatório
    price: number,          // Obrigatório (em VC)
    category: string,       // Obrigatório
    tags: string[],         // Array de strings
    features: string[],     // Array de strings
    complementaryOptions: object[], // Array de opções extras
    providerId: string,     // UID do usuário (auto-preenchido)
    status: string,         // Default: 'active'
    currency: string,       // Default: 'VC'
    createdAt: number,      // Timestamp em milissegundos
    updatedAt: number       // Timestamp em milissegundos
  }
}
```

### Update Service
```javascript
{
  resource: 'service',
  action: 'update',
  payload: {
    serviceId: string,      // Obrigatório
    updates: {              // Campos a serem atualizados
      title?: string,
      description?: string,
      price?: number,
      category?: string,
      tags?: string[],
      features?: string[],
      complementaryOptions?: object[]
    }
  }
}
```

### Delete Service
```javascript
{
  resource: 'service',
  action: 'delete',
  payload: {
    serviceId: string       // Obrigatório
  }
}
```

## Packs

### Create Pack
```javascript
{
  resource: 'pack',
  action: 'create',
  payload: {
    title: string,          // Obrigatório
    description: string,    // Obrigatório
    price: number,         // Obrigatório (em VC)
    category: string,      // Obrigatório
    subcategory: string,   // Opcional
    packType: string,      // 'download' ou 'nao-download'
    discount: number,      // Percentual de desconto (0-100)
    tags: string[],        // Array de strings
    features: string[],    // Array de strings
    isActive: boolean,     // Default: true
    createdAt: number      // Timestamp em milissegundos
  }
}
```

### Update Pack
```javascript
{
  resource: 'pack',
  action: 'update',
  payload: {
    packId: string,        // Obrigatório
    updates: {             // Campos a serem atualizados
      title?: string,
      description?: string,
      price?: number,
      category?: string,
      subcategory?: string,
      packType?: string,
      discount?: number,
      tags?: string[],
      features?: string[]
    }
  }
}
```

### Delete Pack
```javascript
{
  resource: 'pack',
  action: 'delete',
  payload: {
    packId: string         // Obrigatório
  }
}
```

## Posts

### Create Post
```javascript
{
  resource: 'post',
  action: 'create',
  payload: {
    content: string,       // Obrigatório (max 2000 chars)
    mediaUrls: string[],   // Array de URLs de mídia
    visibility: string,    // 'public', 'followers', 'private' (default: 'public')
    createdAt: number,     // Timestamp em milissegundos
    updatedAt: number      // Timestamp em milissegundos
  }
}
```

### Update Post
```javascript
{
  resource: 'post',
  action: 'update',
  payload: {
    postId: string,        // Obrigatório
    updates: {             // Campos a serem atualizados
      content?: string,
      mediaUrls?: string[],
      visibility?: string
    }
  }
}
```

### Delete Post
```javascript
{
  resource: 'post',
  action: 'delete',
  payload: {
    postId: string         // Obrigatório
  }
}
```

## Resposta da API

### Sucesso
```javascript
{
  success: true,
  [resourceId]: string,   // serviceId, packId ou postId para creates
  [resource]: object      // Dados completos do recurso criado (para creates)
}
```

### Erro
A função lança `HttpsError` com códigos apropriados:
- `unauthenticated`: Usuário não autenticado
- `invalid-argument`: Dados inválidos ou em falta
- `not-found`: Recurso não encontrado
- `permission-denied`: Usuário não tem permissão
- `internal`: Erro interno do servidor

## Funções Separadas (Não-CRUD)

Estas funções continuam como Cloud Functions separadas:

- `togglePostLike`: Curtir/descurtir posts
- `addComment`: Adicionar comentários
- Todas as funções de wallet (`initializeWallet`, `createStripeSession`, etc.)
- `stripeWebhook`: Webhook do Stripe

## Exemplo de Uso (React)

```javascript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const apiFunc = httpsCallable(functions, 'api');

// Criar serviço
const createService = async (serviceData) => {
  const result = await apiFunc({
    resource: 'service',
    action: 'create',
    payload: serviceData
  });
  return result.data;
};

// Atualizar pack
const updatePack = async (packId, updates) => {
  const result = await apiFunc({
    resource: 'pack',
    action: 'update',
    payload: { packId, updates }
  });
  return result.data;
};
```
