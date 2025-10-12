#!/bin/bash

# Deploy the packUploadVideo function using Cloud Run
echo "Deploying packUploadVideo function using Cloud Run..."

# Navigate to the functions directory
cd functions

# Deploy to Cloud Run
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
  --port 8080 \
  --set-env-vars NODE_ENV=production

echo "Deployment completed!"
echo "Service URL will be displayed above"