# PM2 Cheat Sheet - راهنمای کامل

## 🎯 دستورات اصلی

### مدیریت پروسه

```powershell
pm2 start ecosystem.config.js       # شروع از روی فایل config
pm2 start app.js --name "myapp"     # شروع با نام دلخواه
pm2 restart app_name                # ریستارت
pm2 stop app_name                   # متوقف کردن
pm2 delete app_name                 # حذف از PM2
pm2 reload app_name                 # reload (zero-downtime)
```

### مشاهده وضعیت

```powershell
pm2 list                            # لیست تمام پروسه‌ها
pm2 show app_name                   # اطلاعات دقیق یک پروسه
pm2 monit                           # dashboard real-time
pm2 status                          # وضعیت کلی
```

### لاگ‌ها

```powershell
pm2 logs                            # تمام لاگ‌ها
pm2 logs app_name                   # لاگ یک پروسه خاص
pm2 logs app_name --lines 100       # 100 خط آخر
pm2 logs app_name --err             # فقط error ها
pm2 logs app_name --raw             # بدون رنگ و format
pm2 flush                           # پاک کردن تمام لاگ‌ها
```

### مدیریت دسته‌جمعی

```powershell
pm2 restart all                     # ریستارت همه
pm2 stop all                        # متوقف کردن همه
pm2 delete all                      # حذف همه
```

## 🔧 دستورات پیشرفته

### Scale & Cluster

```powershell
pm2 scale app_name 4                # اجرای 4 instance
pm2 start app.js -i max             # تعداد CPU ها
pm2 start app.js -i 2               # 2 instance
```

### Environment Variables

```powershell
pm2 start app.js --env production   # با env خاص
pm2 restart app_name --update-env   # آپدیت env variables
```

### Auto Startup

```powershell
pm2 startup                         # راهنمای setup startup
pm2 save                            # ذخیره لیست فعلی
pm2 resurrect                       # بازگردانی لیست ذخیره شده
pm2 unstartup                       # غیرفعال کردن startup
```

## 📊 Monitoring

```powershell
pm2 monit                           # dashboard interactive
pm2 plus                            # cloud monitoring (نیاز به ثبت‌نام)
pm2 web                             # web interface
```

## 🐛 Debugging

```powershell
pm2 logs app_name --lines 200       # 200 خط آخر لاگ
pm2 logs app_name --err --lines 50  # 50 خط آخر error
pm2 show app_name                   # اطلاعات کامل
pm2 describe app_name               # جزئیات پروسه
pm2 prettylist                      # لیست JSON زیبا
```

## 🔄 Update & Maintenance

```powershell
pm2 update                          # آپدیت PM2
pm2 reset app_name                  # ریست restart counter
pm2 flush                           # پاک کردن لاگ‌ها
pm2 reloadLogs                      # reload log files
```

## 📁 فایل Config (ecosystem.config.js)

```javascript
module.exports = {
  apps: [
    {
      name: 'app-name',              // نام پروسه
      script: 'dist/main.js',        // فایل اصلی
      cwd: './path',                 // مسیر کار
      instances: 1,                  // تعداد instance
      exec_mode: 'cluster',          // یا 'fork'
      watch: false,                  // watch کردن فایل‌ها
      max_memory_restart: '500M',    // restart در صورت overflow
      
      // Environment Variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 80
      },
      
      // Logs
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,                    # timestamp در لاگ‌ها
      
      // Restart Strategies
      autorestart: true,             # auto-restart
      max_restarts: 10,              # حداکثر restart در ...
      min_uptime: '10s',             # حداقل زمان up بودن
      restart_delay: 4000,           # تاخیر بین restart (ms)
      
      // Advanced
      listen_timeout: 3000,          # timeout برای listen
      kill_timeout: 5000,            # timeout برای kill
      wait_ready: true,              # منتظر signal آماده بودن
      instance_var: 'INSTANCE_ID',  # متغیر ID instance
    }
  ]
};
```

## 🎛️ Process Signals

```powershell
pm2 sendSignal SIGUSR2 app_name     # ارسال signal دلخواه
```

**Signals رایج:**
- `SIGINT` - graceful shutdown
- `SIGTERM` - terminate
- `SIGUSR1` - reload configs
- `SIGUSR2` - custom logic

## 🔐 Module System

```powershell
pm2 install pm2-logrotate           # نصب module
pm2 uninstall pm2-logrotate         # حذف module
pm2 module:list                     # لیست module ها
```

## 💡 Tips & Tricks

### 1. فیلتر کردن لاگ‌ها

```powershell
pm2 logs | Select-String "ERROR"           # فقط ERROR ها
pm2 logs | Select-String -Pattern "login"  # فقط کلمه login
```

### 2. JSON Output

```powershell
pm2 jlist                           # JSON format
pm2 prettylist                      # Pretty JSON
```

### 3. Watch Mode (Development)

```javascript
// در ecosystem.config.js
watch: true,
ignore_watch: ['node_modules', 'logs'],
watch_options: {
  followSymlinks: false
}
```

### 4. Graceful Reload

```powershell
pm2 reload app_name                 # zero-downtime restart
```

## 🚨 مشکلات رایج

### پروسه restart نمی‌شود

```powershell
pm2 delete app_name
pm2 start ecosystem.config.js
```

### لاگ‌ها زیاد شده‌اند

```powershell
pm2 flush                           # پاک کردن همه لاگ‌ها
pm2 install pm2-logrotate          # نصب logrotate
```

### Memory leak

```javascript
// در config
max_memory_restart: '300M'
```

### پروسه crash می‌کند

```powershell
pm2 logs app_name --err --lines 100
pm2 show app_name
```

## 📖 منابع

- **مستندات رسمی:** https://pm2.keymetrics.io/docs/
- **GitHub:** https://github.com/Unitech/pm2
- **Community:** https://discord.gg/pm2

---

**نکته:** این فایل را در `nard-backend/` نگه دارید و به‌روز کنید.
