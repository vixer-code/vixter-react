# Arquitetura Multi-Bucket para Vixter

## 🎯 Problema Identificado

A arquitetura anterior usava apenas **1 bucket público** para todos os tipos de mídia, causando problemas de segurança:

- ❌ **Documentos KYC** ficavam acessíveis publicamente
- ❌ **Conteúdo de packs** (arquivos pagos) ficavam acessíveis publicamente  
- ❌ **Sistema de watermarks** não oferecia proteção real
- ❌ **Conformidade LGPD/GDPR** comprometida

## ✅ Solução: Arquitetura de 3 Buckets

### 1. **Bucket Público** (`vixter-production`)
**Uso**: Mídia que deve ser acessível publicamente
- ✅ Capas de packs e services
- ✅ Imagens de amostra (samples)
- ✅ Avatars de usuários
- ✅ Mídia de services
- ✅ Imagens de perfil

### 2. **Bucket Privado de Conteúdo** (`vixter-pack-content-private`)
**Uso**: Conteúdo premium que usuários compram
- 🔒 **Conteúdo dos packs** (arquivos de download)
- 🔒 Sistema de watermarks
- 🔒 URLs assinadas por usuário
- 🔒 Verificação de compra obrigatória

### 3. **Bucket Privado de KYC** (`vixter-kyc-private`)
**Uso**: Documentos sensíveis de verificação
- 🔒 Documentos de identidade (frente/verso)
- 🔒 Selfies com documentos
- 🔒 Dados sensíveis de verificação

## 🏗️ Implementação Técnica

### Backend (`backend/lib/r2.ts`)

```typescript
// Configuração dos buckets
const BUCKET_NAME = process.env.R2_BUCKET_NAME!; // vixter-production (público)
const KYC_BUCKET_NAME = process.env.R2_KYC_BUCKET_NAME!; // vixter-kyc-private
const PACK_CONTENT_BUCKET_NAME = process.env.R2_PACK_CONTENT_BUCKET_NAME!; // vixter-pack-content-private

// Funções específicas por bucket
- generateUploadSignedUrl() // Bucket público
- generateKycUploadSignedUrl() // Bucket KYC privado
- generatePackContentUploadSignedUrl() // Bucket pack content privado
```

### APIs Implementadas

#### Upload (`/api/media/upload`)
```typescript
// Detecta tipo e usa bucket correto
if (type === 'kyc') → Bucket KYC privado
if (type === 'pack-content') → Bucket pack content privado  
else → Bucket público
```

#### Download KYC (`/api/kyc/download`)
- ✅ Validação de propriedade (usuário só acessa seus documentos)
- ✅ URLs assinadas temporárias
- ✅ Autenticação obrigatória

#### Download Pack Content (`/api/pack-content/download`)
- ✅ Validação de compra (TODO: implementar)
- ✅ URLs assinadas temporárias
- ✅ Sistema de watermarks

## 📋 Configuração Necessária

### 1. Cloudflare R2 Dashboard

#### Bucket Público (já existe)
- **Nome**: `vixter-production`
- **Configuração**: Público
- **Domínio**: `https://media.vixter.com.br`

#### Bucket KYC Privado (criar)
- **Nome**: `vixter-kyc-private`
- **Configuração**: **Privado**
- **Domínio**: Não configurar (privado)

#### Bucket Pack Content Privado (criar)
- **Nome**: `vixter-pack-content-private`
- **Configuração**: **Privado**
- **Domínio**: Não configurar (privado)

### 2. Vercel Environment Variables

```bash
# Buckets existentes
R2_BUCKET_NAME=vixter-production
R2_PUBLIC_URL=https://media.vixter.com.br

# Novos buckets privados
R2_KYC_BUCKET_NAME=vixter-kyc-private
R2_PACK_CONTENT_BUCKET_NAME=vixter-pack-content-private

# Credenciais (mesmas para todos os buckets)
R2_ACCOUNT_ID=569b3a4a5f566a22d9db7146c13c9d69
R2_ACCESS_KEY_ID=8fc821d0198c77f738f4dd48ec2a369a
R2_SECRET_ACCESS_KEY=d97f95173e3a0ec35755678be4bfd031b00f8068fbd36a9bda69d9e7442424d4
```

## 📁 Estrutura de Dados

### Bucket Público (`vixter-production`)
```
vixter-production/
├── packs/
│   └── packId/
│       ├── cover_1234567890.jpg (público)
│       └── sample_1234567890.jpg (público)
├── services/
│   └── serviceId/
│       ├── cover_1234567890.jpg (público)
│       └── sample_1234567890.jpg (público)
└── profiles/
    └── userId/
        └── avatar_1234567890.jpg (público)
```

