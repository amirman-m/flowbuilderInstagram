// OAuth configuration for Google login via Keycloak
export const OAUTH_CONFIG = {
  KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM || 'social-media-flow',
  KEYCLOAK_CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'your-existing-client-id',
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
};

// Generate Google OAuth URL via Keycloak
export const generateGoogleOAuthUrl = (): string => {
  const keycloakAuthUrl = `${OAUTH_CONFIG.KEYCLOAK_URL}/realms/${OAUTH_CONFIG.KEYCLOAK_REALM}/protocol/openid-connect/auth`;
  
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.KEYCLOAK_CLIENT_ID,
    redirect_uri: `${OAUTH_CONFIG.FRONTEND_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    kc_idp_hint: 'google' // This tells Keycloak to use Google as identity provider
  });
  
  return `${keycloakAuthUrl}?${params.toString()}`;
};
