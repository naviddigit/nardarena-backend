# 🚀 Nard Arena - Production Deployment Roadmap

## 📋 Table of Contents
1. [Infrastructure Setup (Hetzner)](#1-infrastructure-setup-hetzner)
2. [Docker & Portainer Configuration](#2-docker--portainer-configuration)
3. [CI/CD Pipeline (GitHub Actions)](#3-cicd-pipeline-github-actions)
4. [Database & Backup Strategy](#4-database--backup-strategy)
5. [Monitoring & Scaling](#5-monitoring--scaling)
6. [Email Service Integration](#6-email-service-integration)
7. [Security Checklist](#7-security-checklist)

---

## 1. Infrastructure Setup (Hetzner)

### 1.1 Server Selection

**Recommended Configuration:**
```yaml
Provider: Hetzner Cloud
Server Type: CPX31 (4 vCPU, 8GB RAM, 160GB SSD)
Location: Falkenstein, Germany (best for EU/Middle East)
Monthly Cost: ~20€ (~22$)

Suitable for:
- 1,000-5,000 concurrent users
- Database on same server
- Redis caching
- WebSocket connections
```

**Order Steps:**
1. Sign up at https://www.hetzner.com/cloud
2. Create new project: "Nard Arena Production"
3. Add Cloud Server (CPX31)
4. Choose Ubuntu 22.04 LTS
5. Add SSH key for secure access
6. Enable backups (+20% cost, highly recommended!)

### 1.2 Hetzner Load Balancer (Optional - for scaling)

```yaml
When to use: 2,000+ concurrent users
Type: LB11 (5TB traffic/month)
Cost: ~5.39€/month

Features:
- Health checks
- SSL termination
- Sticky sessions
- Automatic failover

Setup later when needed!
```

### 1.3 Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y curl git ufw fail2ban

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8083/tcp  # Frontend (temporary)
ufw allow 3002/tcp  # Backend (temporary)
ufw allow 9000/tcp  # Portainer
ufw enable

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install -y docker-compose-plugin

# Enable Docker on boot
systemctl enable docker
systemctl start docker

# Verify installation
docker --version
docker compose version
```

---

## 2. Docker & Portainer Configuration

### 2.1 Install Portainer

```bash
# Create Portainer volume
docker volume create portainer_data

# Run Portainer
docker run -d \
  -p 9000:9000 \
  -p 9443:9443 \
  --name=portainer \
  --restart=unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest

# Access Portainer at: https://your-server-ip:9443
# Create admin account on first visit
```

### 2.2 Project Structure

```bash
# Create project directory
mkdir -p /opt/nard-arena
cd /opt/nard-arena

# Clone repository (or setup via CI/CD later)
git clone https://github.com/your-username/nard-arena.git .
```

### 2.3 Docker Configuration Files

#### **Dockerfile - Backend**
Create `nard-backend/Dockerfile`:

```dockerfile
# Multi-stage build for smaller image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3002/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["npm", "run", "start:prod"]
```

#### **Dockerfile - Frontend**
Create `nard-frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:8083', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["npm", "start"]
```

#### **docker-compose.yml**
Create `docker-compose.yml` in root:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: nard-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-nard_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-nard_arena}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./nard-backend/prisma/backups:/backups
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-nard_user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nard-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: nard-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - nard-network

  # Backend API
  backend:
    build:
      context: ./nard-backend
      dockerfile: Dockerfile
    container_name: nard-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: postgresql://${POSTGRES_USER:-nard_user}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nard_arena}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      FRONTEND_URL: ${FRONTEND_URL:-https://nardarena.com}
    volumes:
      - ./nard-backend/logs:/app/logs
      - ./nard-backend/uploads:/app/uploads
    ports:
      - "3002:3002"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - nard-network

  # Frontend
  frontend:
    build:
      context: ./nard-frontend
      dockerfile: Dockerfile
    container_name: nard-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_SERVER_URL: ${BACKEND_URL:-https://api.nardarena.com}
      NEXT_PUBLIC_API_URL: ${BACKEND_URL:-https://api.nardarena.com}/api
    ports:
      - "8083:8083"
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8083"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - nard-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: nard-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 3s
      retries: 3
    networks:
      - nard-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  nard-network:
    driver: bridge
```

#### **.env.production**
Create `.env.production`:

```bash
# Database
POSTGRES_USER=nard_user
POSTGRES_PASSWORD=your_super_secure_password_here_change_this
POSTGRES_DB=nard_arena

# Redis
REDIS_PASSWORD=your_redis_password_here_change_this

# JWT Secrets (generate with: openssl rand -base64 64)
JWT_ACCESS_SECRET=your_jwt_access_secret_here_64_chars_minimum
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_64_chars_minimum

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# URLs
FRONTEND_URL=https://nardarena.com
BACKEND_URL=https://api.nardarena.com

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
```

#### **nginx.conf**
Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3002;
    }

    upstream frontend {
        server frontend:8083;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    # Main domain (Frontend)
    server {
        listen 80;
        server_name nardarena.com www.nardarena.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name nardarena.com www.nardarena.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security Headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Gzip Compression
        gzip on;
        gzip_vary on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # API subdomain (Backend)
    server {
        listen 80;
        server_name api.nardarena.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.nardarena.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        # Rate limiting for API
        location /api/auth/login {
            limit_req zone=login_limit burst=3 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # WebSocket support
            proxy_read_timeout 86400;
        }
    }
}
```

---

## 3. CI/CD Pipeline (GitHub Actions)

### 3.1 Setup GitHub Secrets

Go to: `Settings → Secrets and variables → Actions`

Add these secrets:
```
SERVER_IP          : your.hetzner.server.ip
SERVER_USER        : root
SSH_PRIVATE_KEY    : (your private SSH key)
DOCKER_USERNAME    : (optional - for Docker Hub)
DOCKER_PASSWORD    : (optional - for Docker Hub)
```

### 3.2 GitHub Actions Workflow

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  DOCKER_BUILDKIT: 1
  COMPOSE_DOCKER_CLI_BUILD: 1

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: |
            nard-backend/package-lock.json
            nard-frontend/package-lock.json

      - name: Install Backend Dependencies
        working-directory: ./nard-backend
        run: npm ci

      - name: Install Frontend Dependencies
        working-directory: ./nard-frontend
        run: npm ci

      - name: Lint Backend
        working-directory: ./nard-backend
        run: npm run lint

      - name: Lint Frontend
        working-directory: ./nard-frontend
        run: npm run lint

      - name: Run Backend Tests
        working-directory: ./nard-backend
        run: npm test || true

      - name: Build Backend
        working-directory: ./nard-backend
        run: npm run build

      - name: Build Frontend
        working-directory: ./nard-frontend
        run: npm run build

  deploy:
    name: Deploy to Hetzner
    needs: test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Add server to known hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.SERVER_IP }} >> ~/.ssh/known_hosts

      - name: Deploy to Server
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_IP }} << 'EOF'
            set -e
            
            echo "📦 Navigating to project directory..."
            cd /opt/nard-arena
            
            echo "🔄 Pulling latest code..."
            git pull origin main
            
            echo "📋 Loading environment variables..."
            export $(cat .env.production | xargs)
            
            echo "🛑 Stopping containers..."
            docker compose down
            
            echo "🏗️ Building new images..."
            docker compose build --no-cache
            
            echo "🔄 Running database migrations..."
            docker compose run --rm backend npx prisma migrate deploy
            
            echo "🚀 Starting containers..."
            docker compose up -d
            
            echo "🧹 Cleaning up old images..."
            docker system prune -af --filter "until=24h"
            
            echo "✅ Deployment complete!"
            
            echo "📊 Container status:"
            docker compose ps
          EOF

      - name: Health Check
        run: |
          sleep 30
          curl -f https://api.nardarena.com/api/health || exit 1
          echo "✅ Backend is healthy!"

      - name: Notify Success
        if: success()
        run: |
          echo "🎉 Deployment successful!"
          echo "🌐 Frontend: https://nardarena.com"
          echo "🔌 Backend: https://api.nardarena.com"

      - name: Notify Failure
        if: failure()
        run: |
          echo "❌ Deployment failed!"
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_IP }} 'docker compose logs --tail=100'
```

### 3.3 Auto Rollback on Failure

Create `.github/workflows/rollback.yml`:

```yaml
name: Rollback to Previous Version

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Git commit hash to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Rollback Deployment
        run: |
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_IP }} << EOF
            cd /opt/nard-arena
            git checkout ${{ github.event.inputs.version }}
            docker compose down
            docker compose build
            docker compose up -d
            echo "✅ Rolled back to ${{ github.event.inputs.version }}"
          EOF
```

---

## 4. Database & Backup Strategy

### 4.1 Automated Backups

Create `scripts/backup-database.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/opt/nard-arena/nard-backend/prisma/backups"
CONTAINER_NAME="nard-postgres"
DB_NAME="nard_arena"
DB_USER="nard_user"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Create backup
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
    
    # Delete backups older than retention days
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "🧹 Old backups cleaned up"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Upload to Hetzner Storage Box (optional)
# rclone copy $BACKUP_FILE hetzner-backup:nard-arena/
```

### 4.2 Setup Cron for Daily Backups

```bash
# Add to crontab
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * /opt/nard-arena/scripts/backup-database.sh >> /var/log/nard-backup.log 2>&1
```

### 4.3 Restore from Backup

Create `scripts/restore-database.sh`:

```bash
#!/bin/bash

BACKUP_FILE=$1
CONTAINER_NAME="nard-postgres"
DB_NAME="nard_arena"
DB_USER="nard_user"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore-database.sh <backup_file.sql.gz>"
    exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop backend to prevent data corruption
docker compose stop backend

# Restore database
gunzip -c $BACKUP_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully"
else
    echo "❌ Restore failed!"
    exit 1
fi

# Restart backend
docker compose start backend
```

---

## 5. Monitoring & Scaling

### 5.1 Basic Monitoring Setup

Install monitoring tools:

```bash
# Install Netdata (system monitoring)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Access at: http://your-server-ip:19999
```

### 5.2 Application Logging

Create `nard-backend/src/utils/logger.ts`:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
    }),
    // Combined logs
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
    }),
  ],
});