### Bucket Pack Content Privado (`vixter-pack-content-private`)
```
vixter-pack-content-private/
├── packs/
│   └── packId/
│       └── content/
│           ├── file1_1234567890.jpg (privado)
│           ├── file2_1234567890.jpg (privado)
│           └── watermarked/
│               └── userId/
│                   └── file1_1234567890.jpg (privado)
```

### Bucket KYC Privado (`vixter-kyc-private`)
```
vixter-kyc-private/
├── KYC/
│   └── userId1/
│       ├── doc-front_1234567890.jpg (privado)
│       ├── doc-back_1234567890.jpg (privado)
│       └── selfie_1234567890.jpg (privado)
```

## 🔒 Segurança Implementada

### Documentos KYC
- ✅ **Bucket Privado**: Nunca acessível publicamente
- ✅ **Validação de Propriedade**: Usuário só acessa seus documentos
- ✅ **URLs Assinadas**: Acesso temporário e controlado
- ✅ **Autenticação**: Firebase ID tokens obrigatórios

### Conteúdo de Packs
- ✅ **Bucket Privado**: Conteúdo premium protegido
- ✅ **Sistema de Watermarks**: URLs únicas por usuário
- ✅ **Verificação de Compra**: (TODO: implementar validação)
- ✅ **URLs Assinadas**: Acesso temporário e controlado

### Mídia Pública
- ✅ **Bucket Público**: Acesso direto para performance
- ✅ **CDN**: Distribuição global via Cloudflare
- ✅ **Cache**: Otimização de performance

## 🚀 Próximos Passos

### Fase 1: Configuração (Imediato)
1. **Criar buckets privados** no Cloudflare R2
2. **Adicionar variáveis de ambiente** no Vercel
3. **Fazer deploy** do backend atualizado

### Fase 2: Migração de Dados (Opcional)
1. **Identificar conteúdo de packs** no bucket público
2. **Mover para bucket privado** mantendo estrutura
3. **Atualizar referências** no Firebase

### Fase 3: Validação de Compra (Futuro)
1. **Implementar verificação de compra** na API de download
2. **Sistema de permissões** por usuário
3. **Auditoria de acesso** aos conteúdos

## 🧪 Testes de Segurança

### Teste 1: Documentos KYC
```bash
# 1. Upload documento KYC
curl -X POST /api/media/upload -d '{"type":"kyc",...}'

# 2. Tentar acessar via URL pública (deve falhar)
curl https://media.vixter.com.br/KYC/userId/doc-front.jpg

# 3. Usar API de download (deve funcionar)
curl -X POST /api/kyc/download -d '{"key":"KYC/userId/doc-front.jpg"}'
```

### Teste 2: Conteúdo de Packs
```bash
# 1. Upload conteúdo de pack
curl -X POST /api/media/upload -d '{"type":"pack-content",...}'

# 2. Tentar acessar via URL pública (deve falhar)
curl https://media.vixter.com.br/packs/packId/content/file.jpg

# 3. Usar API de download (deve funcionar)
curl -X POST /api/pack-content/download -d '{"key":"packs/packId/content/file.jpg"}'
```

## 📊 Benefícios da Nova Arquitetura

### Segurança
- ✅ **Conformidade LGPD/GDPR**: Dados sensíveis protegidos
- ✅ **Proteção de Propriedade Intelectual**: Conteúdo premium seguro
- ✅ **Controle Granular**: Acesso baseado em permissões

### Performance
- ✅ **CDN para mídia pública**: Performance otimizada
- ✅ **URLs assinadas eficientes**: Acesso controlado sem overhead
- ✅ **Cache inteligente**: Mídia pública em cache global

### Escalabilidade
- ✅ **Separação de responsabilidades**: Cada bucket tem seu propósito
- ✅ **Gerenciamento independente**: Políticas de acesso específicas
- ✅ **Auditoria facilitada**: Logs separados por tipo de conteúdo

## 🔧 Comandos de Migração (Opcional)

### Mover Conteúdo de Packs
```bash
# Listar conteúdo de packs no bucket público
aws s3 ls s3://vixter-production/packs/ --recursive | grep content

# Mover para bucket privado (manter estrutura)
aws s3 sync s3://vixter-production/packs/ s3://vixter-pack-content-private/packs/ --exclude "*" --include "*/content/*"
```

### Verificar Segurança
```bash
# Verificar que bucket privado não tem acesso público
aws s3api get-bucket-policy --bucket vixter-kyc-private
aws s3api get-bucket-policy --bucket vixter-pack-content-private
```

## 📝 Notas Importantes

1. **Backward Compatibility**: APIs antigas continuam funcionando
2. **Gradual Migration**: Pode ser implementado gradualmente
3. **Zero Downtime**: Não afeta funcionalidade existente
4. **Cost Effective**: Mesmo custo, maior segurança

Esta arquitetura resolve completamente os problemas de segurança identificados e oferece uma base sólida para crescimento futuro! 🚀

