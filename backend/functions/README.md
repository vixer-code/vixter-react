# Pack Upload Video Service

Este serviço permite o upload e processamento de vídeos para packs, com suporte a vídeos de até 100MB.

## 🚀 Deploy

### Opção 1: Cloud Run (Recomendado)
```bash
# Deploy usando script
./deploy-function.sh

# Deploy manual
gcloud run deploy packuploadvideo \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --memory 8Gi \
  --cpu 4 \
  --timeout 540 \
  --max-instances 10 \
  --min-instances 0 \
  --concurrency 1 \
  --port 8080
```

### Opção 2: Firebase Functions
```bash
cd ..
firebase deploy --only functions
```

## 🔧 Configurações

- **Memória**: 8GiB
- **CPU**: 4 cores
- **Timeout**: 540 segundos (9 minutos)
- **Tamanho máximo**: 100MB por arquivo
- **CORS**: Configurado para vixter-react.vercel.app

## 📝 Variáveis de Ambiente Necessárias

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PACK_CONTENT_BUCKET_NAME`

## 🐛 Troubleshooting

Consulte o arquivo `TROUBLESHOOTING.md` na pasta backend para problemas comuns e soluções.