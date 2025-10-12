# Configurar Secrets para packContentVideoReprocessor

## ✅ Status: CONFIGURADO COM SECRET MANAGER

A função `packContentVideoReprocessor` está configurada para usar **Secret Manager** do Firebase, que é a forma mais segura e moderna de armazenar credenciais.

## Secrets Necessários

A função requer 4 secrets configurados:

1. **R2_ACCOUNT_ID** - Account ID do Cloudflare
2. **R2_ACCESS_KEY_ID** - Access Key ID do R2
3. **R2_SECRET_ACCESS_KEY** - Secret Access Key do R2
4. **R2_PACK_CONTENT_BUCKET_NAME** - Nome do bucket (vixter-pack-content-private)

## Como os Secrets São Usados

No código da função:

```javascript
const { defineSecret } = require('firebase-functions/params');

// Define secrets from Secret Manager
const r2AccountId = defineSecret('R2_ACCOUNT_ID');
const r2AccessKeyId = defineSecret('R2_ACCESS_KEY_ID');
const r2SecretAccessKey = defineSecret('R2_SECRET_ACCESS_KEY');
const r2BucketName = defineSecret('R2_PACK_CONTENT_BUCKET_NAME');

exports.packContentVideoReprocessor = onDocumentUpdated({
  document: 'packs/{packId}',
  secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName]
}, async (event) => {
  // Access secrets with .value()
  const accountId = r2AccountId.value();
  const accessKeyId = r2AccessKeyId.value();
  const secretAccessKey = r2SecretAccessKey.value();
  const bucketName = r2BucketName.value();
  
  // Use credentials...
});
```

## Verificar Secrets Configurados

### Via Firebase Console:
1. Acesse: https://console.firebase.google.com
2. Selecione projeto "vixter-451b3"
3. Vá em Functions > Secrets
4. Confirme que os 4 secrets existem

### Via Firebase CLI:
```bash
# Listar todos os secrets
firebase functions:secrets:access R2_ACCOUNT_ID
firebase functions:secrets:access R2_ACCESS_KEY_ID
firebase functions:secrets:access R2_SECRET_ACCESS_KEY
firebase functions:secrets:access R2_PACK_CONTENT_BUCKET_NAME
```

## Se Precisar Reconfigurar Secrets

### 1. Deletar secret existente (se necessário):
```bash
firebase functions:secrets:destroy R2_ACCOUNT_ID
```

### 2. Criar novo secret:
```bash
firebase functions:secrets:set R2_ACCOUNT_ID
# Cole o valor quando solicitado
```

### 3. Repetir para todos os secrets:
```bash
firebase functions:secrets:set R2_ACCESS_KEY_ID
firebase functions:secrets:set R2_SECRET_ACCESS_KEY
firebase functions:secrets:set R2_PACK_CONTENT_BUCKET_NAME
```

## Deploy Após Configurar

Após configurar ou alterar secrets, faça redeploy:

```bash
cd backend/functions
firebase deploy --only functions:packContentVideoReprocessor
```

## Vantagens do Secret Manager

✅ **Segurança**: Credenciais criptografadas e isoladas
✅ **Controle de Acesso**: Permissões granulares via IAM
✅ **Auditoria**: Logs de acesso às credenciais
✅ **Rotação**: Fácil rotacionar credenciais sem redeployar
✅ **Moderna**: Método recomendado pelo Firebase Functions v2

## Logs de Sucesso

Quando os secrets estão configurados corretamente, você verá:

```
✅ R2 Secrets loaded from Secret Manager
   Account ID: 569b3...
   Bucket: vixter-pack-content-private
   Endpoint: https://569b3a4a5f566a22d9db7146c13c9d69.r2.cloudflarestorage.com
✅ R2 Client initialized successfully with Secret Manager credentials
```

## Troubleshooting

### Erro: "Secret not found"
- Verifique se o secret existe: `firebase functions:secrets:access SECRET_NAME`
- Crie o secret se não existir: `firebase functions:secrets:set SECRET_NAME`

### Erro: "Permission denied"
- Certifique-se de estar autenticado: `firebase login`
- Verifique o projeto: `firebase use vixter-451b3`

### Erro: "Secret value is empty"
- O secret existe mas está vazio
- Delete e recrie: 
  ```bash
  firebase functions:secrets:destroy SECRET_NAME
  firebase functions:secrets:set SECRET_NAME
  ```

## Comandos Úteis

```bash
# Listar projetos
firebase projects:list

# Mudar projeto
firebase use vixter-451b3

# Ver logs da função
firebase functions:log --only packContentVideoReprocessor

# Ver secrets (sem mostrar valor)
firebase functions:secrets:list
```

## Custo

Secret Manager do Google Cloud tem um custo, mas é muito baixo:
- $0.06 por secret ativo/mês (~R$ 0.30)
- $0.03 por 10,000 acessos (~R$ 0.15)

Para uma função que processa vídeos ocasionalmente, o custo é negligível (< R$ 2/mês).

## Segurança

⚠️ **NUNCA** commite secrets no código ou em arquivos `.env` no git!

Arquivos que devem estar no `.gitignore`:
- `.env`
- `.env.local`
- `service-account.json`
- Qualquer arquivo com credenciais

✅ Sempre use Secret Manager ou variáveis de ambiente do runtime.

