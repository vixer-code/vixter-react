# Deploy da Função packContentVideoReprocessor Corrigida

## Problemas Identificados e Corrigidos

A função `packContentVideoReprocessor` não estava funcionando devido a 6 problemas críticos:

1. **Trigger na coleção errada**: estava monitorando `packContent/{packId}` ao invés de `packs/{packId}`
2. **Campo array incorreto**: buscava `content` ao invés de `packContent`
3. **Tipo de vídeo**: não detectava MIME types como `video/mp4`
4. **Campo do vendedor**: buscava `vendorId` ao invés de `authorId`
5. **Atualização no Firestore**: tentava atualizar coleção inexistente `packContent`
6. **Credenciais R2 inválidas**: R2 client inicializado fora da função (antes das env vars estarem disponíveis)

## Como Fazer o Deploy

### IMPORTANTE: Secrets Já Configurados ✅

Os secrets do R2 já estão configurados no Secret Manager:
- ✅ R2_ACCOUNT_ID
- ✅ R2_ACCESS_KEY_ID  
- ✅ R2_SECRET_ACCESS_KEY
- ✅ R2_PACK_CONTENT_BUCKET_NAME

A função está configurada para usar esses secrets automaticamente.

### 1. Navegue até o diretório das funções:
```bash
cd /home/enzo/Documentos/git/zpessoal/vixter-react/backend/functions
```

### 2. Instale as dependências (se necessário):
```bash
npm install
```

### 3. Faça o deploy da função:
```bash
firebase deploy --only functions:packContentVideoReprocessor
```

**Ou**, se preferir fazer deploy de todas as funções:
```bash
firebase deploy --only functions
```

### 4. Verifique o deploy no console:
```bash
firebase functions:log --only packContentVideoReprocessor
```

## Como Testar

1. Crie ou edite um pack
2. Faça upload de um vídeo no `packContent`
3. A função deve ser acionada automaticamente
4. Verifique os logs no Firebase Console:
   - Acesse: https://console.firebase.google.com
   - Vá em Functions > Logs
   - Procure por logs da função `packContentVideoReprocessor`

## Logs Esperados

Quando um vídeo for adicionado ao `packContent`, você verá logs como:

```
✅ R2 Secrets loaded from Secret Manager
   Account ID: 569b3...
   Bucket: vixter-pack-content-private
   Endpoint: https://569b3...r2.cloudflarestorage.com
✅ R2 Client initialized successfully with Secret Manager credentials

PackContent document updated: {packId}
Found 1 video changes to process
IMPORTANT: Processing videos in-place with same filenames. PackContent array will NOT be modified.

Processing videos for vendor: {username}
New video detected: video.mp4 (pack-content/...)
Downloading from R2: pack-content/...
Generating QR code for video watermarking...
Processing video with FFmpeg...
Uploading processed video with SAME KEY: pack-content/...

=== VIDEO PROCESSING SUMMARY ===
Total videos: 1
Successful: 1
Failed: 0
PackContent array: UNCHANGED (videos processed in-place)
================================
```

## Secrets Configurados (Secret Manager)

A função usa **Secret Manager** para armazenar credenciais de forma segura:

✅ **R2_ACCOUNT_ID** - Configurado
✅ **R2_ACCESS_KEY_ID** - Configurado
✅ **R2_SECRET_ACCESS_KEY** - Configurado
✅ **R2_PACK_CONTENT_BUCKET_NAME** - Configurado

Para verificar os secrets:
```bash
firebase functions:secrets:access R2_ACCOUNT_ID
```

**Ver documentação completa**: `/backend/CONFIGURE_SECRETS.md`

## Estrutura Esperada do packContent

A função agora processa corretamente vídeos com esta estrutura:

```javascript
{
  packContent: [
    {
      key: "pack-content/vendorId/packId/timestamp_random_filename.mp4",
      name: "filename.mp4",
      publicUrl: null,
      size: 29133067,
      type: "video/mp4"  // ✅ Agora suporta MIME types
    }
  ],
  authorId: "vendorUserId",  // ✅ Campo correto
  title: "Pack Title",
  // ... outros campos
}
```

## Troubleshooting

### Função não está sendo acionada:
1. Verifique se o deploy foi bem-sucedido
2. Confirme que a função está ativa no Firebase Console
3. Verifique os logs de erro no Console

### Vídeos não estão sendo processados:
1. Verifique se o campo `type` contém `video/` (ex: `video/mp4`)
2. Confirme que o campo `key` existe e é válido
3. Verifique as credenciais do R2
4. Confirme nos logs se as credenciais estão sendo carregadas:
   ```
   R2 Config: {
     accountId: 'xxxxx...',
     hasAccessKey: true,
     hasSecretKey: true,
     bucket: 'vixter-pack-content-private'
   }
   ```

### Erros de permissão ou "Resolved credential object is not valid":
Este erro ocorre quando os secrets do R2 não estão acessíveis. Soluções:

1. **Verifique se os secrets existem:**
   ```bash
   firebase functions:secrets:access R2_ACCOUNT_ID
   ```

2. **Se o secret não existir, crie:**
   ```bash
   firebase functions:secrets:set R2_ACCOUNT_ID
   # Cole o valor quando solicitado
   ```

3. **Verifique as permissões:**
   - A função precisa ter acesso ao Secret Manager
   - Verifique no Console do Firebase > Functions > Permissions

4. **Confirme o bucket existe:**
   - Bucket: `vixter-pack-content-private`
   - Verifique no Cloudflare R2 Dashboard

5. **Após configurar, faça redeploy:**
   ```bash
   firebase deploy --only functions:packContentVideoReprocessor
   ```

**Documentação completa**: `/backend/CONFIGURE_SECRETS.md`

## Recursos Utilizados

A função utiliza:
- **Memória**: 4GiB (suficiente para processar a maioria dos vídeos)
- **Timeout**: 540 segundos (9 minutos)
- **Região**: us-east1
- **Max Instances**: 10 (processamento paralelo)

> **Nota**: Se encontrar erros de memória insuficiente para vídeos muito grandes, você pode aumentar para 8GiB editando a configuração da função.

## Monitoramento

Para monitorar a função em tempo real:
```bash
firebase functions:log --only packContentVideoReprocessor --lines 50
```

Para ver estatísticas de uso:
- Acesse Firebase Console > Functions
- Clique em `packContentVideoReprocessor`
- Veja métricas de invocações, erros e tempo de execução

