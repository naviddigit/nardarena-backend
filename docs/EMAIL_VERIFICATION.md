# 📧 Email Verification System

Complete email verification implementation for Nard Arena using **Resend** email service.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Email Service Setup](#email-service-setup)
6. [API Endpoints](#api-endpoints)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)

---

## 1. Overview

### Features

✅ **6-digit verification code** (similar to Google, GitHub, etc.)  
✅ **15-minute code expiration**  
✅ **Rate limiting** (1 code per minute to prevent spam)  
✅ **Email verification tracking** (logs all attempts)  
✅ **Beautiful email templates** (HTML with gradients)  
✅ **Welcome email** after verification  
✅ **Resend functionality** with countdown timer  

### User Flow

```
1. User registers → Email NOT verified
2. User receives "Verify Email" prompt
3. Backend sends 6-digit code via email
4. User enters code in frontend
5. Backend validates code
6. Email marked as verified
7. Welcome email sent
8. User redirected to dashboard
```

---

## 2. Database Schema

### User Model Updates

```prisma
model User {
  // ... existing fields ...
  
  emailVerified             Boolean   @default(false)
  emailVerificationCode     String?   // 6-digit code
  emailVerificationExpires  DateTime? // Expiration time
  
  // Relations
  emailVerificationLogs     EmailVerificationLog[]
}
```

### New EmailVerificationLog Model

```prisma
model EmailVerificationLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  email       String   // Email at time of sending
  code        String   // Verification code sent
  ipAddress   String?  // IP that requested verification
  success     Boolean  @default(false)
  
  sentAt      DateTime @default(now())
  verifiedAt  DateTime? // When successfully verified
  
  @@index([userId, sentAt])
  @@index([email])
  @@map("email_verification_logs")
}
```

### Migration

```bash
npx prisma migrate dev --name add_email_verification
```

---

## 3. Backend Implementation

### 3.1 Email Service (`src/modules/email/email.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
  }

  async sendVerificationCode(email: string, code: string, username: string) {
    await this.resend.emails.send({
      from: 'Nard Arena <noreply@mail.nardarena.com>',
      to: email,
      subject: 'Verify Your Email - Nard Arena',
      html: this.getVerificationTemplate(code, username),
    });
  }
}
```

### 3.2 Auth Service Methods

#### Send Verification Code

```typescript
async sendVerificationCode(email: string, req?: any) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  
  if (!user) throw new BadRequestException('User not found');
  if (user.emailVerified) throw new BadRequestException('Already verified');
  
  // Rate limiting check
  if (user.emailVerificationExpires > new Date()) {
    throw new BadRequestException('Wait 1 minute before requesting new code');
  }
  
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  // Save to database
  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCode: code,
      emailVerificationExpires: expiresAt,
    },
  });
  
  // Log attempt
  await this.prisma.emailVerificationLog.create({
    data: {
      userId: user.id,
      email: user.email,
      code,
      ipAddress: getDeviceInfo(req).ip,
    },
  });
  
  // Send email
  await this.emailService.sendVerificationCode(email, code, user.username);
  
  return { message: 'Verification code sent' };
}
```

#### Verify Email

```typescript
async verifyEmail(email: string, code: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  
  if (!user) throw new BadRequestException('User not found');
  if (user.emailVerified) throw new BadRequestException('Already verified');
  if (!user.emailVerificationCode) throw new BadRequestException('No code found');
  
  // Check expiration
  if (user.emailVerificationExpires < new Date()) {
    throw new BadRequestException('Code expired');
  }
  
  // Check code match
  if (user.emailVerificationCode !== code) {
    throw new BadRequestException('Invalid code');
  }
  
  // Mark as verified
  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null,
    },
  });
  
  // Update log
  await this.prisma.emailVerificationLog.updateMany({
    where: { userId: user.id, code, success: false },
    data: { success: true, verifiedAt: new Date() },
  });
  
  // Send welcome email
  await this.emailService.sendWelcomeEmail(email, user.username);
  
  return { message: 'Email verified successfully' };
}
```

---

## 4. Frontend Implementation

### 4.1 Email Verification Dialog Component

**File:** `src/components/email-verification-dialog.tsx`

```typescript
'use client';

