# Vixter Pack Content Security

Este diretório contém as Cloud Functions do Firebase para gerenciar o acesso seguro ao conteúdo de packs com watermark personalizado.

## Funcionalidades

### 1. packContentAccess
Cloud Function que serve conteúdo de packs com watermark personalizado e controle de acesso.

**Endpoint:** `https://us-central1-your-project.cloudfunctions.net/packContentAccess`

**Parâmetros:**
- `packId`: ID do pack
- `contentKey`: Chave do conteúdo específico
- `watermark`: Texto do watermark (opcional, usa username se não fornecido)
- `username`: Username do usuário
- `orderId`: ID do pedido do pack
- `token`: Firebase ID token do usuário

**Funcionalidades:**
- ✅ Verificação de autenticação via Firebase ID token
- ✅ Validação de acesso baseada em pack orders
- ✅ Watermark personalizado com username
- ✅ Headers de segurança para prevenir downloads
- ✅ Rate limiting
- ✅ Suporte a imagens com watermark via Sharp
- ✅ Suporte a vídeos com watermark via FFmpeg
- ✅ Fallback para arquivos não-suportados

## Configuração

### 1. Variáveis de Ambiente
Configure as seguintes variáveis no Firebase Functions:

```bash
# R2 Configuration
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_PACK_CONTENT_BUCKET_NAME=vixter-pack-content-private

# Security
PACK_ACCESS_SECRET=your-secure-random-string
```

### 2. Deploy
```bash
cd functions
npm install
firebase deploy --only functions:packContentAccess
```

## Uso no Frontend

### Hook useSecurePackContent
```javascript
import { useSecurePackContent } from '../hooks/useSecurePackContent';

const { generateSecurePackContentUrl, openSecureContent } = useSecurePackContent();

// Gerar URL segura
const result = await generateSecurePackContentUrl(
  contentKey,
  packId,
  orderId,
  watermark
);

// Abrir conteúdo em nova aba
await openSecureContent(contentKey, packId, orderId, watermark);
```

### PackContentViewer
O componente `PackContentViewer` foi atualizado para usar o novo sistema de watermark:

```javascript
<PackContentViewer
  pack={packData}
  orderId={orderId}
  vendorInfo={vendorInfo}
  onClose={handleClose}
/>
```

## Segurança

### 1. Controle de Acesso
- Verificação de Firebase ID token
- Validação de pack orders ativos
- Verificação de status do pedido (COMPLETED, CONFIRMED, AUTO_RELEASED)

### 2. Watermark
**Para Imagens:**
- Watermark diagonal com username
- Watermarks adicionais nos cantos
- Texto "vixter.com.br" para identificação
- Transparência ajustada para não interferir na visualização

**Para Vídeos:**
- Watermark centralizado com username
- Watermarks nos cantos (username + vixter.com.br)
- Processamento otimizado para Cloud Functions
- Timeout de 5 minutos para vídeos grandes
- Limite de 100MB por vídeo

### 3. Headers de Segurança
```
Cache-Control: no-cache, no-store, must-revalidate
Content-Disposition: inline
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Watermark: [username]
```

### 4. Rate Limiting
- Máximo 60 requisições por minuto por usuário/pack
- Máximo 300 requisições por hora por usuário/pack

## Estrutura de Arquivos

```
functions/
├── index.js                    # Export das functions
├── package.json               # Dependências
├── src/
│   ├── packContentAccess.js   # Função principal
│   └── utils/
│       └── packSecurity.js    # Utilitários de segurança
└── README.md                  # Esta documentação
```

## Dependências

- `firebase-admin`: ^12.0.0
- `firebase-functions`: ^4.8.0
- `sharp`: ^0.33.0 (para processamento de imagem)
- `fluent-ffmpeg`: ^2.1.2 (para processamento de vídeo)
- `@aws-sdk/client-s3`: ^3.490.0 (para R2)
- `@aws-sdk/s3-request-presigner`: ^3.490.0
- `cors`: ^2.8.5

**Nota:** FFmpeg deve estar instalado no ambiente de execução das Cloud Functions.

## Troubleshooting

### 1. Erro de Acesso Negado
- Verificar se o usuário tem um pack order válido
- Verificar se o token Firebase é válido
- Verificar se o pack order está no status correto

### 2. Erro de Watermark
- Verificar se o Sharp está instalado corretamente
- Verificar se a imagem é um formato suportado
- Logs disponíveis nos Firebase Functions logs

### 3. Erro de Vídeo/FFmpeg
- Verificar se FFmpeg está instalado no ambiente
- Verificar se o vídeo não excede 100MB
- Verificar se o formato de vídeo é suportado
- Logs disponíveis nos Firebase Functions logs para debugging

### 4. Erro de R2
- Verificar configuração das credenciais R2
- Verificar se o bucket existe
- Verificar se o arquivo existe no R2

## Logs

Para visualizar logs em tempo real:
```bash
firebase functions:log --only packContentAccess
```

## Desenvolvimento Local

Para testar localmente:
```bash
firebase emulators:start --only functions
```

A função estará disponível em:
`http://localhost:5001/your-project/us-central1/packContentAccess`
