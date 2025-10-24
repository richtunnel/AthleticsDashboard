#!/bin/bash

# Deploy Athletics Dashboard to Google Cloud Run
# Usage: ./deploy-cloud-run.sh [PROJECT_ID] [REGION]

set -e

# Configuration
PROJECT_ID="${1:-your-gcp-project-id}"
REGION="${2:-us-central1}"
SERVICE_NAME="athletics-dashboard"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying $SERVICE_NAME to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Authenticate (if needed)
echo "📝 Checking authentication..."
gcloud auth list

# Set project
echo "🔧 Setting project..."
gcloud config set project $PROJECT_ID

# Build the Docker image
echo "🐳 Building Docker image..."
docker build --platform linux/amd64 -t $IMAGE_NAME:latest .

# Tag with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker tag $IMAGE_NAME:latest $IMAGE_NAME:$TIMESTAMP

# Push to Google Container Registry
echo "📤 Pushing image to GCR..."
docker push $IMAGE_NAME:latest
docker push $IMAGE_NAME:$TIMESTAMP

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "NODE_ENV=production"

# Note: Set secrets separately using Secret Manager
echo ""
echo "⚠️  Remember to set secrets using Secret Manager:"
echo ""
echo "gcloud run services update $SERVICE_NAME \\"
echo "  --region $REGION \\"
echo "  --set-secrets DATABASE_URL=database-url:latest,\\"
echo "NEXTAUTH_SECRET=nextauth-secret:latest,\\"
echo "GOOGLE_CALENDAR_CLIENT_SECRET=google-calendar-secret:latest,\\"
echo "RESEND_API_KEY=resend-api-key:latest,\\"
echo "OPENAI_API_KEY=openai-api-key:latest"
echo ""

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Update NEXTAUTH_URL environment variable to: $SERVICE_URL"
echo "2. Configure your secrets in Secret Manager"
echo "3. Update OAuth redirect URIs in Google Cloud Console"
echo "4. Test the deployment: curl $SERVICE_URL/api/health"
