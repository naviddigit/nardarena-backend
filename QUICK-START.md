# 🚀 Backend Quick Reference

## شروع سریع

```powershell
# 1. Build
npm run build

# 2. Start با PM2
pm2 start ecosystem.config.js

# 3. چک وضعیت
pm2 list
```

## دستورات روزمره

```powershell
pm2 list                    # وضعیت
pm2 logs nard-backend      # لاگ‌ها
pm2 restart nard-backend   # ریستارت (بعد از build)
pm2 monit                  # مانیتورینگ
```

## تست سریع

```powershell
# Health check
Invoke-RestMethod http://localhost:3002/api/health/status

# Login
$body = @{ email = "admin@nardarena.com"; password = "Admin123!" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3002/api/auth/login" -Method Post -Body $body -ContentType "application/json"
```

## مشکل دارید؟

```powershell
# مشاهده error ها
pm2 logs nard-backend --err --lines 50

# ریستارت کامل
pm2 restart nard-backend

# اگر باز هم مشکل دارید
pm2 delete nard-backend
npm run build
pm2 start ecosystem.config.js
```

## Database

```powershell
npm run prisma:studio      # مدیریت دیتابیس
npm run prisma:migrate     # migration
npm run prisma:seed        # seed
```

---

📖 **مستندات کامل:** `../DEV-OPERATIONS.md`

🌐 **Swagger API:** http://localhost:3002/api/docs

🔍 **Prisma Studio:** http://localhost:5555 (با `npm run prisma:studio`)