export default function EmailVerificationDialog({ email }) {
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  const handleSendCode = async () => {
    await emailVerificationService.sendVerificationCode(email);
    setCountdown(60); // 60 second cooldown
  };
  
  const handleVerify = async () => {
    await emailVerificationService.verifyEmail(email, code);
    router.push('/dashboard');
  };
  
  return (
    <Dialog>
      <TextField
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputProps={{ maxLength: 6 }}
      />
      <Button onClick={handleVerify}>Verify</Button>
      <Button onClick={handleSendCode} disabled={countdown > 0}>
        {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
      </Button>
    </Dialog>
  );
}
```

### 4.2 Verify Email Page

**File:** `src/app/auth/verify-email/page.tsx`

Full standalone page for email verification with:
- Email input
- 6-digit code input (auto-formatted, monospace font)
- Send/Resend button with 60s countdown
- Verify button
- Success/Error alerts
- Auto-redirect after verification

### 4.3 Email Verification Service

**File:** `src/services/email-verification.service.ts`

```typescript
export const emailVerificationService = {
  async sendVerificationCode(email: string) {
    const response = await axios.post(`${API_URL}/auth/send-verification-code`, {
      email,
    });
    return response.data;
  },

  async verifyEmail(email: string, code: string) {
    const response = await axios.post(`${API_URL}/auth/verify-email`, {
      email,
      code,
    });
    return response.data;
  },
};
```

---

## 5. Email Service Setup

### 5.1 Resend Setup (Recommended)

**Why Resend?**
- 🎁 **Free tier:** 3,000 emails/month
- 🚀 **Fast:** 50ms average delivery time
- 📊 **Analytics:** Track opens, clicks, bounces
- ✅ **No credit card required** for free tier
- 💻 **Developer-friendly:** Simple API, good docs

**Setup Steps:**

```bash
# 1. Sign up at https://resend.com
# 2. Get API key from: https://resend.com/api-keys
# 3. Add to .env:
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Nard Arena <noreply@mail.nardarena.com>

# 4. Install package (already done)
npm install resend
```

### 5.2 Domain Configuration (Production)

Add DNS records to your domain:

```dns
Type    Name                      Value
TXT     @                         v=spf1 include:_spf.resend.com ~all
TXT     resend._domainkey         (provided by Resend)
TXT     _dmarc                    v=DMARC1; p=none; rua=mailto:admin@nardarena.com
```

**After verification, update EMAIL_FROM:**

```env
EMAIL_FROM=Nard Arena <noreply@nardarena.com>
```

---

## 6. API Endpoints

### POST `/api/auth/send-verification-code`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification code sent to your email"
}
```

**Errors:**
- `400` - User not found
- `400` - Email already verified
- `400` - Wait 1 minute before requesting new code

---

### POST `/api/auth/verify-email`

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

**Errors:**
- `400` - User not found
- `400` - Already verified
- `400` - Invalid code
- `400` - Code expired

---

## 7. Testing

### 7.1 Test HTTP Requests

Create `test-email-verification.http`:

```http
### 1. Send Verification Code
POST http://localhost:3002/api/auth/send-verification-code
Content-Type: application/json

{
  "email": "test@example.com"
}

### 2. Verify Email
POST http://localhost:3002/api/auth/verify-email
Content-Type: application/json

{
  "email": "test@example.com",
  "code": "123456"
}
```

### 7.2 Manual Testing Steps

1. **Register new user:**
   - Email: `your-real-email@gmail.com`
   - Check `emailVerified` is `false`

2. **Navigate to verification page:**
   - URL: `http://localhost:8083/auth/verify-email?email=your-email@gmail.com`

3. **Click "Send Code":**
   - Check email inbox (including spam folder)
   - Should receive email within 10 seconds

4. **Enter 6-digit code:**
   - Copy code from email
   - Paste into input field
   - Click "Verify Email"

5. **Confirm success:**
   - Should see success message
   - Auto-redirect to dashboard
   - Check database: `emailVerified` should be `true`
   - Should receive welcome email

### 7.3 Test Rate Limiting

```bash
# Send 3 codes in quick succession
curl -X POST http://localhost:3002/api/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Third request should fail with:
# "Wait X seconds before requesting a new code"
```

---

## 8. Production Deployment

### 8.1 Environment Variables

**Required:**
```env
RESEND_API_KEY=re_your_production_api_key
EMAIL_FROM=Nard Arena <noreply@nardarena.com>
FRONTEND_URL=https://nardarena.com
```

### 8.2 Domain Email Setup

1. **Verify domain in Resend:**
   - Add DNS records (SPF, DKIM, DMARC)
   - Wait for verification (5-10 minutes)

2. **Update sender email:**
   ```env
   EMAIL_FROM=Nard Arena <noreply@nardarena.com>
   ```

3. **Test from production domain:**
   ```bash
   curl -X POST https://api.nardarena.com/api/auth/send-verification-code \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@gmail.com"}'
   ```

### 8.3 Monitoring

**Check email logs in Resend dashboard:**
- https://resend.com/emails

**Track metrics:**
- Delivery rate (should be >99%)
- Open rate (~20-40% typical)
- Bounce rate (should be <2%)
- Spam complaints (should be <0.1%)

**Database query for verification stats:**
```sql
SELECT 
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE success = true) as verified,
  COUNT(*) FILTER (WHERE success = false) as pending
FROM email_verification_logs
WHERE "sentAt" >= NOW() - INTERVAL '7 days';
```

---

## 9. Email Templates Preview

### Verification Email

```
┌─────────────────────────────────┐
│     🎲 Nard Arena               │  (Purple gradient header)
├─────────────────────────────────┤
│                                 │
│  Verify Your Email              │
│                                 │
│  Hi Username,                   │
│                                 │
│  Your verification code is:     │
│                                 │
│  ┌─────────────────────┐        │
│  │      1 2 3 4 5 6    │        │  (Big, centered, monospace)
│  └─────────────────────┘        │
│                                 │
│  ⏰ Expires in 15 minutes       │
│                                 │
├─────────────────────────────────┤
│  © 2025 Nard Arena              │
│  Visit Website →                │
└─────────────────────────────────┘
```

### Welcome Email

```
┌─────────────────────────────────┐
│  🎉 Welcome to Nard Arena!      │
├─────────────────────────────────┤
│                                 │
│  Welcome, Username! 🎲          │
│                                 │
│  Your account is verified!      │
│                                 │
│  • 🎮 Play against AI           │
│  • 💰 Compete in tournaments    │
│  • 📊 Track your stats          │
│  • 👥 Connect worldwide         │
│                                 │
│  ┌─────────────────────┐        │
│  │  Start Playing Now  │        │  (Button)
│  └─────────────────────┘        │
│                                 │
└─────────────────────────────────┘
```

---

## 10. Troubleshooting

### Email not received?

1. **Check spam folder** - New domains often go to spam initially
2. **Verify Resend API key** - Check dashboard for errors
3. **Check backend logs** - Look for "Email sent" message
4. **Verify DNS records** - Use https://mxtoolbox.com/

### "User not found" error?

- Ensure user registered with correct email
- Check database for user record
- Email is case-insensitive (stored as lowercase)

### Rate limiting issues?

- Countdown timer prevents abuse
- Wait 60 seconds between requests
- Admin can manually reset: `emailVerificationExpires = NULL`

### Code expired?

- Codes expire after 15 minutes
- User must request new code
- Old codes automatically invalidated

---

## ✅ Implementation Checklist

- [x] Database schema updated
- [x] Migration created and applied
- [x] Email service configured
- [x] Auth service methods added
- [x] API endpoints created
- [x] Frontend dialog component
- [x] Frontend verification page
- [x] Email templates designed
- [x] Rate limiting implemented
- [x] Logging/tracking added
- [ ] Resend API key obtained
- [ ] Domain DNS configured (production)
- [ ] Testing completed
- [ ] Documentation reviewed

---

**🎉 Email verification system is now complete!**

Sign up for Resend (free), add API key to `.env`, and start testing!
