# NardAria Backend API - AI Backgammon Platform

Professional NestJS backend with TypeScript, Prisma ORM, and Socket.IO for real-time AI backgammon game management.

## Tech Stack

- **Framework:** NestJS 10 (Express-based)
- **Language:** TypeScript 5.3
- **Database:** PostgreSQL 15 + Prisma ORM 5.22
- **Real-time:** Socket.IO (WebSocket)
- **Authentication:** Passport.js + JWT + Google OAuth
- **Validation:** class-validator + class-transformer
- **Security:** Helmet, Rate limiting, bcrypt
- **Testing:** Jest + Supertest
- **Documentation:** Swagger/OpenAPI
- **Process Manager:** PM2

## Architecture

**Modular Layered Architecture** with **SOLID principles**:

```
src/
├── modules/          # Feature Modules
│   ├── auth/        # Authentication & JWT management
│   ├── users/       # User CRUD & profile
│   ├── games/       # Game logic, AI, state management
│   ├── wallet/      # Crypto wallet (future)
│   └── admin/       # Admin panel APIs
├── common/          # Guards, Interceptors, Filters, Pipes
├── config/          # Environment configuration
├── database/        # Prisma schema & migrations
└── main.ts          # Application bootstrap
```

## Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 15+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

## Environment Variables

Required in `.env` file:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nardaria"

# JWT
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3002
```

## Development

```bash
# Start dev server with hot reload
npm run start:dev

# Start with debug mode (inspector on port 9229)
npm run start:debug

# Watch mode with nodemon
npm run dev:nodemon
```

Server will run on: `http://localhost:3000`  
API Docs: `http://localhost:3000/api/docs` (Swagger UI)

## Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm run start:prod

# Start with PM2 (recommended)
pm2 start ecosystem.config.js --only nard-backend
```

## Database Management

```bash
# Open Prisma Studio (visual database editor)
npm run prisma:studio
# or
npm run studio

# Create migration after schema changes
npm run prisma:migrate

# Reset database (WARNING: deletes all data)
npm run prisma:reset

# Seed database with test data
npm run prisma:seed
```

## Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Test coverage report
npm run test:cov

# Watch mode for TDD
npm run test:watch
```

## Project Structure

```
prisma/
├── schema.prisma        # Database schema
├── seed.ts             # Seed data script
└── migrations/         # Migration history

src/
├── modules/
│   ├── auth/           # JWT, OAuth, login/register
│   ├── users/          # User management
│   ├── games/          # Game logic & AI
│   │   ├── dto/       # Request/Response DTOs
│   │   ├── ai/        # AI move calculation
│   │   ├── validators/ # Move validation
│   │   └── game.service.ts  # Business logic (⛔ LOCKED)
│   └── admin/          # Admin APIs
│       ├── users/     # User management
│       ├── games/     # Game monitoring
│       └── settings/  # System settings
├── common/
│   ├── guards/        # Auth guards (JWT, Roles)
│   ├── interceptors/  # Logging, Transform
│   ├── filters/       # Exception filters
│   └── decorators/    # Custom decorators
└── main.ts            # App bootstrap + CORS + Swagger
```

## Key Features

### 🎮 Game System
- **AI Opponent**: Minimax algorithm with alpha-beta pruning
- **Move Validation**: Server-side enforcement
- **State Persistence**: PostgreSQL + real-time sync
- **Chess-clock Timer**: Anti-cheat with `lastDoneAt` tracking
- **Opening Roll**: Fair dice system with anti-cheat
- **Bear Off Logic**: Validated server-side
- **Hit/Bar Mechanics**: Full backgammon rules

### 🔐 Authentication & Security
- JWT access tokens (15min) + refresh tokens (7d)
- Google OAuth integration
- Password hashing with bcrypt (12 rounds)
- Role-based access control (User/Admin)
- Rate limiting (100 req/min per IP)
- Helmet.js security headers
- CORS configured for frontend origin

### 📊 Admin Panel APIs
- User management (list, ban, suspend, role change)
- Game monitoring (active games, statistics)
- System settings (AI delays, timer settings)
- **Security**: Only 1 super admin, admins cannot be banned

### 🔄 Real-time WebSocket (Socket.IO)
- Game state synchronization
- Move broadcasting to players
- Spectator support
- Room-based architecture: `room_${gameId}`

