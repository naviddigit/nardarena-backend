# 🧪 راهنمای تست Email Verification

## 📋 چک لیست قبل از تست

- [ ] Backend در حال اجرا است (`npm run start:dev`)
- [ ] Frontend در حال اجرا است (`npm start`)
- [ ] Database بالا است (PostgreSQL)
- [ ] Migration اجرا شده (`npx prisma migrate dev`)
- [ ] API Key از Resend گرفته شده

---

## 🔑 مرحله 1: دریافت API Key از Resend

### گام به گام:

1. **ثبت نام در Resend:**
   - برو به: https://resend.com
   - روی "Sign Up" کلیک کن
   - با Google یا GitHub وارد شو
   - رایگان است! 3,000 ایمیل در ماه

2. **دریافت API Key:**
   - بعد از ورود، برو به: https://resend.com/api-keys
   - روی "Create API Key" کلیک کن
   - اسم بده: `Nard Arena Development`
   - کپی کن (فقط یکبار نشون داده میشه!)

3. **اضافه کردن به `.env`:**
   - فایل باز کن: `nard-backend/.env`
   - پیدا کن: `RESEND_API_KEY=`
   - API Key رو بچسبون:
     ```env
     RESEND_API_KEY=re_abcdefgh1234567890
     ```
   - ذخیره کن!

4. **Restart کردن Backend:**
   ```bash
   cd nard-backend
   npm run start:dev
   ```
   
   باید ببینی:
   ```
   ✅ Email service initialized
   ```

---

## 🧪 مرحله 2: تست با Frontend (توصیه میشه!)

### روش 1: از صفحه Register

1. **برو به صفحه ثبت نام:**
   ```
   http://localhost:8083/auth/register
   ```

2. **فرم رو پر کن با ایمیل واقعی خودت:**
   - Email: `your-real-email@gmail.com` ⚠️ **حتما Gmail واقعی باشه!**
   - Username: `testuser123`
   - Password: `Test123456!`
   - Display Name: `Test User`

3. **روی "Sign Up" کلیک کن**
   - باید لاگین بشی و بری Dashboard

4. **چک کن emailVerified:**
   - برو به Prisma Studio: `npx prisma studio`
   - جدول `users` رو باز کن
   - پیدا کن کاربر جدید
   - ببین `emailVerified` برابر `false` است

### روش 2: از صفحه Verify Email مستقیم

1. **برو به صفحه تایید:**
   ```
   http://localhost:8083/auth/verify-email?email=your-email@gmail.com
   ```

2. **روی "Send Verification Code" کلیک کن**
   - باید ببینی: "Verification code sent to your email! ✅"
   - Countdown 60 ثانیه شروع میشه

3. **برو به ایمیل خودت:**
   - Inbox رو چک کن
   - **اگه نیست، Spam فولدر رو چک کن!** (اولین بار معمولا میره Spam)
   - باید ایمیلی با subject "Verify Your Email - Nard Arena" رسیده باشه

4. **ایمیل رو باز کن:**
   - باید یه ایمیل قشنگ با gradient بنفش ببینی 🎨
   - یه کد 6 رقمی توسط وسطش هست
   - مثلا: `1 2 3 4 5 6`

5. **کد رو کپی کن و بزار توی صفحه:**
   - کد رو بچسبون (فقط اعداد، بدون space)
   - روی "Verify Email" کلیک کن

6. **تایید موفق! 🎉**
   - باید ببینی: "Email verified successfully! 🎉"
   - بعد 2 ثانیه redirect میشی به Dashboard
   - یه ایمیل دیگه میاد با عنوان "Welcome to Nard Arena! 🎲"

### روش 3: از Profile/Settings

1. **لاگین کن با کاربری که emailVerified=false داره**

2. **برو به Settings/Profile** (اگه این صفحه داری)

3. **Email Verification Card رو ببین:**
   - باید یه Card زرد Warning ببینی
   - نوشته "Not Verified"
   - یه دکمه "Verify Email" داره

4. **روی "Verify Email" کلیک کن**
   - Dialog باز میشه
   - بقیه مراحل مثل روش 2

---

## 🧪 مرحله 3: تست با REST API (برای دولوپرها)

### با VSCode REST Client Extension:

1. **فایل باز کن:**
   ```
   nard-backend/test-email-verification.http
   ```

2. **قسمت اول رو اجرا کن (Register):**
   - روی "Send Request" بالای خط `POST {{baseUrl}}/auth/register` کلیک کن
   - Response 201 باید بیاد با token

3. **قسمت دوم رو اجرا کن (Send Code):**
   - روی "Send Request" بالای `POST {{baseUrl}}/auth/send-verification-code` کلیک کن
   - Response باید باشه: `{"message": "Verification code sent to your email"}`

4. **برو به ایمیلت و کد رو بردار**

5. **قسمت سوم رو اجرا کن (Verify):**
   - کد رو جای `"123456"` بزار
   - Send Request
   - Response: `{"message": "Email verified successfully"}`

### با cURL:

