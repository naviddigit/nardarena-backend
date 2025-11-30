# 🚀 Nard Arena Backend - Installation & Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **PostgreSQL**: v15 or higher
- **Docker** (optional, for containerized database)

## 🔧 Installation Steps

### 1. Navigate to Backend Directory

```powershell
cd nard-backend
```

### 2. Install Dependencies

```powershell
npm install
```

This will install all required packages:
- NestJS framework
- Prisma ORM
- JWT authentication
- Socket.IO for real-time
- And all other dependencies

### 3. Setup Environment Variables

```powershell
# Copy example env file
cp .env.example .env

# Open .env and configure:
# - Database connection string
# - JWT secrets (change default values!)
# - Other configurations
```

**Important**: Change JWT secrets in production!

### 4. Start PostgreSQL Database

#### Option A: Using Docker (Recommended)

```powershell
# From project root directory
cd ..
docker-compose up -d postgres

# Check if running
docker ps
```

#### Option B: Local PostgreSQL

1. Install PostgreSQL 15+
2. Create database:
   ```sql
   CREATE DATABASE nard_arena;
   CREATE USER nard_user WITH PASSWORD 'nard_password_2024';
   GRANT ALL PRIVILEGES ON DATABASE nard_arena TO nard_user;
   ```

3. Update `.env` with your connection string

### 5. Generate Prisma Client

```powershell
npm run prisma:generate
```

This generates TypeScript types from your Prisma schema.

### 6. Run Database Migrations

```powershell
npm run prisma:migrate
```

This creates all tables in your database.

### 7. Seed Database (Optional)

```powershell
npm run prisma:seed
```

This creates:
- Admin user: `admin@nardarena.com` / `Admin123!`
- Test users: `player1@test.com` / `Test123!`
- Test users: `player2@test.com` / `Test123!`

### 8. Start Development Server

```powershell
npm run start:dev
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎲 Nard Arena Backend API                          ║
║                                                       ║
║   🚀 Server running on: http://localhost:3001        ║
║   📚 API Documentation: http://localhost:3001/api/docs  ║
║   🌍 Environment: development                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

## 🧪 Verify Installation

### 1. Check API Health

Open browser or use curl:
```powershell
curl http://localhost:3001/api/auth/login
```

### 2. Check Swagger Documentation

Open in browser:
```
http://localhost:3001/api/docs
```

### 3. Check Database Connection

```powershell
npm run prisma:studio
```

This opens Prisma Studio (database GUI) at `http://localhost:5555`

## 🔍 Troubleshooting

### Problem: "Cannot connect to database"

**Solution:**
```powershell
# Check if PostgreSQL is running
docker ps

# If not running:
docker-compose up -d postgres

# Check logs:
docker logs nard_postgres
```

### Problem: "Port 3001 already in use"

**Solution:**
1. Change `PORT` in `.env` file
2. Or kill process using port:
   ```powershell
   # Find process
   netstat -ano | findstr :3001
   
   # Kill process (replace PID with actual number)
   taskkill /PID <PID> /F
   ```

### Problem: Prisma Client errors

**Solution:**
```powershell
# Regenerate Prisma Client
npm run prisma:generate

# If still issues, clear and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run prisma:generate
```

### Problem: Migration errors

**Solution:**
```powershell
# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Then seed again
npm run prisma:seed
```

## 📝 Useful Commands

### Development

```powershell
# Start with hot reload
npm run start:dev

# Start with debug mode
npm run start:debug

# View logs in real-time
# (logs appear in console)
```

### Database Management

```powershell
# Open Prisma Studio (GUI)
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Reset database (WARNING: Deletes all data)
npm run prisma:migrate reset

# Generate Prisma Client
npm run prisma:generate

# Seed database
npm run prisma:seed
```

### Testing

```powershell
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

### Production Build

```powershell
# Build for production
npm run build

# Start production server
npm run start:prod
```

### Code Quality

```powershell
# Lint code
npm run lint

# Format code with Prettier
npm run format
```

## 🗄️ Database Schema

View schema in `prisma/schema.prisma`

Main tables:
- `users` - User accounts
- `user_stats` - User statistics
- `games` - Game sessions
- `wallet_keys` - Crypto wallets (Phase 2)
- `transactions` - Financial transactions (Phase 2)
- `admin_actions` - Admin activity logs
- `refresh_tokens` - JWT refresh tokens

## 🔐 Default Users (After Seeding)

### Admin
- Email: `admin@nardarena.com`
- Password: `Admin123!`

### Test Players
- Email: `player1@test.com` / Password: `Test123!`
- Email: `player2@test.com` / Password: `Test123!`

## 🌐 API Endpoints

After starting, visit:
- **Swagger Docs**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/health (TODO: implement)

### Main Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

#### Users
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile

#### Games
- `POST /api/games/create` - Create game
- `GET /api/games/:id` - Get game details

#### Admin
- `GET /api/admin/stats` - Platform stats
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id/ban` - Ban user

#### WebSocket (Socket.IO)
- Namespace: `/game`
- Events: `join_game`, `make_move`, `roll_dice`, `game_over`

## 📊 Project Structure

```
nard-backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeder
├── src/
│   ├── common/            # Shared utilities
│   │   ├── decorators/    # Custom decorators
│   │   ├── filters/       # Exception filters
│   │   ├── guards/        # Auth guards
│   │   └── interceptors/  # Interceptors
│   ├── config/            # Configuration (TODO)
│   ├── database/          # Prisma service
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── modules/           # Feature modules
│   │   ├── auth/          # Authentication
│   │   ├── users/         # User management
│   │   ├── games/         # Game logic
│   │   └── admin/         # Admin panel
│   ├── app.module.ts      # Root module
│   └── main.ts            # Bootstrap file
├── test/                  # Tests
├── .env                   # Environment variables
├── .env.example           # Example env file
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md              # Documentation
```

## 🚀 Next Steps

After installation:

1. ✅ Test authentication endpoints in Swagger
2. ✅ Create a test user via `/api/auth/register`
3. ✅ Login and get JWT token
4. ✅ Test protected endpoints with token
5. ✅ Test WebSocket connection (use Socket.IO client or frontend)

## 🔄 Updating Code

After pulling new code:

```powershell
# Install new dependencies
npm install

# Regenerate Prisma Client (if schema changed)
npm run prisma:generate

# Run new migrations (if any)
npm run prisma:migrate

# Restart server
npm run start:dev
```

## 🐛 Development Tips

### Hot Reload
Code changes auto-reload in dev mode (`npm run start:dev`)

### Debugging
1. Run with `npm run start:debug`
2. Attach debugger in VS Code (F5)

### Database Inspection
Use Prisma Studio:
```powershell
npm run prisma:studio
```

### Logs
All logs appear in console. Important events:
- ✅ Database connected
- 🚀 Server started
- 📝 User actions
- ⚠️ Warnings
- ❌ Errors

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review error messages carefully
3. Check Prisma Studio for database state
4. Review `.env` configuration
5. Ask the team

## ✅ Verification Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL running (Docker or local)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] Prisma Client generated
- [ ] Migrations run successfully
- [ ] Database seeded
- [ ] Server starts without errors
- [ ] Swagger docs accessible
- [ ] Can register/login via API

---

**Happy Coding! 🎮**
