#!/bin/bash

# Deploy the packUploadVideo function to Google Cloud Functions
echo "Deploying packUploadVideo function..."

cd functions

# Deploy the function
gcloud functions deploy packUploadVideo \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --memory 4GiB \
  --timeout 540s \
  --max-instances 10 \
  --min-instances 0 \
  --region us-east1 \
  --source . \
  --entry-point packUploadVideo

echo "Deployment completed!"
echo "Function URL: https://us-east1-YOUR_PROJECT_ID.cloudfunctions.net/packUploadVideo"