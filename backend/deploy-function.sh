#!/bin/bash

# Deploy the packUploadVideo function using Firebase CLI
echo "Deploying packUploadVideo function using Firebase CLI..."

# Navigate to the backend directory
cd backend

# Deploy only the functions
firebase deploy --only functions

echo "Deployment completed!"
echo "Check the Firebase Console for the function URL"