# Guia de Migração para R2 - Vixter?

Este guia explica como implementar a migração da mídia do Firebase Storage para o Cloudflare R2, mantendo a funcionalidade de watermarks para packs.

## Arquitetura Implementada

### Backend (Vercel API Routes)
- **Localização**: `api/`
- **Função**: Gerar signed URLs para upload/download no R2
- **Autenticação**: Firebase ID tokens
- **URL**: `https://vixter-react.vercel.app/api/`
- **Endpoints**:
  - `POST /api/media/upload` - Gerar URL de upload
  - `POST /api/media/download` - Gerar URL de download (com/sem watermark)
  - `DELETE /api/media/delete` - Deletar mídia

### Frontend (React)
- **Serviço**: `src/services/mediaService.js`
- **Hook**: `src/hooks/useR2Media.js`
- **Contextos**: `src/contexts/PacksContextR2.jsx`, `src/contexts/ServicesContextR2.jsx`
- **Componente**: `src/components/R2MediaViewer.jsx`

## Configuração

### 1. Variáveis de Ambiente (Vercel)

Configure as seguintes variáveis no Vercel:

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=vixter-451b3
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@vixter-451b3.iam.gserviceaccount.com

# Cloudflare R2
R2_ACCOUNT_ID=569b3a4a5f566a22d9db7146c13c9d69
R2_ACCESS_KEY_ID=8fc821d0198c77f738f4dd48ec2a369a
R2_SECRET_ACCESS_KEY=d97f95173e3a0ec35755678be4bfd031b00f8068fbd36a9bda69d9e7442424d4
R2_BUCKET_NAME=vixter-production
R2_PUBLIC_URL=https://media.vixter.com.br

# CORS (opcional)
ALLOWED_ORIGINS=https://vixter-react.vercel.app,http://localhost:3000
```

### 2. Deploy do Projeto

```bash
# Instalar dependências
npm install

# Deploy na Vercel
vercel deploy
```

### 3. Configuração das Variáveis de Ambiente

No dashboard da Vercel, adicione as seguintes variáveis:
- Acesse Settings > Environment Variables
- Adicione as variáveis obrigatórias:

**Firebase Admin SDK:**
- `FIREBASE_PROJECT_ID`: vixter-451b3
- `FIREBASE_PRIVATE_KEY`: Sua chave privada do Firebase
- `FIREBASE_CLIENT_EMAIL`: Seu email do Firebase

**Cloudflare R2:**
- `R2_ACCOUNT_ID`: 569b3a4a5f566a22d9db7146c13c9d69
- `R2_ACCESS_KEY_ID`: 8fc821d0198c77f738f4dd48ec2a369a
- `R2_SECRET_ACCESS_KEY`: d97f95173e3a0ec35755678be4bfd031b00f8068fbd36a9bda69d9e7442424d4
- `R2_BUCKET_NAME`: vixter-production
- `R2_PUBLIC_URL`: https://media.vixter.com.br

## Estrutura de Dados

### Pack (Firestore)
```javascript
{
  id: "pack123",
  title: "Pack de Fotos",
  // ... outros campos
  coverImage: {
    key: "packs/pack123/cover_1234567890_abc123.jpg",
    publicUrl: "https://media.vixter.com.br/packs/pack123/cover_1234567890_abc123.jpg",
    size: 1024000,
    type: "image/jpeg"
  },
  sampleImages: [
    {
      key: "packs/pack123/sample_1234567890_def456.jpg",
      publicUrl: "https://media.vixter.com.br/packs/pack123/sample_1234567890_def456.jpg",
      size: 2048000,
      type: "image/jpeg"
    }
  ],
  packContent: [
    {
      key: "packs/pack123/content_1234567890_ghi789.jpg",
      publicUrl: "https://media.vixter.com.br/packs/pack123/content_1234567890_ghi789.jpg",
      size: 5120000,
      type: "image/jpeg",
      name: "photo1.jpg"
    }
  ],
  mediaStorage: "r2" // Flag para indicar que usa R2
}
```

### Service (Firestore)
```javascript
{
  id: "service123",
  title: "Serviço de Design",
  // ... outros campos
  coverImage: {
    key: "services/service123/cover_1234567890_abc123.jpg",
    publicUrl: "https://media.vixter.com.br/services/service123/cover_1234567890_abc123.jpg",
    size: 1024000,
    type: "image/jpeg"
  },
  sampleImages: [
    {
      key: "services/service123/sample_1234567890_def456.jpg",
      publicUrl: "https://media.vixter.com.br/services/service123/sample_1234567890_def456.jpg",
      size: 2048000,
      type: "image/jpeg"
    }
  ],
  mediaStorage: "r2" // Flag para indicar que usa R2
}
```

## Sistema de Watermarks

### Para Packs
- **Conteúdo do Pack**: URLs únicas por usuário para watermarks
- **Amostras**: URLs públicas (sem watermark)
- **Capa**: URL pública (sem watermark)

### Para Services
- **Todas as mídias**: URLs públicas (sem watermark)

## Implementação Gradual

### Fase 1: Backend e Serviços ✅
1. ✅ Criar API Routes para R2
2. ✅ Implementar serviços de mídia
3. ✅ Criar contextos R2
4. ✅ Criar componente R2MediaViewer

### Fase 2: Migração dos Modais
1. Atualizar CreatePackModal para usar R2
2. Atualizar CreateServiceModal para usar R2
3. Testar upload e download

### Fase 3: Migração das Páginas
1. Atualizar páginas de exibição de packs
2. Atualizar páginas de exibição de services
3. Implementar sistema de watermarks

### Fase 4: Limpeza
1. Remover código antigo do Firebase Storage
2. Migrar dados existentes (opcional)
3. Atualizar documentação

### Fase 5: Centrífugo (Futuro)
1. Implementar Centrífugo para mensageria
2. Integrar com sistema de notificações
3. Testar mensageria em tempo real

## Uso dos Novos Contextos

### PacksContextR2
```javascript
import { usePacksR2 } from '../contexts/PacksContextR2';

