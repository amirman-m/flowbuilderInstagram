#!/bin/bash

# Production Deployment Script for Social Media Flow Builder
# This script helps deploy the application to production

set -e

echo "🚀 Social Media Flow Builder - Production Deployment"
echo "=================================================="

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    echo "❌ Error: .env.prod file not found!"
    echo "Please copy .env.prod.example to .env.prod and configure it with your production values."
    exit 1
fi

# Check if required environment variables are set
echo "🔍 Checking environment configuration..."
source .env.prod

required_vars=("POSTGRES_PASSWORD" "SECRET_KEY" "OPENAI_API_KEY" "DEEPSEEK_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ] || [[ "${!var}" == *"CHANGE_THIS"* ]] || [[ "${!var}" == *"your_"* ]]; then
        echo "❌ Error: $var is not properly configured in .env.prod"
        echo "Please update .env.prod with your production values."
        exit 1
    fi
done

echo "✅ Environment configuration looks good!"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p ssl
mkdir -p database/init
mkdir -p logs

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.prod.yml down --remove-orphans
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up (healthy)"; then
        echo "✅ Services are healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Services failed to become healthy. Check logs:"
        docker-compose -f docker-compose.prod.yml logs
        exit 1
    fi
    echo "Waiting... ($i/30)"
    sleep 5
done

# Show running services
echo "📊 Running services:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "Your application is now running at:"
echo "  - HTTP:  http://localhost"
echo "  - HTTPS: https://localhost (if SSL configured)"
echo ""
echo "API endpoints:"
echo "  - Health: http://localhost/health"
echo "  - API:    http://localhost/api/v1/"
echo ""
echo "Special routes:"
echo "  - /test → redirects to frontend"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose -f docker-compose.prod.yml down"
