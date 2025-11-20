#!/bin/bash
set -e

# Configuration
REGISTRY_URL=prospek.azurecr.io
IMAGE_NAME=evolution

# 1. Get Version from package.json
VERSION=$(grep '"version":' package.json | cut -d '"' -f 4)

# 2. Get Short Commit Hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# 3. Construct Image Tag
# Format: v<version>-<project>-<commit>
# Example: v2.3.2-evolution-b685478
IMAGE_TAG="v${VERSION}-${IMAGE_NAME}-${COMMIT_HASH}"
IMAGE_URI="$REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG"

echo "----------------------------------------"
echo "Build Configuration:"
echo "Registry: $REGISTRY_URL"
echo "Image:    $IMAGE_NAME"
echo "Version:  $VERSION"
echo "Commit:   $COMMIT_HASH"
echo "Tag:      $IMAGE_TAG"
echo "Full URI: $IMAGE_URI"
echo "----------------------------------------"

# 4. Build
echo "Building Docker image..."
docker build -f Dockerfile -t $IMAGE_NAME:latest .
docker tag $IMAGE_NAME:latest $IMAGE_URI

# 5. Push
echo "Pushing to Azure Container Registry..."
# Ensure you are logged in to Azure CLI (az login) first
az acr login --name prospek
docker push $IMAGE_URI

echo "----------------------------------------"
echo "SUCCESS: Image pushed to $IMAGE_URI"
echo "Next Steps:"
echo "1. Go to Azure Portal > Container Apps > [Your App]"
echo "2. Create new revision with image tag: $IMAGE_TAG"
echo "----------------------------------------"
