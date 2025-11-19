# Deployment Guide

## Overview
We use a custom `build.sh` script to build and push the Docker image to Azure Container Registry (ACR), and then manually update the Azure Container App (ACA) revision.

## Prerequisites
- **Azure CLI**: Installed and logged in (`az login`).
- **Docker**: Installed and running.
- **Access**: Permission to push to `prospek.azurecr.io`.

## Deployment Steps

### 1. Prepare the Build
1.  Open `build.sh` in the root directory.
2.  Update the `IMAGE_TAG` variable to the new version (e.g., increment `v2.3.2-ww-1` to `v2.3.2-ww-2`).
    ```bash
    IMAGE_TAG=v2.3.2-ww-2
    ```
3.  Ensure you are on the correct branch:
    ```bash
    git rev-parse --abbrev-ref HEAD
    ```

### 2. Run Build & Push
Execute the build script:
```bash
./build.sh
```
This script will:
- Build the Docker image using the root `Dockerfile`.
- Tag it with the version specified.
- Log in to ACR (`prospek`).
- Push the image to `prospek.azurecr.io/evolution-api:<tag>`.

### 3. Verify Push (Optional)
Verify the tag exists in the registry:
```bash
az acr repository show-tags --name prospek --repository evolution-api --top 5 --orderby time_desc
```

### 4. Update Azure Container App
1.  Log in to the [Azure Portal](https://portal.azure.com).
2.  Navigate to **Container Apps** > **[Your Evolution App Name]**.
3.  Go to **Application** > **Containers**.
4.  Click **Edit and Deploy** (or "Create new revision").
5.  Select the container image and update the **Image tag** to the one you just pushed (e.g., `v2.3.2-ww-2`).
6.  Click **Save** / **Create** to deploy the new revision.

## Troubleshooting
- **Login Failed**: Run `az login` and try again.
- **Permission Denied**: Ensure your Azure user has `AcrPush` role on the `prospek` registry.
