#!/bin/bash
set -ew

# Configuration
REGISTRY_URL=prospek.azurecr.io
IMAGE_NAME=evolution-api
# TODO: Update this tag before every build
IMAGE_TAG=v2.3.2-ww-1 
IMAGE_URI=$REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG

echo "Building $IMAGE_URI..."

# 1. Build
# Assuming Dockerfile is in the root directory
docker build -f Dockerfile -t $IMAGE_NAME:latest .

# 2. Tag
docker tag $IMAGE_NAME:latest $IMAGE_URI

# 3. Login & Push
# Ensure you are logged in to Azure CLI (az login) first
az acr login --name prospek
docker push $IMAGE_URI

echo "Build and push complete: $IMAGE_URI"
echo "Next: Go to Azure Portal > Container App > Revision Management > Create New Revision"
