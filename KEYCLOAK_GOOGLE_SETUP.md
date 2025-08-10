# Keycloak Google OAuth Integration Setup Guide

This guide explains how to configure your existing Keycloak client to support Google OAuth login while maintaining your current authentication architecture.

## Overview

The implementation uses your **existing Keycloak client** with multiple redirect URIs to support both:
- Traditional email/password login (backend callback)
- Google OAuth login (frontend callback)

Both flows converge at the same token storage system (Redis + HttpOnly cookies).

## Keycloak Client Configuration

### 1. Update Your Existing Client Settings

In your Keycloak Admin Console, navigate to your existing client and update these settings:

#### **Valid Redirect URIs**
Add the frontend callback URI to your existing list:
```
https://your-backend.com/auth/callback          (keep existing)
https://your-frontend.com/auth/google/callback  (add this)
```

For development:
```
http://localhost:8000/auth/callback              (keep existing)
http://localhost:3000/auth/google/callback       (add this)
```

#### **Web Origins**
Add your frontend domain:
```
https://your-frontend.com                        (add this)
```

For development:
```
http://localhost:3000                            (add this)
```

#### **Access Type**
Keep as: `confidential`

#### **Client ID**
Keep your existing: `your-existing-client-id`

### 2. Configure Google Identity Provider

#### **Add Google as Identity Provider**
1. Go to **Identity Providers** in your realm
2. Click **Add provider** → **Google**
3. Configure:
   - **Alias**: `google`
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
   - **Default Scopes**: `openid email profile`

#### **Get Google OAuth Credentials**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     ```
     http://localhost:8080/realms/social-media-flow/broker/google/endpoint
     https://your-keycloak-domain/realms/your-realm/broker/google/endpoint
     ```

## Environment Variables

### Backend (.env)
```env
# Existing Keycloak settings (keep these)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=social-media-flow
KEYCLOAK_CLIENT_ID=your-existing-client-id
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Add frontend URL for OAuth callbacks
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
# Add these OAuth configuration variables
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=social-media-flow
VITE_KEYCLOAK_CLIENT_ID=your-existing-client-id
VITE_FRONTEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Authentication Flow

### Traditional Email/Password Login
```
User → Frontend Login Form → Backend /auth/login → Keycloak → Backend → HttpOnly Cookies
```

### Google OAuth Login
```
User → Frontend "Login with Google" → Keycloak Auth URL (kc_idp_hint=google) 
  → Google OAuth → Keycloak → Frontend /auth/google/callback 
  → Backend /auth/google/callback → HttpOnly Cookies
```

## Key Features

### ✅ **Same Client, Different Flows**
- Uses your existing Keycloak client for both authentication methods
- No need to create separate clients or duplicate configuration

### ✅ **Unified Token Storage**
- Both flows result in the same token format and storage mechanism
- Redis caching + HttpOnly cookies for maximum security
- Same token rotation (5min access, 30min refresh)

### ✅ **Automatic User Registration**
- Google OAuth automatically creates users if they don't exist
- Links existing users by email address
- Maintains same user data structure

### ✅ **No Architecture Changes**
- Existing `/login`, `/refresh`, `/logout` endpoints unchanged
- Same authentication middleware and dependencies
- Same security features (rate limiting, validation, etc.)

## Testing the Integration

### 1. **Start Services**
```bash
# Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend  
cd frontend
npm run dev
```

### 2. **Test Google Login**
1. Navigate to `http://localhost:3000/login`
2. Click "Continue with Google"
3. Should redirect to Keycloak → Google → Back to frontend
4. Should automatically log you in and redirect to dashboard

### 3. **Verify Token Storage**
- Check browser cookies for `access_token` and `refresh_token` (HttpOnly)
- Verify tokens are stored in Redis
- Test automatic token refresh

## Troubleshooting

### **Common Issues**

1. **"Invalid redirect URI"**
   - Ensure frontend callback URI is added to Keycloak client
   - Check exact URL format (no trailing slashes)

2. **"Client not found"**
   - Verify KEYCLOAK_CLIENT_ID matches your existing client
   - Check realm name is correct

3. **"Google provider not found"**
   - Ensure Google identity provider is configured with alias `google`
   - Verify Google OAuth credentials are correct

4. **CORS errors**
   - Add frontend domain to backend CORS origins
   - Add frontend domain to Keycloak Web Origins

### **Debug Steps**
1. Check browser network tab for failed requests
2. Check backend logs for authentication errors
3. Check Keycloak logs for OAuth flow issues
4. Verify environment variables are loaded correctly

## Security Considerations

- **HttpOnly Cookies**: Prevent XSS attacks
- **CSRF Protection**: SameSite cookie attributes
- **Token Rotation**: Short-lived access tokens with automatic refresh
- **Signature Verification**: Full JWT validation with Keycloak public keys
- **Rate Limiting**: Multi-layer protection on auth endpoints

This setup provides enterprise-level security while maintaining excellent user experience with seamless Google OAuth integration.
