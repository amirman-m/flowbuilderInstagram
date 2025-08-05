# Keycloak Setup Guide for Social Media Flow Application

This guide explains how to set up Keycloak for authentication in your Social Media Flow application.

## Overview

The application now uses Keycloak for authentication with the following flow:
1. **Frontend** → Sends login/register payload to backend
2. **Backend** → Forwards credentials to Keycloak
3. **Keycloak** → Returns access/refresh tokens to backend
4. **Backend** → Stores refresh token securely, returns only access token to frontend
5. **Frontend** → Stores access token securely in localStorage

## Architecture Components

### Backend Components
- **Keycloak Service** (`app/services/keycloak_service.py`) - Handles Keycloak API communication
- **Redis Service** (`app/services/redis_service.py`) - Manages token storage and user backup
- **User Service** (`app/services/user_service.py`) - User management with Postgres/Redis failover
- **Updated Auth API** (`app/api/v1/auth.py`) - Keycloak-integrated authentication endpoints

### Frontend Components
- **Updated Auth Store** (`store/authStore.ts`) - Secure token management with localStorage
- **API Service** (`services/api.ts`) - Automatic token injection and expiration handling
- **Login/Register Pages** - Updated to work with Keycloak flow

### Database Changes
- **User Model** - Added `keycloak_id` field for Keycloak user mapping
- **Migration** - Database migration to add Keycloak support

## Keycloak Configuration Steps

### 1. Start Services
```bash
docker-compose up -d
```

### 2. Access Keycloak Admin Console
- URL: http://localhost:8080
- Username: `admin`
- Password: `admin`

### 3. Create Realm
1. Click on "Master" dropdown in top-left
2. Click "Create Realm"
3. Set Realm name: `socialmediaflow`
4. Click "Create"

### 4. Create Client
1. Navigate to "Clients" in left sidebar
2. Click "Create client"
3. Set Client ID: `socialmediaflow-backend`
4. Set Client type: `OpenID Connect`
5. Click "Next"
6. Enable "Client authentication"
7. Enable "Authorization"
8. Enable "Standard flow"
9. Enable "Direct access grants"
10. Click "Save"

### 5. Configure Client Settings
1. Go to client "Settings" tab
2. Set "Access Type": `confidential`
3. Set "Valid Redirect URIs": `http://localhost:3000/*`
4. Set "Web Origins": `http://localhost:3000`
5. Click "Save"

### 6. Get Client Secret
1. Go to "Credentials" tab
2. Copy the "Client Secret"
3. Update your environment variables:

```bash
# In docker-compose.yml or .env file
KEYCLOAK_CLIENT_SECRET=your-actual-client-secret-here
```

### 7. Configure Realm Settings
1. Go to "Realm Settings" → "Login"
2. Enable "User registration"
3. Enable "Forgot password"
4. Enable "Remember me"
5. Click "Save"

### 8. Configure Token Settings
1. Go to "Realm Settings" → "Tokens"
2. Set "Access Token Lifespan": `15 minutes` (recommended)
3. Set "Refresh Token Lifespan": `30 days`
4. Click "Save"

## Environment Variables

Update your environment variables in `docker-compose.yml`:

```yaml
environment:
  - DATABASE_URL=postgresql://postgres:postgres@db:5432/socialmediaflow
  - REDIS_URL=redis://redis:6379/0
  - KEYCLOAK_URL=http://keycloak:8080
  - KEYCLOAK_REALM=socialmediaflow
  - KEYCLOAK_CLIENT_ID=socialmediaflow-backend
  - KEYCLOAK_CLIENT_SECRET=your-actual-client-secret-here
  - ENVIRONMENT=development
```

## Security Features

### Backend Security
- **Refresh Token Storage**: Stored securely in Redis with expiration
- **User Data Backup**: Stored in both Postgres and Redis for failover
- **Token Validation**: All API requests validate access tokens with Keycloak
- **Error Handling**: Comprehensive error handling for Keycloak failures

### Frontend Security
- **Access Token Only**: Frontend never sees refresh tokens
- **Secure Storage**: Access tokens stored in localStorage (consider httpOnly cookies for production)
- **Automatic Expiration**: Tokens automatically cleared on expiration
- **Request Interception**: All API requests automatically include access token

## Testing the Setup

### 1. Register a New User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Test Protected Endpoint
```bash
curl -X GET http://localhost:8000/api/v1/flows/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Troubleshooting

### Common Issues

1. **Keycloak not starting**
   - Check if port 8080 is available
   - Ensure PostgreSQL is running first
   - Check logs: `docker-compose logs keycloak`

2. **Client secret mismatch**
   - Verify client secret in Keycloak matches environment variable
   - Restart backend after updating secret

3. **Token validation fails**
   - Check Keycloak realm and client configuration
   - Verify token hasn't expired
   - Check network connectivity between services

4. **User registration fails**
   - Check Keycloak user registration is enabled
   - Verify client has proper permissions
   - Check backend logs for detailed errors

### Logs
```bash
# Backend logs
docker-compose logs backend

# Keycloak logs
docker-compose logs keycloak

# Redis logs
docker-compose logs redis
```

## Production Considerations

### Security Enhancements
1. **Use HTTPS**: Configure SSL certificates for all services
2. **Secure Secrets**: Use proper secret management (not environment variables)
3. **Token Storage**: Consider httpOnly cookies instead of localStorage
4. **CORS**: Configure proper CORS settings
5. **Rate Limiting**: Implement rate limiting for auth endpoints

### Monitoring
1. **Health Checks**: Monitor Keycloak, Redis, and Postgres health
2. **Token Metrics**: Track token usage and expiration
3. **Error Monitoring**: Monitor authentication failures
4. **Performance**: Monitor response times for auth operations

### Backup Strategy
1. **Keycloak Database**: Regular backups of Keycloak's Postgres data
2. **Redis Data**: Configure Redis persistence
3. **User Data**: Ensure both Postgres and Redis backups

## API Reference

### Register Endpoint
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### Login Endpoint
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Logout Endpoint
```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

## Next Steps

1. **Social Login**: Add Google OAuth integration with Keycloak
2. **Multi-Factor Authentication**: Enable MFA in Keycloak
3. **Role-Based Access**: Implement roles and permissions
4. **Session Management**: Add session monitoring and management
5. **Audit Logging**: Implement comprehensive audit logging

This completes the Keycloak integration setup. Your application now has enterprise-grade authentication with secure token management and failover capabilities.
