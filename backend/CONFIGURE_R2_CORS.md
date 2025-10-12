# Configurar CORS no Bucket R2 para Vídeos

## Problema

Quando a função `packContentAccess` retorna uma signed URL do R2, o navegador tenta acessar o vídeo diretamente do R2, mas recebe erro de CORS:

```
Access to fetch at 'https://vixter-pack-content-private...r2.cloudflarestorage.com/...'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

## Solução: Configurar CORS no Bucket R2

O bucket `vixter-pack-content-private` precisa ter CORS configurado para permitir acesso dos domínios do Vixter.

### Método 1: Via Cloudflare Dashboard (Mais Fácil)

1. **Acesse o Cloudflare Dashboard:**
   - https://dash.cloudflare.com

2. **Navegue até R2:**
   - Clique em "R2" no menu lateral
   - Selecione o bucket: `vixter-pack-content-private`

3. **Configure CORS:**
   - Clique na aba "Settings"
   - Role até "CORS Policy"
   - Clique em "Add CORS Policy"

4. **Adicione a seguinte configuração:**
   ```json
   {
     "AllowedOrigins": [
       "https://vixter-react.vercel.app",
       "https://vixter.com.br",
       "https://www.vixter.com.br",
       "http://localhost:3000",
       "http://localhost:5173"
     ],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
     "MaxAge": 3600
   }
   ```

5. **Salve a configuração**

### Método 2: Via AWS CLI (Para Automação)

1. **Instale AWS CLI** (se não tiver):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install awscli
   
   # macOS
   brew install awscli
   
   # ou via pip
   pip install awscli
   ```

2. **Execute o script de configuração:**
   ```bash
   cd /home/enzo/Documentos/git/zpessoal/vixter-react/backend
   chmod +x configure-cors-r2-pack-content.sh
   ./configure-cors-r2-pack-content.sh
   ```

   O script irá:
   - Solicitar suas credenciais R2
   - Aplicar a configuração CORS do arquivo `configure-cors-r2-pack-content.json`
   - Verificar se a configuração foi aplicada

3. **Ou configure manualmente com AWS CLI:**
   ```bash
   # Defina as variáveis
   export AWS_ACCESS_KEY_ID="sua_r2_access_key"
   export AWS_SECRET_ACCESS_KEY="sua_r2_secret_key"
   export R2_ENDPOINT="https://569b3a4a5f566a22d9db7146c13c9d69.r2.cloudflarestorage.com"
   
   # Aplique a configuração CORS
   aws s3api put-bucket-cors \
     --bucket vixter-pack-content-private \
     --cors-configuration file://configure-cors-r2-pack-content.json \
     --endpoint-url $R2_ENDPOINT
   
   # Verifique a configuração
   aws s3api get-bucket-cors \
     --bucket vixter-pack-content-private \
     --endpoint-url $R2_ENDPOINT
   ```

## Verificar se CORS Está Configurado

### Via Dashboard:
- Cloudflare Dashboard > R2 > vixter-pack-content-private > Settings > CORS Policy
- Deve mostrar a política configurada

### Via AWS CLI:
```bash
aws s3api get-bucket-cors \
  --bucket vixter-pack-content-private \
  --endpoint-url https://569b3a4a5f566a22d9db7146c13c9d69.r2.cloudflarestorage.com
```

### Teste no Browser:
Após configurar CORS, quando você acessar um vídeo, os headers da resposta devem incluir:
```
Access-Control-Allow-Origin: https://vixter-react.vercel.app
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Max-Age: 3600
```

## Como Funciona o Fluxo Atualizado

### Para Vídeos:

1. **Frontend** → `/api/pack-content/secure-data`
   - Valida acesso ao pack
   - Gera JWT token (válido por 2 horas)

2. **Frontend** → `packContentAccess` com JWT
   - Valida JWT token
   - Gera signed URL do R2 (válida por 2 horas)
   - Retorna JSON: `{ success: true, signedUrl: "..." }`

3. **Frontend** → usa `signedUrl` direto no player
   - Acesso direto ao R2 (sem limite de tamanho)
   - CORS permite o acesso
   - Bucket permanece privado (URL expira em 2 horas)

### Para Imagens (Inalterado):

1. **Frontend** → `/api/pack-content/secure-data`
   - Gera JWT token (válido por 10 minutos)

2. **Frontend** → `packContentAccess` com JWT
   - Valida JWT token
   - Processa imagem com watermark (QR codes)
   - Retorna imagem binária

## Benefícios

✅ **Vídeos de qualquer tamanho**: Sem limite de 10MB do Firebase Functions
✅ **Performance**: Download direto do R2 (mais rápido)
✅ **Segurança**: 
   - Bucket permanece privado
   - JWT token valida acesso inicial
   - Signed URL expira em 2 horas
✅ **Imagens inalteradas**: Continuam com watermarking via Functions
✅ **Custo reduzido**: Menos processamento no Functions

## Troubleshooting

### CORS Error Persiste

1. **Verifique se CORS foi aplicado:**
   ```bash
   aws s3api get-bucket-cors --bucket vixter-pack-content-private --endpoint-url ...
   ```

2. **Limpe cache do browser:**
   - Ctrl + Shift + Delete
   - Limpe cache e cookies
   - Ou use aba anônima

3. **Verifique a origem:**
   - Certifique-se que a origem está na lista AllowedOrigins
   - Ex: `https://vixter-react.vercel.app` (sem barra no final)

### Signed URL Não Funciona

1. **Verifique credenciais R2:**
   - Access Key precisa ter permissão de leitura no bucket
   
2. **Verifique expiração:**
   - JWT expira em 2 horas
   - Signed URL expira em 2 horas
   - Se passar do tempo, precisa gerar nova URL

### Vídeo Não Carrega (mas URL está OK)

1. **Verifique formato do vídeo:**
   - Browsers suportam: MP4 (H.264), WebM, Ogg
   - Verifique se o vídeo está corrompido

2. **Verifique tamanho:**
   - Muito grande pode demorar (mostrar loading)
   
3. **Verifique network:**
   - DevTools > Network
   - Veja se o download está progredindo

## Arquivos de Configuração

- **`configure-cors-r2-pack-content.json`** - Configuração CORS em JSON
- **`configure-cors-r2-pack-content.sh`** - Script de aplicação automática

## Próximos Passos

1. ✅ Configure CORS no bucket (via Dashboard ou script)
2. ✅ Faça deploy do backend atualizado:
   ```bash
   vercel --prod
   ```
3. ✅ Faça deploy da função:
   ```bash
   cd backend/functions
   firebase deploy --only functions:packContentAccess
   ```
4. ✅ Teste acessar um vídeo no pack comprado

## Notas de Segurança

⚠️ **CORS permite acesso apenas de domínios específicos**
- Mesmo com CORS, o bucket permanece privado
- Signed URLs são temporárias (2 horas)
- Sem signed URL válida = sem acesso

✅ **Múltiplas camadas de segurança:**
1. Verificação de compra do pack (no Next.js API)
2. JWT token com expiração (2 horas)
3. Signed URL do R2 com expiração (2 horas)
4. CORS restrito a domínios específicos

