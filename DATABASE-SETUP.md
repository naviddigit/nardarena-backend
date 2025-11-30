# 🗄️ Database Setup Options

## Problem: Docker not installed

Since Docker is not available, we have 3 options for PostgreSQL:

---

## ✅ **Option 1: Neon.tech (Recommended - FREE)**

**مزایا:**
- ✅ کاملاً رایگان (3 GB storage)
- ✅ PostgreSQL 16
- ✅ نیازی به نصب ندارد
- ✅ Cloud-based
- ✅ Auto-backup
- ✅ SSL connection

### Steps:

1. **ثبت‌نام:**
   ```
   https://neon.tech
   ```

2. **Create Project:**
   - Project name: `nard-arena`
   - Region: Choose closest to you

3. **Copy Connection String:**
   ```
   نمونه:
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/nard_arena
   ```

4. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://YOUR_CONNECTION_STRING_HERE"
   ```

5. **Test Connection:**
   ```powershell
   cd nard-backend
   npm run prisma:generate
   npm run prisma:migrate
   ```

---

## ✅ **Option 2: Supabase (FREE Alternative)**

**مزایا:**
- ✅ کاملاً رایگان (500 MB database)
- ✅ PostgreSQL 15
- ✅ Built-in Auth (optional)
- ✅ Cloud-based

### Steps:

1. **ثبت‌نام:**
   ```
   https://supabase.com
   ```

2. **Create Project:**
   - Project name: `nard-arena`
   - Database password: (choose strong password)
   - Region: Choose closest

3. **Get Connection String:**
   - Go to Settings → Database
   - Copy "Connection string" (URI)

4. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres"
   ```

5. **Test:**
   ```powershell
   cd nard-backend
   npm run prisma:generate
   npm run prisma:migrate
   ```

---

## ⚠️ **Option 3: Local PostgreSQL Install**

**نیاز به نصب:**

### Windows:

1. **Download PostgreSQL:**
   ```
   https://www.postgresql.org/download/windows/
   ```

2. **Install:**
   - Next → Next
   - Remember password!
   - Port: 5432

3. **Create Database:**
   ```powershell
   # Open PowerShell
   psql -U postgres
   
   # در PostgreSQL prompt:
   CREATE DATABASE nard_arena;
   CREATE USER nard_user WITH PASSWORD 'nard_password_2024';
   GRANT ALL PRIVILEGES ON DATABASE nard_arena TO nard_user;
   \q
   ```

4. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://nard_user:nard_password_2024@localhost:5432/nard_arena?schema=public"
   ```

---

## 🚀 After Database Setup

Regardless of which option you chose:

### 1. Generate Prisma Client
```powershell
cd nard-backend
npm run prisma:generate
```

### 2. Run Migrations
```powershell
npm run prisma:migrate
```

This creates all tables.

### 3. Seed Database
```powershell
npm run prisma:seed
```

Creates test users:
- Admin: `admin@nardarena.com` / `Admin123!`
- Player 1: `player1@test.com` / `Test123!`
- Player 2: `player2@test.com` / `Test123!`

### 4. Start Server
```powershell
npm run start:dev
```

---

## 🧪 Test Database Connection

```powershell
# Open Prisma Studio (GUI for database)
npm run prisma:studio
```

Opens at: http://localhost:5555

---

## 🔍 Troubleshooting

### Problem: Connection refused
**Solution:**
- Check DATABASE_URL in `.env`
- Verify database is running (Neon/Supabase dashboard)
- Check firewall

### Problem: Migration fails
**Solution:**
```powershell
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Then seed again
npm run prisma:seed
```

### Problem: "P1001: Can't reach database server"
**Solution:**
- Check internet connection (for Neon/Supabase)
- Verify connection string is correct
- Check if IP is whitelisted (Neon/Supabase dashboard)

---

## 💡 Recommendation

**برای development:** استفاده از **Neon.tech** یا **Supabase**
- نصبی نیست
- رایگان
- سریع setup میشه
- Cloud-based

**برای production:** PostgreSQL مجزا یا RDS/Managed PostgreSQL

---

## 📞 Next Steps

After database is set up:

1. ✅ `npm run prisma:generate`
2. ✅ `npm run prisma:migrate`
3. ✅ `npm run prisma:seed`
4. ✅ `npm run start:dev`
5. ✅ Test at http://localhost:3001/api/docs

---

**Which option did you choose?** Let me know and I'll help you proceed!
