@echo off
echo Starting Social Media Flow Application...
echo.
echo This will start:
echo - PostgreSQL Database (port 5432)
echo - Backend API (port 8000)
echo - Frontend React App (port 3000)
echo.
echo Please wait while Docker builds and starts the services...
echo.

docker-compose up --build

echo.
echo Application stopped.
pause
