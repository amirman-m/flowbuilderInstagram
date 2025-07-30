@echo off
setlocal enabledelayedexpansion

echo 🚀 Social Media Flow Builder - Production Deployment
echo ==================================================

REM Check if .env.prod exists
if not exist ".env.prod" (
    echo ❌ Error: .env.prod file not found!
    echo Please copy .env.prod to your actual production environment file and configure it.
    pause
    exit /b 1
)

echo 🔍 Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Docker is not installed or not in PATH
    echo Please install Docker Desktop and try again.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Docker Compose is not installed or not in PATH
    echo Please install Docker Compose and try again.
    pause
    exit /b 1
)

echo ✅ Docker installation looks good!

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist "ssl" mkdir ssl
if not exist "database\init" mkdir database\init
if not exist "logs" mkdir logs

REM Build and start services
echo 🏗️  Building and starting services...
docker-compose -f docker-compose.prod.yml down --remove-orphans
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 15 /nobreak >nul

REM Show running services
echo 📊 Running services:
docker-compose -f docker-compose.prod.yml ps

echo.
echo 🎉 Deployment completed!
echo.
echo Your application is now running at:
echo   - HTTP:  http://localhost
echo   - API:   http://localhost/api/v1/
echo   - Health: http://localhost/health
echo.
echo Special routes:
echo   - /test → redirects to frontend
echo.
echo To view logs:
echo   docker-compose -f docker-compose.prod.yml logs -f
echo.
echo To stop services:
echo   docker-compose -f docker-compose.prod.yml down
echo.
pause
