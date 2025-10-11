# Troubleshooting packUploadVideo Function

## Problemas Comuns e Soluções

### 1. Erro CORS (Access-Control-Allow-Origin)
**Sintoma**: `Access to fetch at 'https://...' has been blocked by CORS policy`

**Soluções aplicadas**:
- Configuração CORS expandida com headers específicos
- Headers CORS manuais como backup
- Tratamento de requisições OPTIONS (preflight)

### 2. Erro 413 (Content Too Large)
**Sintoma**: `POST https://... net::ERR_FAILED 413 (Content Too Large)`

**Soluções aplicadas**:
- Aumento da memória da função para 8GiB
- Configuração de limites no Busboy (100MB)
- Validação de tamanho de arquivo antes do processamento
- Timeout aumentado para 540 segundos

### 3. Configurações da Função
```javascript
exports.packUploadVideo = onRequest({
  region: 'us-east1',
  cors: true,
  invoker: 'public',
  memory: '8GiB',        // Aumentado para suportar vídeos de 100MB
  timeoutSeconds: 540,   // 9 minutos
  maxInstances: 10,
  minInstances: 0
}, async (req, res) => {
```

### 4. Limites de Upload
- **Tamanho máximo**: 100MB por arquivo
- **Tipos suportados**: video/mp4, video/quicktime, etc.
- **Validação**: Verificação de tamanho antes do processamento

### 5. Deploy da Função
```bash
# Usar o script de deploy
./deploy-function.sh

# Ou manualmente
gcloud functions deploy packUploadVideo \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --memory 8GiB \
  --timeout 540s \
  --max-instances 10 \
  --min-instances 0 \
  --region us-east1 \
  --source functions \
  --entry-point packUploadVideo
```

### 6. Logs e Debug
Para verificar logs da função:
```bash
gcloud functions logs read packUploadVideo --region us-east1 --limit 50
```

### 7. Teste da Função
```bash
# Teste básico de CORS
curl -X OPTIONS https://packuploadvideo-6twxbx5ima-ue.a.run.app/ \
  -H "Origin: https://vixter-react.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v
```

### 8. Verificações Adicionais
- Verificar se o projeto Google Cloud tem cotas suficientes
- Confirmar que a função está na região correta (us-east1)
- Verificar se as variáveis de ambiente estão configuradas
- Confirmar que o R2 (Cloudflare) está acessível