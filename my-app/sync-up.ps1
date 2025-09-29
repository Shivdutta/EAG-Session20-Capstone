# Variables
$RESOURCE_GROUP = "<your-value>"
$ACR_NAME = "<your-value>"
$FRONTEND_IMAGE = "<your-value>"
$BACKEND_IMAGE = "<your-value>"
$FRONTEND_WEBAPP = "<your-value>"
$BACKEND_WEBAPP = "<your-value>"
$GEMINI_API_KEY = "<your-value>"

# STEP 1: Build Docker images
Write-Host "STEP 1: Building frontend image..." -ForegroundColor Green
docker build -t ${FRONTEND_IMAGE} --build-arg REACT_APP_API_URL="https://${BACKEND_WEBAPP}.azurewebsites.net/api" ./frontend

Write-Host "STEP 1: Building backend image..." -ForegroundColor Green
docker build -t ${BACKEND_IMAGE} .

Write-Host "Waiting for images to be ready..." -ForegroundColor Yellow
Start-Sleep 30

# STEP 2: Login to ACR
Write-Host "STEP 2: Logging into ACR..." -ForegroundColor Green
az acr login --name $ACR_NAME

# STEP 3: Tag images for ACR
Write-Host "STEP 3: Tagging images for ACR..." -ForegroundColor Green
docker tag ${FRONTEND_IMAGE} "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}"
docker tag ${BACKEND_IMAGE} "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}"

# STEP 4: Push images to ACR
Write-Host "STEP 4: Pushing frontend image..." -ForegroundColor Green
docker push "${ACR_NAME}.azurecr.io/${FRONTEND_IMAGE}"

Write-Host "STEP 4: Pushing backend image..." -ForegroundColor Green
docker push "${ACR_NAME}.azurecr.io/${BACKEND_IMAGE}"

Write-Host "Waiting for images to be available in ACR..." -ForegroundColor Yellow
Start-Sleep 60

# Set environment variables and ports
Write-Host "Setting frontend app settings..." -ForegroundColor Green
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP --settings WEBSITES_PORT=3000 REACT_APP_API_URL="https://${BACKEND_WEBAPP}.azurewebsites.net/api"
Write-Host "Setting backend app settings..." -ForegroundColor Green
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP --settings WEBSITES_PORT=8000 GEMINI_API_KEY=$GEMINI_API_KEY


# STEP 5: Restart web apps
Write-Host "STEP 5: Restarting web apps..." -ForegroundColor Green
az webapp restart --resource-group $RESOURCE_GROUP --name $FRONTEND_WEBAPP
az webapp restart --resource-group $RESOURCE_GROUP --name $BACKEND_WEBAPP

Write-Host "Waiting for web apps to fully restart..." -ForegroundColor Yellow
Start-Sleep 90

Write-Host "`nUpdate completed successfully! ✅" -ForegroundColor Yellow