export default logger;
```

### 5.3 Health Check Endpoint

Already implemented in `nard-backend/src/app.module.ts`:

```typescript
// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

### 5.4 Scaling Strategy

**Vertical Scaling (Upgrade Server):**
```bash
# In Portainer or via Hetzner console
# Upgrade to: CPX41 (8 vCPU, 16GB RAM) - ~40€/month
# Or: CCX33 (8 dedicated vCPU, 32GB RAM) - ~73€/month
```

**Horizontal Scaling (Add Load Balancer):**

When you reach 2,000+ concurrent users:

```yaml
# Add to Hetzner Cloud Console:
1. Create another server (clone of current)
2. Setup Hetzner Load Balancer
3. Add both servers as targets
4. Configure health checks
5. Update DNS to point to Load Balancer IP

Cost: +5.39€/month for LB + server cost
```

---

## 6. Email Service Integration

### 6.1 Resend Setup

```bash
# 1. Sign up at https://resend.com
# 2. Get API key
# 3. Add to .env.production:
RESEND_API_KEY=re_your_api_key_here
```

### 6.2 Domain Configuration

Add these DNS records to your domain:

```
Type    Name                          Value
TXT     @                             v=spf1 include:_spf.resend.com ~all
TXT     resend._domainkey             (provided by Resend)
TXT     _dmarc                        v=DMARC1; p=none; rua=mailto:admin@nardarena.com
CNAME   mail.nardarena.com            resend.com
```

