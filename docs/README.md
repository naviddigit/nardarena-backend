# 📚 Nard Arena Documentation

Complete documentation for backend development, features, and deployment.

---

## 📋 Available Documents

### 1. [PROJECT_SUMMARY_FOR_AI.md](./PROJECT_SUMMARY_FOR_AI.md)
**Complete project overview for AI assistants**
- Project structure
- Tech stack
- All features and modules
- Database schema
- API endpoints reference

### 2. [EMAIL_VERIFICATION.md](./EMAIL_VERIFICATION.md)
**Email verification system implementation**
- 6-digit code verification
- Resend email service setup
- Frontend components
- Testing guide
- Email templates

### 3. [DEVICE_LOCATION_TRACKING.md](./DEVICE_LOCATION_TRACKING.md)
**User device and location tracking**
- Registration metadata capture
- Login history tracking
- Admin panel user reports
- IP geolocation
- Browser/device detection

### 4. [GAME_LOGIC_COMPLETE.md](./GAME_LOGIC_COMPLETE.md)
**Complete backgammon game logic**
- Game rules implementation
- Move validation
- Bear-off logic
- AI opponent system
- WebSocket real-time gameplay

### 5. [DEPLOYMENT_ROADMAP.md](./DEPLOYMENT_ROADMAP.md)
**Production deployment strategy**
- Docker & Portainer setup
- Hetzner server configuration
- CI/CD with GitHub Actions
- Database backups
- SSL certificates
- Monitoring & scaling

---

## 🚀 Quick Start Links

### Development
```bash
# Start backend
npm run start:dev

# Run migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio
```

### Testing
- API Tests: See `test-*.http` files in root
- Email Verification: [Testing Guide](./EMAIL_VERIFICATION.md#7-testing)
- Device Tracking: [Testing Guide](./DEVICE_LOCATION_TRACKING.md#testing)

### Production
- Deployment: [Deployment Roadmap](./DEPLOYMENT_ROADMAP.md)
- Docker: See `docker-compose.yml` examples
- CI/CD: See `.github/workflows/` examples

---

## 📧 Email Verification Quick Test

### Step 1: Get Resend API Key
1. Sign up at https://resend.com (FREE - 3K emails/month)
2. Get API key from https://resend.com/api-keys
3. Add to `.env`:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   ```

### Step 2: Restart Backend
```bash
npm run start:dev
```

### Step 3: Test in Frontend
1. Go to: http://localhost:8083/auth/register
2. Register with your **real email** (Gmail works best)
3. Check your email inbox (or spam)
4. You'll receive verification code
5. Enter code in verification page
6. ✅ Email verified!

### Alternative: Test via API
```bash
# 1. Register user
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "username": "testuser",
    "password": "Test123456!"
  }'

# 2. Send verification code
curl -X POST http://localhost:3002/api/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'

# 3. Check your email, get the code, then verify:
curl -X POST http://localhost:3002/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "code": "123456"
  }'
```

See [test-email-verification.http](../test-email-verification.http) for more examples.

---

## 🎯 Frontend Testing Locations

### Email Verification
- **Page:** `/auth/verify-email?email=your@email.com`
- **Dialog:** Shows after registration (if not verified)
- **Check Status:** Profile settings → Account section

### User Profile (Check Verification Status)
1. Login to dashboard
2. Go to Settings/Profile
3. See email verification badge:
   - ✅ **Verified** (green badge)
   - ⚠️ **Not Verified** (yellow badge with "Verify" button)

### Admin Panel (Check User Details)
1. Login as admin
2. Go to Admin → Users
3. Click on any user row → "User Report"
4. See registration info, login history, verification status

---

## 🔧 Development Tips

### Database Inspection
```bash
# Open Prisma Studio
npx prisma studio

# Check tables:
# - users (emailVerified field)
# - email_verification_logs (all verification attempts)
```

### Backend Logs
Watch for these messages:
```
✅ Email service initialized
📧 Sending verification code to user@example.com
✅ Verification email sent to user@example.com
✅ Email verified for user: user@example.com
```

### Common Issues
- **Email not received?** → Check spam folder (first emails often go there)
- **"No API key" error?** → Add RESEND_API_KEY to .env and restart
- **Code expired?** → Codes expire in 15 minutes, request new one
- **Rate limited?** → Wait 60 seconds between code requests

---

## 📞 Support

- **Backend Issues:** Check backend logs (`npm run start:dev`)
- **Email Issues:** Check Resend dashboard (https://resend.com/emails)
- **Database Issues:** Use Prisma Studio (`npx prisma studio`)
- **API Issues:** Use test-*.http files with REST Client extension

---

**Last Updated:** December 2025
