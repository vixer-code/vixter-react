# Configurar CORS no Bucket R2 para Vídeos

## Por Que é Necessário?

Vídeos são servidos via **Signed URLs** do R2 para evitar o limite de 10MB do Firebase Functions.

Quando o navegador acessa a signed URL diretamente do R2, ele precisa de permissão CORS configurada no bucket.

## Como Configurar (Via Cloudflare Dashboard)

### 1. Acesse o Cloudflare Dashboard:
https://dash.cloudflare.com

### 2. Navegue até R2:
- Menu lateral → **R2**
- Clique no bucket: **vixter-pack-content-private**

### 3. Configure CORS:
- Aba **Settings**
- Role até **CORS Policy**
- Clique em **Add CORS Policy**

### 4. Cole esta configuração:

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

### 5. Salve

## Verificar se Funcionou

Após configurar CORS:

1. Faça deploy da função:
   ```bash
   cd backend/functions
   firebase deploy --only functions:packContentAccess
   ```

2. Tente acessar um vídeo no pack

3. Verifique se não há mais erro de CORS no console do navegador

## Segurança

✅ **Bucket permanece privado**
- Signed URLs são temporárias (2 horas)
- Apenas quem tem JWT válido recebe a signed URL
- CORS permite apenas domínios específicos

## Fluxo Completo

```
Usuário acessa vídeo
  ↓
packContentAccess valida JWT
  ↓
Gera signed URL do R2 (válida por 2h)
  ↓
Retorna JSON: { signedUrl: "..." }
  ↓
Frontend usa signedUrl no <video>
  ↓
Navegador acessa R2 diretamente (com CORS)
  ↓
✅ Vídeo carrega (qualquer tamanho até 100MB)
```

## Vantagens

✅ **Sem limite de tamanho**: Vídeos de 10MB, 50MB, 100MB funcionam
✅ **Rápido**: Browser baixa direto do R2 (CDN do Cloudflare)
✅ **Seguro**: Bucket privado + JWT + signed URL temporária
✅ **Econômico**: Menos processamento no Functions

## Troubleshooting

### CORS Error Persiste:
1. Limpe cache do browser (Ctrl + Shift + Delete)
2. Verifique se salvou a configuração CORS no Cloudflare
3. Espere 1-2 minutos (propagação da configuração)

### Signed URL Não Funciona:
1. Verifique se credenciais R2 estão corretas
2. Verifique se bucket existe: `vixter-pack-content-private`
3. Verifique logs da função no Firebase Console

