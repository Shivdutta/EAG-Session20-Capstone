# Local test: docker run --env-file .env -p 8000:8000 myapp-backend:latest

# Variables
$RESOURCE_GROUP = "<your-value>"
$LOCATION = "<your-value>"
$ACR_NAME = "<your-value>"
$FRONTEND_IMAGE = "<your-value>"
$BACKEND_IMAGE = "<your-value>"
$FRONTEND_WEBAPP = "<your-value>"
$BACKEND_WEBAPP = "<your-value>"
$PLAN_NAME = "<your-value>"
$GEMINI_API_KEY = "<your-value>"

# Build Docker images
Write-Host "Building frontend image..." -ForegroundColor Green
docker build -t ${FRONTEND_IMAGE} --build-arg REACT_APP_API_URL="https://${BACKEND_WEBAPP}.azurewebsites.net/api" ./frontend
Write-Host "Building backend image..." -ForegroundColor Green
docker build -t ${BACKEND_IMAGE} .
Write-Host "Waiting 30 seconds before next step..." -ForegroundColor Yellow
Start-Sleep 30

# Create Azure resources
Write-Host "Creating resource group..." -ForegroundColor Green
az group create --name $RESOURCE_GROUP --location $LOCATION
Write-Host "Creating Azure Container Registry..." -ForegroundColor Green
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic
Write-Host "Enabling ACR admin user..." -ForegroundColor Green
az acr update --name $ACR_NAME --admin-enabled true
Write-Host "Logging into ACR..." -ForegroundColor Green
az acr login --name $ACR_NAME
Write-Host "Waiting 30 seconds before next step..." -ForegroundColor Yellow
Start-Sleep 30

# Tag and push images
Write-Host "Tagging images for ACR..." -ForegroundColor Green
docker tag ${FRONTEND_IMAGE} "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}"
docker tag ${BACKEND_IMAGE} "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}"
Write-Host "Pushing frontend image..." -ForegroundColor Green
docker push "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}"
Write-Host "Pushing backend image..." -ForegroundColor Green
docker push "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}"
Write-Host "Waiting 30 seconds before next step..." -ForegroundColor Yellow
Start-Sleep 30

# Get ACR credentials
Write-Host "Getting ACR credentials..." -ForegroundColor Green
Write-Host "Waiting for ACR to be fully ready..." -ForegroundColor Yellow
Start-Sleep 60
$ACR_USER = az acr credential show --name $ACR_NAME --query username -o tsv
$ACR_PASS = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv

# Create App Service plan
Write-Host "Creating App Service plan..." -ForegroundColor Green
az appservice plan create --name $PLAN_NAME --resource-group $RESOURCE_GROUP --sku B1 --is-linux

# Create Web Apps
Write-Host "Creating frontend web app..." -ForegroundColor Green
az webapp create --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --name $FRONTEND_WEBAPP --deployment-container-image-name "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}"
Write-Host "Creating backend web app..." -ForegroundColor Green
az webapp create --resource-group $RESOURCE_GROUP --plan $PLAN_NAME --name $BACKEND_WEBAPP --deployment-container-image-name "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}"
Write-Host "Waiting for web apps to initialize..." -ForegroundColor Yellow
Start-Sleep 90

# Configure container registry access
Write-Host "Configuring container registry for frontend..." -ForegroundColor Green
az webapp config container set --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP --container-image-name "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}" --container-registry-url "https://${ACR_NAME}.azurecr.io" --container-registry-user $ACR_USER --container-registry-password $ACR_PASS
Write-Host "Configuring container registry for backend..." -ForegroundColor Green
az webapp config container set --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP --container-image-name "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}" --container-registry-url "https://${ACR_NAME}.azurecr.io" --container-registry-user $ACR_USER --container-registry-password $ACR_PASS
Write-Host "Waiting for container configuration to apply..." -ForegroundColor Yellow
Start-Sleep 60

# Set environment variables and ports
Write-Host "Setting frontend app settings..." -ForegroundColor Green
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP --settings WEBSITES_PORT=3000 REACT_APP_API_URL="https://${BACKEND_WEBAPP}.azurewebsites.net/api"
Write-Host "Setting backend app settings..." -ForegroundColor Green
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP --settings WEBSITES_PORT=8000 GEMINI_API_KEY=$GEMINI_API_KEY

# Configure WebSockets
Write-Host "Enabling WebSockets..." -ForegroundColor Green
az webapp config set --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP --web-sockets-enabled true
az webapp config set --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP --web-sockets-enabled true
Write-Host "Waiting for all settings to propagate..." -ForegroundColor Yellow
Start-Sleep 60

# Restart apps
Write-Host "Restarting apps..." -ForegroundColor Green
az webapp restart --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP
az webapp restart --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP

# Output URLs
Write-Host "`nDeployment completed successfully! ✅" -ForegroundColor Yellow
Write-Host "Frontend URL:" -ForegroundColor Cyan
az webapp show --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP --query "defaultHostName" --output tsv
Write-Host "Backend URL:" -ForegroundColor Cyan
az webapp show --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP --query "defaultHostName" --output tsv