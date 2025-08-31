# Create a cleanup script: cleanup-docker.sh
#!/bin/bash
echo "🧹 Docker cleanup routine..."

# Remove stopped containers
docker container prune -f

# Remove unused images (not all, just dangling ones)
docker image prune -f

# Remove unused networks
docker network prune -f

# Remove unused build cache (keep recent)
docker builder prune --keep-storage=2GB -f

echo "✅ Cleanup complete!"
df -h