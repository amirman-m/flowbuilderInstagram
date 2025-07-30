# Production Deployment Guide

This guide will help you deploy the Social Media Flow Builder application to production.

## 🚀 Quick Start

1. **Configure Environment Variables**
   ```bash
   cp .env.prod .env.production
   # Edit .env.production with your actual production values
   ```

2. **Deploy**
   ```bash
   # Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh

   # Windows
   deploy.bat
   ```

## 📋 Prerequisites

- Docker & Docker Compose installed
- Domain name (optional, for SSL)
- SSL certificates (optional, for HTTPS)

## 🔧 Configuration Steps

### 1. Environment Variables (.env.prod)

**CRITICAL: Update these values before deployment:**

```bash
# Database - Use strong credentials
POSTGRES_DB=socialmediaflow_prod
POSTGRES_USER=socialmedia_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# Security - Generate a strong secret key
SECRET_KEY=YOUR_SECURE_SECRET_KEY_HERE

# API Keys - Use production keys
OPENAI_API_KEY=your_production_openai_key
DEEPSEEK_API_KEY=your_production_deepseek_key

# Domain Configuration
BACKEND_CORS_ORIGINS=["https://yourdomain.com"]
VITE_API_URL=https://yourdomain.com
```

### 2. SSL Configuration (Optional but Recommended)

For HTTPS support:

1. **Obtain SSL certificates** (Let's Encrypt recommended):
   ```bash
   # Using certbot
   certbot certonly --webroot -w ./nginx/certbot -d yourdomain.com
   ```

2. **Update nginx configuration**:
   - Uncomment SSL lines in `nginx/conf.d/default.conf`
   - Update certificate paths
   - Enable HTTPS redirect

3. **Place certificates**:
   ```
   ssl/
   ├── fullchain.pem
   └── privkey.pem
   ```

### 3. Domain Configuration

Update these files with your domain:
- `nginx/conf.d/default.conf` - Replace `yourdomain.com`
- `.env.prod` - Update CORS origins and API URL

## 🏗️ Architecture

```
Internet → NGINX (Port 80/443) → Backend (Port 8000)
                                → Frontend (Port 3000)
                                → Database (Internal)
```

### Network Security
- Database is not exposed to the internet
- Backend and frontend only accessible through NGINX
- All services run in isolated Docker network
- Non-root users in containers

### Special Routes
- `/test` → Redirects to frontend homepage
- `/api/*` → Backend API endpoints
- `/health` → Health check endpoint
- `/*` → Frontend application

## 🐳 Docker Services

| Service | Container | Purpose | Exposed Ports |
|---------|-----------|---------|---------------|
| nginx | socialmedia_nginx | Reverse proxy | 80, 443 |
| backend | socialmedia_backend | FastAPI API | Internal only |
| frontend | socialmedia_frontend | React app | Internal only |
| db | socialmedia_db | PostgreSQL | Internal only |

## 📊 Monitoring & Logs

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f db
```

### Health Checks
- Backend: `http://yourdomain.com/health`
- Database: Built-in PostgreSQL health check
- Frontend: Built-in nginx health check

### Service Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

## 🔒 Security Features

### Application Security
- Non-root users in all containers
- Security headers (HSTS, CSP, etc.)
- Rate limiting on API endpoints
- CORS protection
- Input validation

### Network Security
- Internal Docker network
- No direct database access from internet
- Reverse proxy with security headers
- Optional SSL/TLS encryption

### Data Security
- Environment variables for secrets
- Secure database credentials
- API key protection

## 🚨 Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.prod.yml logs
   
   # Rebuild containers
   docker-compose -f docker-compose.prod.yml build --no-cache
   ```

2. **Database connection errors**
   - Check database credentials in `.env.prod`
   - Ensure database service is healthy
   - Verify network connectivity

3. **Frontend can't reach backend**
   - Check CORS configuration
   - Verify API URL in frontend environment
   - Check nginx proxy configuration

4. **SSL issues**
   - Verify certificate paths
   - Check certificate validity
   - Ensure nginx SSL configuration is correct

### Debug Commands
```bash
# Enter container shell
docker exec -it socialmedia_backend bash
docker exec -it socialmedia_frontend sh
docker exec -it socialmedia_db psql -U postgres -d socialmediaflow_prod

# Check container resources
docker stats

# Check network connectivity
docker network ls
docker network inspect socialmedia_network
```

## 🔄 Updates & Maintenance

### Deploy Updates
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database Backup
```bash
# Backup
docker exec socialmedia_db pg_dump -U postgres socialmediaflow_prod > backup.sql

# Restore
docker exec -i socialmedia_db psql -U postgres socialmediaflow_prod < backup.sql
```

### Clean Up
```bash
# Remove unused images
docker image prune

# Remove unused volumes (CAREFUL!)
docker volume prune
```

## 📈 Performance Optimization

### Backend
- Multiple workers (configured in Dockerfile.prod)
- Connection pooling
- Async request handling

### Frontend
- Static asset caching
- Gzip compression
- Optimized build

### Database
- Connection pooling
- Indexed queries
- Regular maintenance

### NGINX
- Gzip compression
- Static file caching
- Rate limiting
- Keep-alive connections

## 🌐 Scaling Considerations

For high-traffic deployments:

1. **Load Balancing**: Add multiple backend instances
2. **Database**: Consider PostgreSQL clustering
3. **Caching**: Add Redis for session/data caching
4. **CDN**: Use CDN for static assets
5. **Monitoring**: Add Prometheus/Grafana

## 📞 Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Check Docker and service status
4. Verify environment configuration
