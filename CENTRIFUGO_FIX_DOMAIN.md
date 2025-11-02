# 🔧 Correção do Centrifugo para vixter.com.br

## ✅ Mudanças Aplicadas no Código

### 1. Frontend (`src/contexts/CentrifugoContext.jsx`)
- ✅ Atualizado para usar `window.location.origin` em vez de URL hardcoded
- ✅ Agora usa a origem atual do navegador para chamar o backend

### 2. Backend CORS
- ✅ `backend/app/api/centrifugo/token/route.ts` - Adicionado `vixter.com.br` aos allowed origins
- ✅ `backend/app/api/centrifugo/publish/route.ts` - Adicionado `vixter.com.br` aos allowed origins

## ⚠️ AÇÃO NECESSÁRIA: Atualizar Servidor Centrifugo no Fly.io

O servidor Centrifugo também precisa permitir o novo domínio. Você precisa atualizar o secret `ALLOWED_ORIGINS`.

### Como Atualizar

1. **Acesse o terminal e execute:**

```bash
# Atualizar o secret ALLOWED_ORIGINS no Fly.io
flyctl secrets set ALLOWED_ORIGINS="https://vixter.com.br,https://www.vixter.com.br,https://vixter-react.vercel.app,https://vixter-react-llyd.vercel.app" --app vixter-centrifugo
```

2. **Ou faça via Fly.io Dashboard:**
   - Acesse: https://fly.io/apps/vixter-centrifugo/secrets
   - Edite o secret `ALLOWED_ORIGINS`
   - Adicione: `https://vixter.com.br,https://www.vixter.com.br`
   - Salve

3. **Reiniciar o app (geralmente não necessário, mas se persistir):**
```bash
flyctl restart --app vixter-centrifugo
```

## 🔍 Como Verificar se Funcionou

1. Abra o console do navegador em `vixter.com.br`
2. Procure por erros relacionados a Centrifugo
3. Verifique a conexão WebSocket:
   ```javascript
   // No console do navegador
   // Deve mostrar "connected" ou similar
   ```

## 📝 Resumo das Mudanças

### Código Atualizado:
- ✅ Frontend agora usa origem dinâmica
- ✅ Backend API permite `vixter.com.br` no CORS

### Ação Manual Necessária:
- ⚠️ Atualizar `ALLOWED_ORIGINS` no servidor Centrifugo (Fly.io)

## 🆘 Se Ainda Não Funcionar

1. **Verifique os logs do Centrifugo:**
   ```bash
   flyctl logs --app vixter-centrifugo
   ```

2. **Verifique o console do navegador:**
   - Procure por erros de CORS
   - Procure por erros de WebSocket

3. **Teste a conexão:**
   - Abra: `https://vixter-centrifugo.fly.dev/health`
   - Deve retornar status OK

4. **Verifique se o token está sendo gerado:**
   - No console do navegador, verifique se a chamada para `/api/centrifugo/token` está funcionando

