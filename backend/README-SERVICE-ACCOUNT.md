# Service Account Configuration

## Variáveis de Ambiente Necessárias

Para que a autenticação service-to-service funcione, você precisa configurar as seguintes variáveis de ambiente no Vercel:

### Firebase Admin SDK (já configurado)
```
FIREBASE_PROJECT_ID=vixter-451b3
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@vixter-451b3.iam.gserviceaccount.com
```

### Google Cloud Service Account (novo)
```
GOOGLE_PROJECT_ID=vixter-451b3
GOOGLE_PRIVATE_KEY_ID=11a3d8c59949f01b06765976c785d7eb64ad0b87
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n
GOOGLE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@vixter-451b3.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=118398100106193783986
GOOGLE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40vixter-451b3.iam.gserviceaccount.com
```

## Como Configurar no Vercel

1. Acesse o painel do Vercel
2. Vá para Settings > Environment Variables
3. Adicione as variáveis acima com os valores do arquivo `serviceAccount.json`

## Valores do serviceAccount.json

- `project_id` → `GOOGLE_PROJECT_ID`
- `private_key_id` → `GOOGLE_PRIVATE_KEY_ID`
- `private_key` → `GOOGLE_PRIVATE_KEY`
- `client_email` → `GOOGLE_CLIENT_EMAIL`
- `client_id` → `GOOGLE_CLIENT_ID`
- `client_x509_cert_url` → `GOOGLE_CLIENT_X509_CERT_URL`

## Segurança

✅ **Nunca commite credenciais no código**
✅ **Use variáveis de ambiente**
✅ **Mantenha o arquivo serviceAccount.json fora do repositório**
