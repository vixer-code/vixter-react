# Configuração do Bucket Privado para KYC

## Problema Identificado

Os documentos KYC (Know Your Customer) estavam sendo armazenados no bucket público `vixter-production`, o que significa que **todos os documentos ficam acessíveis publicamente**, mesmo estando em paths específicos como `/kyc/(usuário)/doc`.

## Solução Implementada

### 1. Bucket Privado Separado

- **Bucket Público**: `vixter-production` (para mídia pública como packs, services, etc.)
- **Bucket Privado**: `vixter-kyc-private` (para documentos KYC sensíveis)

### 2. Configuração Necessária

#### No Cloudflare R2 Dashboard:

1. **Criar novo bucket privado**:
   - Nome: `vixter-kyc-private`
   - Configuração: **Privado** (não público)
   - Região: mesma do bucket atual

2. **Configurar permissões**:
   - Apenas a aplicação deve ter acesso via API keys
   - Não configurar domínio público para este bucket

#### No Vercel (Variáveis de Ambiente):

Adicionar a nova variável de ambiente:

```bash
R2_KYC_BUCKET_NAME=vixter-kyc-private
```

**Variáveis atuais que devem permanecer:**
```bash
R2_ACCOUNT_ID=569b3a4a5f566a22d9db7146c13c9d69
R2_ACCESS_KEY_ID=8fc821d0198c77f738f4dd48ec2a369a
R2_SECRET_ACCESS_KEY=d97f95173e3a0ec35755678be4bfd031b00f8068fbd36a9bda69d9e7442424d4
R2_BUCKET_NAME=vixter-production
R2_PUBLIC_URL=https://media.vixter.com.br
```

### 3. Implementação Técnica

#### Backend (`backend/lib/r2.ts`):
- ✅ Funções específicas para KYC: `generateKycUploadSignedUrl()`, `generateKycDownloadSignedUrl()`
- ✅ Suporte a múltiplos buckets
- ✅ URLs assinadas para acesso seguro

#### APIs:
- ✅ `/api/media/upload` - Detecta tipo 'kyc' e usa bucket privado
- ✅ `/api/kyc/download` - Download seguro apenas para o próprio usuário

#### Frontend (`src/pages/Settings.jsx`):
- ✅ Upload de documentos KYC para bucket privado
- ✅ Visualização de documentos enviados (apenas do próprio usuário)
- ✅ Validação de propriedade dos documentos

### 4. Estrutura de Dados

#### Documentos KYC no Firebase:
```javascript
{
  verification: {
    fullName: "João Silva",
    cpf: "12345678901",
    documents: {
      front: "KYC/userId/doc-front-1234567890.jpg",
      back: "KYC/userId/doc-back-1234567890.jpg", 
      selfie: "KYC/userId/selfie-1234567890.jpg"
    },
    submittedAt: 1234567890,
    verificationStatus: "pending"
  }
}
```

#### Bucket Privado:
```
vixter-kyc-private/
├── KYC/
│   └── userId1/
│       ├── doc-front-1234567890.jpg
│       ├── doc-back-1234567890.jpg
│       └── selfie-1234567890.jpg
│   └── userId2/
│       ├── doc-front-1234567891.jpg
│       ├── doc-back-1234567891.jpg
│       └── selfie-1234567891.jpg
```

### 5. Segurança Implementada

- ✅ **Bucket Privado**: Documentos nunca ficam públicos
- ✅ **URLs Assinadas**: Acesso temporário e controlado
- ✅ **Validação de Propriedade**: Usuários só acessam seus próprios documentos
- ✅ **Autenticação**: Firebase ID tokens obrigatórios
- ✅ **Expiração**: URLs expiram em 1 hora por padrão

### 6. Próximos Passos

1. **Criar bucket privado** no Cloudflare R2
2. **Adicionar variável de ambiente** `R2_KYC_BUCKET_NAME` no Vercel
3. **Fazer deploy** do backend atualizado
4. **Testar upload** de documentos KYC
5. **Verificar** que documentos não ficam acessíveis publicamente

### 7. Verificação de Segurança

Para confirmar que está funcionando:

1. **Upload um documento KYC** via Settings
2. **Tente acessar diretamente** via URL pública (deve falhar)
3. **Use a API de download** (deve funcionar apenas para o próprio usuário)
4. **Verifique no bucket** que o arquivo está no bucket privado

### 8. Migração de Dados Existentes (Opcional)

Se houver documentos KYC já no bucket público:

1. **Listar documentos** no path `/kyc/`
2. **Mover para bucket privado** mantendo a mesma estrutura
3. **Atualizar referências** no Firebase se necessário

## Benefícios da Solução

- ✅ **Conformidade LGPD/GDPR**: Dados sensíveis protegidos
- ✅ **Segurança Total**: Documentos nunca públicos
- ✅ **Auditoria**: Controle de acesso granular
- ✅ **Escalabilidade**: Fácil gerenciamento de permissões
- ✅ **Performance**: URLs assinadas eficientes

