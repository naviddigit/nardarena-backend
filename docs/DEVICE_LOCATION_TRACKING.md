# 🌍 Device & Location Tracking Implementation

## ✅ Completed Features

### 1. Database Schema (Prisma)

#### User Model Updates:
```prisma
model User {
  // ... existing fields ...
  
  // Registration metadata (captured at signup)
  registrationIp        String?   // IP address used during registration
  registrationCountry   String?   // Country code detected at registration
  registrationDevice    String?   // Device type (e.g., 'iPhone 14')
  registrationOs        String?   // Operating system (e.g., 'iOS 16')
  registrationBrowser   String?   // Browser info (e.g., 'Chrome 120')
  
  // Relations
  loginHistory          LoginHistory[]
}
```

#### New LoginHistory Model:
```prisma
model LoginHistory {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(...)
  
  ipAddress       String
  country         String?
  city            String?
  device          String?
  os              String?
  browser         String?
  
  success         Boolean  @default(true)
  failReason      String?
  
  createdAt       DateTime @default(now())
}
```

**Migration:** `20251210211821_add_device_location_tracking`

---

### 2. Backend Services

#### Device Detection Utility (`device-detector.util.ts`)
- ✅ Extract IP address (handles proxies: x-forwarded-for, x-real-ip)
- ✅ Parse User-Agent (using `ua-parser-js` library)
- ✅ Detect device type (iPhone, Samsung, Desktop, etc.)
- ✅ Detect OS (iOS 16, Android 13, Windows 11, etc.)
- ✅ Detect browser (Chrome 120, Safari 17, etc.)
- ✅ Get country from IP (using ipapi.co free API)
- ✅ Get detailed location (country, city, timezone)

**Dependencies:** `ua-parser-js` (installed ✅)

#### LoginHistory Service (`login-history.service.ts`)
- ✅ `logSuccessfulLogin()` - Log successful login with device info
- ✅ `logFailedLogin()` - Log failed login attempts
- ✅ `getUserLoginHistory()` - Get user's login history
- ✅ `getLoginsByIp()` - Get logins from specific IP
- ✅ `getSuspiciousActivity()` - Detect suspicious login patterns

**Features:**
- Track multiple failed attempts
- Detect logins from new countries
- Count unique IPs used
- Return recent 5 failed logins

---

### 3. Authentication Updates

#### AuthService Updates:
1. **register()** - Now captures:
   - IP address
   - Country (user-selected OR auto-detected)
   - Device, OS, Browser
   - Logs first login

2. **login()** - Now captures:
   - Every login is logged with device/location
   - Failed logins are tracked
   - Logs include failure reason

#### AuthController Updates:
1. **POST /auth/register** - Passes `req` to service
2. **POST /auth/login** - Passes `req` to service
3. **GET /auth/detect-location** - NEW endpoint
   - Returns: IP, country, city, device, OS, browser
   - Used by registration form to auto-detect country

---

### 4. API Endpoints

#### New Endpoints:
```http
# Detect user's location (for registration form)
GET /auth/detect-location
Response: {
  ip: "5.100.123.45",
  country: "IR",
  countryName: "Iran",
  city: "Tehran",
  device: "iPhone 14",
  os: "iOS 16.5",
  browser: "Safari 17.1"
}

# Get login history
GET /users/login-history?limit=50
Authorization: Bearer {token}
Response: [
  {
    id: "uuid",
    ipAddress: "5.100.123.45",
    country: "IR",
    city: "Tehran",
    device: "iPhone 14",
    os: "iOS 16.5",
    browser: "Safari 17.1",
    success: true,
    createdAt: "2024-12-10T21:00:00Z"
  }
]

# Check suspicious activity
GET /users/suspicious-activity?hours=24
Authorization: Bearer {token}
Response: {
  totalLogins: 15,
  failedLogins: 2,
  uniqueCountries: 3,
  uniqueIps: 5,
  countries: ["IR", "US", "DE"],
  ips: ["5.100.123.45", "8.8.8.8"],
  recentFailed: [...]
}
```

---

### 5. Frontend Utilities

#### Countries List (`utils/countries.ts`)
- ✅ List of 80+ countries with ISO codes
- ✅ Flag emojis for each country
- ✅ Helper functions:
  - `findCountryByCode(code)` - Find country by ISO code
  - `getCountryName(code)` - Get country name
  - `getCountryFlag(code)` - Get flag emoji
  - `detectBrowserCountry()` - Detect from browser locale

**Usage Example:**
```typescript
import { COUNTRIES, findCountryByCode } from '@/utils/countries';

// Display country selector
<select>
  {COUNTRIES.map(c => (
    <option key={c.code} value={c.code}>
      {c.flag} {c.name}
    </option>
  ))}
</select>

// Get country name
const countryName = getCountryName('IR'); // "Iran"
```

---

## 🔧 How It Works

### Registration Flow:
1. User opens registration page
2. Frontend calls `GET /auth/detect-location`
3. Backend detects IP → country → device
4. Frontend pre-selects country in dropdown
5. User can change country if wrong
6. On submit, backend saves:
   - `registrationIp`, `registrationCountry`
   - `registrationDevice`, `registrationOs`, `registrationBrowser`