```bash
# 1. Register
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "username": "testuser",
    "password": "Test123456!",
    "displayName": "Test User"
  }'

# 2. Send verification code
curl -X POST http://localhost:3002/api/auth/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'

# 3. Check email, get code, then verify:
curl -X POST http://localhost:3002/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "code": "YOUR_CODE_HERE"
  }'
```

---

## 🔍 مرحله 4: چک کردن نتایج

### 1. در Database (Prisma Studio):

```bash
npx prisma studio
```

**جدول `users`:**
- پیدا کن user با email خودت
- چک کن: `emailVerified` باید `true` شده باشه
- `emailVerificationCode` باید `null` شده باشه
- `emailVerificationExpires` باید `null` شده باشه

**جدول `email_verification_logs`:**
- باید 1 یا چند record ببینی
- `success` برای آخرین یکی باید `true` باشه
- `verifiedAt` باید تاریخ/زمان داشته باشه

### 2. در Backend Logs:

باید این پیام‌ها رو ببینی:

```
✅ Email service initialized
📧 Sending verification code to your-email@gmail.com
✅ Verification email sent to your-email@gmail.com
✅ Email verified for user: your-email@gmail.com
```

### 3. در Resend Dashboard:

- برو به: https://resend.com/emails
- باید 2 ایمیل ببینی:
  1. "Verify Your Email - Nard Arena" (با کد)
  2. "Welcome to Nard Arena! 🎲" (بعد از تایید)
- Status: Delivered ✅

### 4. در ایمیل خودت:

- باید 2 ایمیل دریافت کرده باشی
- اگه Spam رفتن، Mark as "Not Spam" کن تا بعدی Inbox بیاد

---

## ❌ مشکلات رایج و راه حل

### 1. ❌ "Email service not configured"

**علت:** API Key نزاشتی یا اشتباه وارد کردی

**راه حل:**
```bash
# چک کن .env فایل:
cat nard-backend/.env | grep RESEND_API_KEY

# باید یه چیزی شبیه این ببینی:
# RESEND_API_KEY=re_abc123...

# اگه خالیه:
# 1. برو Resend.com
# 2. API Key بگیر
# 3. بزار تو .env
# 4. Backend رو restart کن
```

### 2. ❌ ایمیل نمیاد

**چک کن:**
- ✅ Spam folder رو چک کردی؟
- ✅ ایمیل واقعی نوشتی؟ (نه fake email)
- ✅ Backend logs رو دیدی؟ آیا "Email sent" نشون داد؟
- ✅ Resend dashboard رو چک کردی؟

**راه حل:**
```bash
# چک کن Backend logs:
npm run start:dev

# باید ببینی: ✅ Verification email sent to...
# اگه ارور داد، API Key رو دوباره چک کن
```

### 3. ❌ "Invalid verification code"

**علت:**
- کد اشتباه تایپ کردی
- کد expire شده (15 دقیقه گذشته)
- کد قدیمی رو داری میزنی

**راه حل:**
- دوباره "Resend Code" بزن
- کد جدید رو تایپ کن (فقط 6 رقم، بدون space)

### 4. ❌ "Wait X seconds before requesting new code"

**علت:** Rate limiting - باید 60 ثانیه صبر کنی

**راه حل:**
- صبر کن تا countdown تموم بشه
- یا از Prisma Studio `emailVerificationExpires` رو NULL کن

### 5. ❌ "Email already verified"

**علت:** قبلا verify کردی!

**راه حل:**
- لاگین کن، ایمیل verified است ✅
- یا user جدید بساز برای تست

---

## 🎯 چک لیست نهایی

تست موفق اگر:

- [x] ایمیل verification رسید (چک Inbox/Spam)
- [x] کد 6 رقمی واضح بود
- [x] ایمیل قشنگ بود (gradient بنفش)
- [x] کد کار کرد و verify شد
- [x] ایمیل Welcome هم رسید
- [x] در Database emailVerified شد true
- [x] Backend logs موفق بودند
- [x] Resend dashboard هر 2 ایمیل رو نشون داد

---

## 🚀 مرحله بعدی

بعد از تست موفق:

1. **Production Setup:**
   - Domain بگیر (مثلا nardarena.com)
   - DNS records رو set کن (SPF, DKIM, DMARC)
   - Email sender رو تغییر بده به: `noreply@nardarena.com`
   - راهنما: `docs/EMAIL_VERIFICATION.md` قسمت Production

2. **Add to Registration Flow:**
   - بعد از register موفق، نشون بده Email Verification Dialog
   - یا redirect کن به `/auth/verify-email?email=...`

3. **Require Verification:**
   - برای برداشت پول
   - برای تغییر تنظیمات حساس
   - برای بازی‌های با شرط بالا

---

## 📞 نیاز به کمک؟

- Backend logs رو چک کن: `npm run start:dev`
- Prisma Studio رو باز کن: `npx prisma studio`
- Resend dashboard رو ببین: https://resend.com/emails
- مستندات: `nard-backend/docs/EMAIL_VERIFICATION.md`

---

**موفق باشی! 🎉**
