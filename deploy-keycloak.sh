#!/bin/bash

# Production Keycloak Deployment Script for Hetzner 4GB VPS
# This script addresses common Keycloak deployment issues on resource-constrained servers

set -e

echo "🚀 Starting Keycloak deployment for production..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  This script should not be run as root for security reasons"
   exit 1
fi

# Verify required files exist
echo "📋 Checking required files..."
required_files=(".env.prod" "docker-compose.prod.yml" "Dockerfile.keycloak" "ssl/dhparam.pem")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Missing required file: $file"
        if [[ "$file" == "ssl/dhparam.pem" ]]; then
            echo "💡 Run: mkdir -p ssl && openssl dhparam -out ssl/dhparam.pem 2048"
        fi
        exit 1
    fi
done

# Check system resources
echo "🔍 Checking system resources..."
total_mem=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [[ $total_mem -lt 3500 ]]; then
    echo "⚠️  Warning: System has ${total_mem}MB RAM. Keycloak needs at least 3.5GB for stable operation."
    echo "💡 Consider upgrading to a larger VPS or optimizing other services."
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true

# Clean up old images to free space
echo "🧹 Cleaning up old Docker images..."
docker system prune -f
docker image prune -f

# Copy environment file
echo "📄 Setting up environment..."
cp .env.prod .env

# Build Keycloak with no cache (important for Dockerfile changes)
echo "🏗️  Building Keycloak image (this may take 5-10 minutes)..."
docker compose -f docker-compose.prod.yml build --no-cache keycloak

# Start database and Redis first
echo "🗄️  Starting database and Redis..."
docker compose -f docker-compose.prod.yml up -d db redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
timeout=60
counter=0
while ! docker exec socialmedia_db pg_isready -U ${POSTGRES_USER:-socialmedia_user} -d ${POSTGRES_DB:-socialmediaflow_prod} > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [[ $counter -ge $timeout ]]; then
        echo "❌ Database failed to start within ${timeout} seconds"
        docker logs socialmedia_db
        exit 1
    fi
done
echo "✅ Database is ready"

# Start Keycloak
echo "🔐 Starting Keycloak..."
docker compose -f docker-compose.prod.yml up -d keycloak

# Monitor Keycloak startup
echo "⏳ Waiting for Keycloak to start (this can take 2-3 minutes)..."
timeout=300
counter=0
while ! docker exec socialmedia_keycloak curl -f http://localhost:8080/auth/health/ready > /dev/null 2>&1; do
    sleep 5
    counter=$((counter + 5))
    if [[ $counter -ge $timeout ]]; then
        echo "❌ Keycloak failed to start within ${timeout} seconds"
        echo "📋 Keycloak logs:"
        docker logs --tail 50 socialmedia_keycloak
        exit 1
    fi
    echo "⏳ Still waiting... (${counter}s/${timeout}s)"
done
echo "✅ Keycloak is ready"

# Start remaining services
echo "🌐 Starting remaining services..."
docker compose -f docker-compose.prod.yml up -d

# Final health check
echo "🏥 Performing final health checks..."
sleep 10

services=("socialmedia_db" "socialmedia_redis" "socialmedia_keycloak" "socialmedia_backend" "socialmedia_frontend" "socialmedia_nginx")
for service in "${services[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
        echo "✅ $service is running"
    else
        echo "❌ $service is not running"
        docker logs --tail 20 "$service"
    fi
done

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🔗 Access your services:"
echo "   • Keycloak Admin: https://asangram.tech/auth/admin"
echo "   • Frontend: https://asangram.tech/"
echo "   • Backend API: https://asangram.tech/api/"
echo ""
echo "📊 Monitor with:"
echo "   docker ps"
echo "   docker logs -f socialmedia_keycloak"
echo "   docker stats"
echo ""
echo "🔧 Troubleshooting:"
echo "   • If Keycloak shows unhealthy: docker compose -f docker-compose.prod.yml restart keycloak"
echo "   • Check memory usage: free -h"
echo "   • View all logs: docker compose -f docker-compose.prod.yml logs"