7. First login is logged in `login_history` table

### Login Flow:
1. User submits login form
2. Backend validates credentials
3. On success:
   - Updates `lastLoginAt` in users table
   - Logs entry in `login_history` with device/location
4. On failure:
   - Logs failed attempt with reason
   - Increments `failedLoginAttempts`
   - Locks account after 5 failed attempts

### Suspicious Activity Detection:
- Multiple failed logins in short time
- Logins from new countries
- Multiple IPs in same session
- Can trigger 2FA requirement or email alerts

---

## 📊 Admin Features (Future)

With this data, admins can:
- See all login attempts for any user
- Detect account takeover attempts
- Ban IPs or countries
- Require 2FA for high-risk logins
- Generate reports (logins by country, device types, etc.)

Example admin queries:
```typescript
// All logins from Iran today
const iranLogins = await prisma.loginHistory.findMany({
  where: {
    country: 'IR',
    createdAt: { gte: startOfToday() }
  }
});

// Users with failed login attempts
const suspiciousUsers = await prisma.user.findMany({
  where: { failedLoginAttempts: { gte: 3 } }
});

// Most active countries
const stats = await prisma.loginHistory.groupBy({
  by: ['country'],
  _count: true,
  orderBy: { _count: { country: 'desc' } }
});
```

---

## 🔐 Security Considerations

1. **IP Detection:**
   - Handles proxy headers (x-forwarded-for)
   - Supports CDN/load balancer setups
   - Skips localhost IPs (127.0.0.1, ::1)

2. **Data Privacy:**
   - IP addresses stored (required for security)
   - Location detection uses free API (ipapi.co)
   - No personal data leaked to third parties

3. **Rate Limiting (TODO):**
   - Add rate limiting to `/auth/detect-location`
   - Prevent abuse of geolocation API

4. **GDPR Compliance (TODO):**
   - Allow users to view their login history
   - Allow users to request data deletion
   - Add consent checkbox for data collection

---

## 📝 TODO: Remaining Tasks

Based on user request, still need:

### 1. Email Verification System
- [ ] Send verification code on registration
- [ ] Email service provider selection (SendGrid, AWS SES, Mailgun?)
- [ ] Verify email endpoint
- [ ] Resend code endpoint

### 2. Google Login (OAuth)
- [ ] Google OAuth integration (already scaffolded)
- [ ] Handle Google profile → user creation
- [ ] Merge accounts if email exists

### 3. Google Authenticator (2FA)
- [ ] Install `speakeasy` for TOTP generation
- [ ] QR code generation for setup
- [ ] Verify 2FA code on login
- [ ] Require 2FA for withdrawals

### 4. Country Auto-Detection in Registration Form
- [ ] Call `/auth/detect-location` on page load
- [ ] Pre-select country dropdown
- [ ] Allow user to change if wrong
- [ ] Show detected location info (optional)

---

## 🧪 Testing

### Manual Test:
1. Start backend: `cd nard-backend && npm run start:dev`
2. Test location detection:
   ```bash
   curl http://localhost:3001/api/auth/detect-location
   ```
3. Register new user with country
4. Login and check `login_history` table:
   ```sql
   SELECT * FROM login_history ORDER BY created_at DESC LIMIT 10;
   ```
5. Test login history endpoint:
   ```bash
   curl -H "Authorization: Bearer {token}" \
     http://localhost:3001/api/users/login-history
   ```

### Database Check:
```sql
-- View user registration metadata
SELECT 
  username, 
  registration_country, 
  registration_device, 
  registration_ip,
  created_at
FROM users
ORDER BY created_at DESC;

-- View login history
SELECT 
  u.username,
  lh.ip_address,
  lh.country,
  lh.device,
  lh.success,
  lh.created_at
FROM login_history lh
JOIN users u ON lh.user_id = u.id
ORDER BY lh.created_at DESC;
```

---

## 🎯 Next Steps

1. **Test the implementation:**
   - Register new user
   - Check if country/device saved
   - Login multiple times
   - Check login history

2. **Update frontend registration form:**
   - Add country dropdown
   - Call detect-location API
   - Auto-select detected country

3. **Implement email verification:**
   - Choose email provider
   - Add verification flow

4. **Add Google OAuth:**
   - Complete Google Strategy
   - Add login button

5. **Add 2FA for withdrawals:**
   - Install speakeasy
   - Generate QR codes
   - Require on sensitive actions

---

## 📚 Files Modified/Created

### Backend:
- ✅ `prisma/schema.prisma` - Added fields + LoginHistory model
- ✅ `src/utils/device-detector.util.ts` - Device/location detection
- ✅ `src/modules/auth/login-history.service.ts` - Login tracking service
- ✅ `src/modules/auth/auth.module.ts` - Export LoginHistoryService
- ✅ `src/modules/auth/auth.service.ts` - Capture device info on register/login
- ✅ `src/modules/auth/auth.controller.ts` - Add detect-location endpoint
- ✅ `src/modules/users/users.controller.ts` - Add login history endpoints

### Frontend:
- ✅ `src/utils/countries.ts` - Country list with flags

### Migration:
- ✅ `prisma/migrations/20251210211821_add_device_location_tracking/migration.sql`
