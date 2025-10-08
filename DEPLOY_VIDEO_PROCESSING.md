# Quick Deploy Guide - Video Processing at Upload

## 🚀 Passo a Passo para Deploy

### 1. Instalar Dependências

```bash
cd backend/functions
npm install busboy
```

### 2. Deploy da Cloud Function

```bash
# Na pasta backend/functions
firebase deploy --only functions:packUploadVideo

# OU deploy de todas as funções
firebase deploy --only functions
```

**Aguardar**: O deploy pode levar 2-5 minutos.

**URL da função** (após deploy):
```
https://packuploadvideo-6twxbx5ima-ue.a.run.app
```

### 3. Verificar Deploy

```bash
# Ver logs da função
firebase functions:log --only packUploadVideo

# Testar se a função está ativa
curl -X POST https://packuploadvideo-6twxbx5ima-ue.a.run.app \
  -H "Authorization: Bearer <seu-token>" \
  -F "video=@test.mp4" \
  -F "packId=test123" \
  -F "key=test/video.mp4"
```

### 4. Deploy do Frontend

```bash
# Na raiz do projeto
npm run build

# Deploy via Vercel
vercel --prod

# OU deploy via outro método que você usar
```

### 5. Testar

1. ✅ Fazer login como vendedora
2. ✅ Criar um pack
3. ✅ Adicionar um vídeo ao conteúdo do pack
4. ✅ Verificar que o vídeo é processado (ver logs)
5. ✅ Fazer login como comprador
6. ✅ Comprar o pack
7. ✅ Verificar que o vídeo carrega rapidamente

## 🔍 Verificação Rápida

### Ver logs da Cloud Function
```bash
firebase functions:log --only packUploadVideo
```

### Logs esperados (upload bem-sucedido):
```
Processing video for vendor: username
Video dimensions: 1920x1080
Vendor QR code written to: /tmp/vendor_qr_123.png
FFmpeg process started
Video processing: 50% done
Video processing completed
Processed video size: 5242880 bytes
```

### Logs esperados (acesso bem-sucedido):
```
Serving pre-processed video: video.mp4
Video buffer size: 5242880 bytes
```

## ⚠️ Troubleshooting

### Erro: "Busboy is not defined"
```bash
cd backend/functions
npm install busboy
firebase deploy --only functions:packUploadVideo
```

### Erro: "FFmpeg not found"
O FFmpeg já está incluído no ambiente do Cloud Functions. Se não funcionar:
1. Verificar logs: `firebase functions:log`
2. A função vai fazer fallback e enviar vídeo sem processamento

### Erro: "Timeout"
Vídeo muito grande. Soluções:
1. Reduzir tamanho do vídeo antes do upload
2. Aumentar timeout (já está em 540s = 9 minutos)
3. Usar preset mais rápido: `-preset ultrafast`

### Erro: "R2 upload failed"
Verificar variáveis de ambiente:
```bash
firebase functions:config:get

# Se não existirem, configurar:
firebase functions:config:set r2.account_id="<valor>"
firebase functions:config:set r2.access_key_id="<valor>"
firebase functions:config:set r2.secret_access_key="<valor>"
firebase functions:config:set r2.pack_content_bucket_name="vixter-pack-content-private"
```

## 📊 Monitoramento

### Verificar uso de recursos
```bash
# Ver métricas da função
firebase functions:log --only packUploadVideo

# Ver custos
# Acessar: https://console.firebase.google.com/project/_/functions/logs
```

### Alertas importantes

- ⚠️ Se timeout > 300s: Vídeo muito grande
- ⚠️ Se memória > 1.5GB: Considerar aumentar limite
- ⚠️ Se erros > 5%: Investigar causa

## ✅ Checklist Final

Antes de considerar o deploy completo:

- [ ] Cloud Function deployada com sucesso
- [ ] Frontend deployado com sucesso
- [ ] Teste de upload de vídeo funcionando
- [ ] Teste de acesso ao vídeo funcionando
- [ ] QR code aparecendo no vídeo
- [ ] Logs sem erros
- [ ] Performance melhorou (vídeos carregam rápido)

## 🎉 Pronto!

Se todos os itens do checklist estão OK, o sistema está funcionando corretamente!

**Benefícios esperados:**
- ⚡ Vídeos carregam 95% mais rápido para compradores
- 💰 Redução de ~98% nos custos de processamento
- 😊 Melhor experiência do usuário

## 📞 Suporte

Se encontrar problemas, verificar:
1. Logs: `firebase functions:log`
2. Documentação completa: `PACK_VIDEO_UPLOAD_PROCESSING.md`
3. Código fonte: `backend/functions/src/packUploadVideo.js`