### 6.3 Email Service Implementation

Install dependencies:

```bash
cd nard-backend
npm install resend
```

Create `nard-backend/src/services/email.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

  async sendVerificationCode(email: string, code: string) {
    try {
      await this.resend.emails.send({
        from: 'Nard Arena <noreply@mail.nardarena.com>',
        to: email,
        subject: 'Email Verification Code',
        html: this.getVerificationTemplate(code),
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  private getVerificationTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Nard Arena</h1>
        </div>
        <div style="padding: 30px; background: #f5f5f5;">
          <h2>Verify Your Email</h2>
          <p>Your verification code is:</p>
          <div style="background: white; padding: 20px; font-size: 32px; font-weight: bold; text-align: center; border-radius: 8px; letter-spacing: 5px;">
            ${code}
          </div>
          <p style="margin-top: 20px; color: #666;">This code expires in 15 minutes.</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          © 2025 Nard Arena. All rights reserved.
          <br>
          <a href="https://nardarena.com" style="color: #667eea;">Visit Website</a>
        </div>
      </body>
      </html>
    `;
  }
}
```

---

## 7. Security Checklist

### 7.1 SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot certonly --standalone -d nardarena.com -d www.nardarena.com -d api.nardarena.com

# Certificates will be in: /etc/letsencrypt/live/nardarena.com/
# Copy to nginx/ssl/ directory

# Auto-renewal (certbot creates cron automatically)
certbot renew --dry-run
```

