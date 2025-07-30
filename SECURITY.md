# Security Checklist for Production

## 🔒 Pre-Deployment Security Checklist

### Environment & Secrets
- [ ] **Change default database credentials** in `.env.prod`
- [ ] **Generate strong SECRET_KEY** (use `openssl rand -hex 32`)
- [ ] **Use production API keys** (not development/test keys)
- [ ] **Remove or secure .env files** (never commit to git)
- [ ] **Set proper CORS origins** (no wildcards in production)
- [ ] **Review all environment variables** for sensitive data

### Database Security
- [ ] **Strong PostgreSQL password** (min 16 chars, mixed case, numbers, symbols)
- [ ] **Database not exposed** to internet (no port mapping in production)
- [ ] **Regular backups configured**
- [ ] **Database user has minimal privileges**

### Application Security
- [ ] **HTTPS enabled** with valid SSL certificates
- [ ] **Security headers configured** (HSTS, CSP, X-Frame-Options)
- [ ] **Rate limiting enabled** on API endpoints
- [ ] **Input validation** on all endpoints
- [ ] **Authentication/Authorization** properly implemented
- [ ] **Error messages** don't leak sensitive information

### Container Security
- [ ] **Non-root users** in all containers
- [ ] **Minimal base images** (alpine/slim variants)
- [ ] **No unnecessary packages** installed
- [ ] **Container health checks** configured
- [ ] **Resource limits** set for containers

### Network Security
- [ ] **Internal Docker network** configured
- [ ] **Services not directly exposed** (only through nginx)
- [ ] **Firewall rules** configured on host
- [ ] **VPN/Private network** for administrative access

## 🛡️ Security Headers Implemented

The nginx configuration includes these security headers:

```nginx
# Prevent clickjacking
add_header X-Frame-Options DENY always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options nosniff always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# HSTS (when using HTTPS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';" always;
```

## 🚨 Security Monitoring

### Log Monitoring
Monitor these logs for security events:
- Failed authentication attempts
- Unusual API usage patterns
- Database connection errors
- Rate limit violations

### Health Monitoring
- Service availability
- Response times
- Error rates
- Resource usage

## 🔧 Security Tools

### Recommended Tools
- **SSL Labs**: Test SSL configuration
- **OWASP ZAP**: Security testing
- **Docker Bench**: Container security audit
- **Trivy**: Container vulnerability scanning

### Commands for Security Audit
```bash
# Check for vulnerabilities in images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image socialmediaflow_backend

# Check SSL configuration (if using HTTPS)
curl -I https://yourdomain.com

# Test security headers
curl -I http://yourdomain.com
```

## 🔄 Regular Security Tasks

### Weekly
- [ ] Review access logs
- [ ] Check for failed login attempts
- [ ] Monitor resource usage

### Monthly
- [ ] Update container images
- [ ] Review and rotate API keys
- [ ] Check SSL certificate expiry
- [ ] Security scan of containers

### Quarterly
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Review and update security policies
- [ ] Update dependencies

## 🚫 Common Security Mistakes to Avoid

1. **Hardcoded secrets** in code
2. **Default passwords** in production
3. **Overly permissive CORS** settings
4. **Exposing internal services** directly
5. **Running containers as root**
6. **Missing security headers**
7. **Unencrypted communication**
8. **Insufficient logging**
9. **No rate limiting**
10. **Outdated dependencies**