const { createPack, getPackContentDownloadUrl } = usePacksR2();

// Criar pack com mídia
const result = await createPack({
  title: "Meu Pack",
  // ... outros campos
  coverImageFile: file,
  sampleImageFiles: [file1, file2],
  packFiles: [contentFile1, contentFile2]
});

// Obter URL de download com watermark
const downloadUrl = await getPackContentDownloadUrl(packId, contentKey);
```

### ServicesContextR2
```javascript
import { useServicesR2 } from '../contexts/ServicesContextR2';

const { createService, getServiceMediaDownloadUrl } = useServicesR2();

// Criar service com mídia
const result = await createService({
  title: "Meu Serviço",
  // ... outros campos
  coverImageFile: file,
  sampleImageFiles: [file1, file2]
});

// Obter URL de download
const downloadUrl = await getServiceMediaDownloadUrl(serviceId, mediaKey);
```

## Componente R2MediaViewer

```javascript
import R2MediaViewer from '../components/R2MediaViewer';

// Para mídia de service
<R2MediaViewer 
  mediaKey={service.coverImage.key}
  type="service"
  fallbackUrl="/default-image.jpg"
/>

// Para conteúdo de pack (com watermark)
<R2MediaViewer 
  mediaKey={pack.packContent[0].key}
  type="pack"
  watermarked={true}
  fallbackUrl="/default-image.jpg"
/>
```

## Próximos Passos

1. **Deploy do Backend**: Fazer deploy na Vercel
2. **Teste dos Endpoints**: Verificar se as APIs estão funcionando
3. **Atualização dos Modais**: Migrar CreatePackModal e CreateServiceModal
4. **Teste Completo**: Testar upload, download e watermarks
5. **Migração Gradual**: Substituir contextos antigos pelos novos

## Considerações de Segurança

- ✅ Autenticação via Firebase ID tokens
- ✅ URLs assinadas com expiração
- ✅ Validação de tipos de arquivo
- ✅ Limitação de tamanho de arquivo
- ✅ CORS configurado adequadamente

## Monitoramento

- Logs de upload/download no backend
- Métricas de uso do R2
- Monitoramento de erros no frontend
- Cache de URLs para performance