### 7.2 Security Hardening

```bash
# 1. Disable root login
echo "PermitRootLogin no" >> /etc/ssh/sshd_config
systemctl restart sshd

# 2. Setup fail2ban for brute force protection
cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /opt/nard-arena/nginx/logs/error.log
maxretry = 5
EOF

systemctl restart fail2ban

# 3. Enable automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 7.3 Environment Variables Security

```bash
# Restrict .env file permissions
chmod 600 /opt/nard-arena/.env.production

# Add to .gitignore
echo ".env.production" >> .gitignore
```

### 7.4 Rate Limiting (Already in nginx.conf)

- Login: 5 requests/minute
- API: 10 requests/second
- Prevents DDoS and brute force attacks

---

## 8. Deployment Commands

### 8.1 Initial Deployment

```bash
# On your local machine
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build Docker images
# 3. Deploy to Hetzner server
# 4. Run database migrations
# 5. Start containers
```

### 8.2 Manual Deployment (if needed)

```bash
# SSH into server
ssh root@your-server-ip

# Navigate to project
cd /opt/nard-arena

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# View logs
docker compose logs -f
```

### 8.3 Portainer Deployment

1. Go to https://your-server-ip:9443
2. Navigate to "Stacks"
3. Click "Add stack"
4. Name: "nard-arena"
5. Upload `docker-compose.yml`
6. Add environment variables from `.env.production`
7. Click "Deploy"

---

## 9. Monitoring Commands

```bash
# View all containers
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Check resource usage
docker stats

# View Nginx logs
tail -f /opt/nard-arena/nginx/logs/access.log
tail -f /opt/nard-arena/nginx/logs/error.log

# Database connection
docker exec -it nard-postgres psql -U nard_user -d nard_arena
```

---

## 10. Costs Summary

### Monthly Costs:

```
Hetzner Server (CPX31):        ~22 USD
Hetzner Backup:                 ~4 USD
Domain (.com):                  ~1 USD/month (12/year)
Resend Email (3K free):          0 USD
SSL Certificate:                 0 USD (Let's Encrypt)
-------------------------------------------
Total:                          ~27 USD/month

Optional (when scaling):
Hetzner Load Balancer:          ~6 USD
Additional Server:             ~22 USD
-------------------------------------------
With scaling:                  ~55 USD/month
```

---

## 11. Timeline

### Week 1: Setup Infrastructure
- [x] Order Hetzner server
- [x] Configure firewall and security
- [x] Install Docker & Portainer
- [x] Setup domain DNS

### Week 2: Dockerization
- [x] Create Dockerfiles
- [x] Setup docker-compose.yml
- [x] Test locally
- [x] Configure Nginx

### Week 3: CI/CD Pipeline
- [x] Setup GitHub Actions
- [x] Configure automated tests
- [x] Setup automated deployment
- [x] Test rollback procedure

### Week 4: Production Ready
- [x] SSL certificates
- [x] Email service integration
- [x] Monitoring setup
- [x] Backup automation
- [x] Security hardening

---

## 12. Useful Links

- Hetzner Cloud: https://console.hetzner.cloud
- Portainer: https://your-server-ip:9443
- Netdata Monitor: https://your-server-ip:19999
- Resend Dashboard: https://resend.com/dashboard
- GitHub Actions: https://github.com/your-repo/actions

---

## 13. Support & Troubleshooting

### Common Issues:

**Container won't start:**
```bash
docker compose logs container-name
docker compose restart container-name
```

**Database connection failed:**
```bash
docker exec -it nard-postgres pg_isready -U nard_user
```

**SSL certificate issues:**
```bash
certbot certificates
certbot renew --force-renewal
```

**Out of disk space:**
```bash
docker system prune -a
docker volume prune
```

---

## ✅ Checklist

Before going live:

- [ ] Server configured and secured
- [ ] Docker & Portainer installed
- [ ] All containers running
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] CI/CD pipeline tested
- [ ] Database backups automated
- [ ] Email service configured
- [ ] Monitoring enabled
- [ ] Security hardening complete
- [ ] Load testing performed
- [ ] Documentation updated

---

**🎉 با این نقشه راه، Nard Arena آماده production است!**

پس از راه‌اندازی، موفقیت‌ها رو جشن بگیر و شروع به scale کردن کن! 🚀
