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

### 1. Navegue até o diretório das funções:
```bash
cd /home/enzo/Documentos/git/zpessoal/vixter-react/backend/functions
```

### 2. Instale as dependências (se necessário):
```bash
npm install
```

### 3. Faça o deploy apenas da função corrigida:
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
PackContent document updated: {packId}
Found 1 video changes to process
Processing videos for vendor: {username}
Processing new video at index 0: pack-content/...
Downloading video from R2: pack-content/...
Generating QR code for video watermarking...
Processing video with FFmpeg...
Video processed successfully
Uploading processed video to R2...
Pack packContent status updated
```

## Variáveis de Ambiente Necessárias

Certifique-se de que estas variáveis estão configuradas no Firebase Functions:

```bash
firebase functions:config:set \
  r2.account_id="YOUR_R2_ACCOUNT_ID" \
  r2.access_key_id="YOUR_R2_ACCESS_KEY" \
  r2.secret_access_key="YOUR_R2_SECRET_KEY" \
  r2.pack_content_bucket_name="vixter-pack-content-private"
```

Para verificar as configurações atuais:
```bash
firebase functions:config:get
```

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
Este erro ocorre quando as credenciais do R2 não estão disponíveis. Soluções:
1. Verifique se as variáveis de ambiente do R2 estão configuradas no Firebase:
   ```bash
   firebase functions:config:get
   ```
2. Se não estiverem configuradas, configure-as:
   ```bash
   firebase functions:config:set \
     r2.account_id="YOUR_ACCOUNT_ID" \
     r2.access_key_id="YOUR_ACCESS_KEY" \
     r2.secret_access_key="YOUR_SECRET_KEY"
   ```
3. Confirme que o bucket `vixter-pack-content-private` existe
4. Verifique as permissões de acesso ao R2
5. Após configurar, faça redeploy da função

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