### 🗃️ Database (Prisma + PostgreSQL)
- **Models**: User, Game, GameSetting, Wallet (future)
- **Indexes**: Optimized for query performance
- **Transactions**: ACID compliance
- **Migrations**: Version-controlled schema changes

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns access + refresh tokens)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/google` - OAuth login
- `GET /api/auth/google/callback` - OAuth callback

### Games
- `POST /api/games` - Create new AI game
- `GET /api/games/:id` - Get game state
- `POST /api/games/:id/roll` - Roll dice
- `POST /api/games/:id/move` - Make move
- `POST /api/games/:id/done` - End turn (triggers AI)
- `POST /api/games/:id/undo` - Undo last move
- `GET /api/games/user/:userId` - Get user's games

### Admin (Protected)
- `GET /api/admin/users` - List users (pagination + sorting)
- `PATCH /api/admin/users/:id/role` - Change user role
- `PATCH /api/admin/users/:id/ban` - Ban/unban user
- `GET /api/admin/games` - List all games
- `GET /api/admin/settings` - Get system settings
- `PATCH /api/admin/settings` - Update settings

## Important Files (⛔ LOCKED)

These files contain critical game logic and should NOT be modified without thorough testing:

1. **`src/modules/games/game.service.ts`** (500+ lines)
   - Game state management
   - AI move calculation
   - Timer logic (chess-clock with elapsed time)
   - Move validation
   - Bear-off/hit/bar mechanics

2. **`prisma/schema.prisma`**
   - Database schema
   - Relations between models
   - Indexes for performance

## Performance Benchmarks

- **Requests/second**: 8,000-12,000 (single instance)
- **Concurrent WebSocket connections**: 1,000+
- **Response time**: <50ms (avg), <200ms (p95)
- **Database queries**: <10ms (indexed queries)

## PM2 Process Management

```bash
# Start backend
pm2 start ecosystem.config.js --only nard-backend

# Monitor
pm2 monit
pm2 logs nard-backend

# Restart
pm2 restart nard-backend

# Stop
pm2 stop nard-backend

# Cluster mode (4 instances)
pm2 start ecosystem.config.js --only nard-backend -i 4
```

## Scalability Roadmap

### Phase 1: Single Server (Current)
- 1 NestJS instance
- PostgreSQL + optional Redis
- Handles 1,000 concurrent users

### Phase 2: Clustering
- PM2 cluster mode (4-8 instances)
- Redis for session storage
- Load balancer (Nginx)
- Handles 5,000 concurrent users

### Phase 3: Microservices
- Separate services: Auth, Game, Wallet, Admin
- API Gateway
- PostgreSQL cluster + Redis cluster
- Message queue (RabbitMQ/Kafka)
- Handles 20,000+ concurrent users

## Development Guidelines

### SOLID Principles

1. **Single Responsibility**: Each service handles one domain
2. **Open/Closed**: Use interfaces for extensibility
3. **Liskov Substitution**: Interfaces are interchangeable
4. **Interface Segregation**: Small, focused interfaces
5. **Dependency Inversion**: Depend on abstractions via DI

### Code Organization

```typescript
// Module structure
modules/example/
├── dto/                  # Request/Response DTOs
│   ├── create-example.dto.ts
│   └── update-example.dto.ts
├── entities/             # Prisma entities (auto-generated)
├── interfaces/           # TypeScript interfaces
├── example.controller.ts # HTTP endpoints
├── example.service.ts    # Business logic
├── example.module.ts     # Module definition
└── __tests__/           # Unit tests
    └── example.service.spec.ts
```

### Testing Standards

- **Unit Tests**: 70%+ coverage
- **Integration Tests**: Critical flows
- **E2E Tests**: User journeys
- **Mocking**: Use Jest mocks for external dependencies

## Debugging

```bash
# Start with debugger attached
npm run start:debug

# Connect with VS Code debugger (port 9229)

# Check logs
tail -f logs/combined.log
tail -f logs/error.log

# Database queries (enable in Prisma)
# Set DEBUG=prisma:query in .env
```

## Related Documentation

- **Game Logic:** `/GAME_LOGIC_COMPLETE.md` (Root folder)
- **Project Summary:** `PROJECT_SUMMARY_FOR_AI.md` (This folder)
- **Frontend README:** `../nard-frontend/README.md`
- **Prisma Docs:** https://www.prisma.io/docs
- **NestJS Docs:** https://docs.nestjs.com

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U your_user -d nardaria

# Reset database
npm run prisma:reset
```

### Migration Errors
```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration manually
npx prisma migrate dev --name your_migration_name
```

### Port Already in Use
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -ti:3000  # Mac/Linux

# Kill process
taskkill /PID <PID> /F  # Windows
kill -9 <PID>  # Mac/Linux
```

## Support

For issues or questions, check:
- API documentation: `/api/docs`
- Logs: `logs/` directory
- Project summary: `PROJECT_SUMMARY_FOR_AI.md`

---

**Built with ❤️ using NestJS + TypeScript + Prisma**
