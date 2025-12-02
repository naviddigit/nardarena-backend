# 🎮 راهنمای بازی با AI - خودکار

## ✅ چی اضافه شد؟

### 1️⃣ **سطح سختی AI در ساخت بازی**
حالا وقتی بازی AI می‌سازی، می‌تونی سطح سختی رو تعیین کنی:

```http
POST http://localhost:3002/api/game/create
Authorization: Bearer YOUR_TOKEN

{
  "gameType": "AI",
  "aiDifficulty": "MEDIUM",    // EASY, MEDIUM, HARD, EXPERT
  "timeControl": 120,
  "gameMode": "CLASSIC"
}
```

**سطوح سختی:**
- `EASY` - راحت (تصادفی، برای تازه‌کارها)
- `MEDIUM` - متوسط (محتاطانه، 40% امنیت)
- `HARD` - سخت (متعادل، 30% امنیت + 30% پیشروی)
- `EXPERT` - حرفه‌ای (بهترین حرکت همیشه)

### 2️⃣ **صفحه استاندارد بکگمون**
دیگه نیاز نیست دستی صفحه رو بسازی! بازی با صفحه استاندارد بکگمون شروع میشه:
- سفید: 2 مهره روی نقطه 0، 5 مهره روی 5، 3 مهره روی 7، 5 مهره روی 11 و 12، 3 مهره روی 16
- سیاه (AI): همون چیدمان ولی برعکس

### 3️⃣ **AI خودکار حرکت می‌کنه**
بعد از هر حرکت تو، AI خودش:
1. ✅ تاس میریزه (2 تا عدد تصادفی 1-6)
2. ✅ زمان فکر کردن شبیه‌سازی می‌کنه (0.5-7 ثانیه بسته به سطح)
3. ✅ بهترین حرکت رو پیدا می‌کنه
4. ✅ مهره‌ها رو حرکت میده
5. ✅ نوبت رو برمی‌گردونه بهت

**هیچ کاری نباید بکنی!** فقط حرکت خودت رو بزن، AI خودش جواب میده.

## 🎯 نحوه استفاده

### مرحله 1: ساخت بازی با AI
```http
POST http://localhost:3002/api/game/create
Authorization: Bearer YOUR_JWT_TOKEN

{
  "gameType": "AI",
  "aiDifficulty": "HARD"
}
```

**جواب:**
```json
{
  "id": "uuid-game-id",
  "whitePlayerId": "your-user-id",
  "blackPlayerId": "00000000-0000-0000-0000-000000000001",  // AI Player
  "gameType": "AI",
  "gameState": {
    "points": [...],  // صفحه استاندارد
    "currentPlayer": "white",
    "aiDifficulty": "HARD"
  }
}
```

### مرحله 2: حرکت خودت رو بزن
```http
POST http://localhost:3002/api/game/{gameId}/move
Authorization: Bearer YOUR_JWT_TOKEN

{
  "playerColor": "WHITE",
  "moveNumber": 1,
  "from": 12,
  "to": 15,
  "diceUsed": [3, 5],
  "boardStateAfter": {
    "points": [...],
    "currentPlayer": "black"  // نوبت AI
  }
}
```

### مرحله 3: صبر کن AI بازی کنه
**هیچ کاری نکن!** بعد از 1 ثانیه، AI خودکار:
- تاس میریزه
- حرکت می‌کنه
- دیتابیس رو آپدیت می‌کنه
- نوبت رو برمی‌گردونه بهت

### مرحله 4: بازی رو چک کن
```http
GET http://localhost:3002/api/game/{gameId}
Authorization: Bearer YOUR_JWT_TOKEN
```

**جواب شامل:**
- حرکت‌های تو
- حرکت‌های AI (با تاس خودش)
- وضعیت فعلی صفحه

## 🔧 Endpoint های جدید

### 1. Trigger دستی AI (اختیاری)
اگه AI بازی نکرد یا مشکل داره، می‌تونی دستی ترایگرش کنی:

```http
POST http://localhost:3002/api/game/{gameId}/ai-move
Authorization: Bearer YOUR_JWT_TOKEN
```

**جواب:**
```json
{
  "moves": [
    {"from": 17, "to": 21},
    {"from": 17, "to": 22}
  ],
  "diceRoll": [4, 5],
  "difficulty": "HARD",
  "newGameState": {...}
}
```

### 2. تست AI با صفحه دلخواه (debug)
برای تست و دیباگ:

```http
POST http://localhost:3002/api/game/ai-move
Authorization: Bearer YOUR_JWT_TOKEN

{
  "points": [...],  // صفحه دلخواهت
  "bar": {...},
  "off": {...},
  "currentPlayer": "black",
  "diceRoll": [3, 5],
  "difficulty": "EXPERT"
}
```

## 📊 چی تو دیتابیس ذخیره میشه؟

### Game Table
```json
{
  "id": "game-uuid",
  "gameType": "AI",
  "blackPlayerId": "00000000-0000-0000-0000-000000000001",
  "gameState": {
    "aiDifficulty": "MEDIUM",  // سطح سختی ذخیره شده
    "currentPlayer": "white",
    "points": [...]
  },
  "moveHistory": [
    {
      "moveNumber": 1,
      "player": "white",
      "moves": [...],
      "dice": [3, 5]
    },
    {
      "moveNumber": 2,
      "player": "black",  // AI
      "moves": [...],
      "dice": [4, 6]  // تاس خود AI
    }
  ]
}
```

### GameMove Table
هر حرکت AI هم مثل بازیکن واقعی ذخیره میشه:
- `playerColor: "BLACK"`
- `diceUsed: [4, 6]` (تاس خود AI)
- `boardStateBefore` و `boardStateAfter`

## 🎲 جریان بازی

```
1. تو: ساخت بازی (POST /game/create) با aiDifficulty
   ↓
2. بازی با صفحه استاندارد بکگمون ساخته میشه
   ↓
3. تو: حرکت میزنی (POST /game/:id/move)
   ↓
4. Backend: حرکت تو رو ذخیره می‌کنه
   ↓
5. Backend: چک می‌کنه نوبت AI هست؟
   ↓
6. AI: تاس میریزه [مثلاً 4, 5]
   ↓
7. AI: فکر می‌کنه (0.5-7 ثانیه)
   ↓
8. AI: بهترین حرکت رو انتخاب می‌کنه
   ↓
9. AI: مهره‌ها رو حرکت میده
   ↓
10. Backend: حرکت AI رو ذخیره می‌کنه
   ↓
11. Backend: نوبت رو برمی‌گردونه به تو
   ↓
12. تو: GET /game/:id → می‌بینی AI بازی کرده
   ↓
13. تکرار از مرحله 3
```

## 🐛 اگه AI بازی نکرد چی کار کنم؟

### چک کردن:
```http
GET http://localhost:3002/api/game/{gameId}
```

اگه `currentPlayer: "black"` باشه ولی AI حرکت نکرده:

### راه حل 1: Trigger دستی
```http
POST http://localhost:3002/api/game/{gameId}/ai-move
```

### راه حل 2: چک کردن لاگ سرور
در ترمینال backend ببین خطایی هست یا نه:
```
[Nest] ERROR: AI move failed: ...
```

## ✨ مزایا

✅ **خودکار**: دیگه نیاز نیست دستی AI رو کنترل کنی  
✅ **واقع‌گرا**: AI زمان فکر کردن داره، مثل آدم واقعی  
✅ **سطوح متنوع**: از راحت تا حرفه‌ای  
✅ **ذخیره کامل**: همه حرکت‌های AI ذخیره میشه  
✅ **تست‌پذیر**: می‌تونی با صفحه دلخواه تست کنی  

## 🔜 مرحله بعدی: Bot AI ها

**الان:** یک AI که فقط تو بازی حرکت می‌کنه ✅

**مرحله بعد:** سیستم Bot AI که:
- 🤖 خودش ثبت‌نام می‌کنه با اسم واقعی
- 💰 خودش موجودی wallet داره
- 🎮 خودش بازی پولی ایجاد می‌کنه
- 👥 با بازیکن‌های واقعی بازی می‌کنه
- ⚡ اکانت‌های متنوع با سطوح مختلف
- 📊 آمار واقعی داره (Win/Loss)

این مرحله بعدی هست - فعلاً فقط AI بازیکن داریم که تو بازی‌های AI حرکت می‌کنه.

## 📝 نکات مهم

1. **AI_PLAYER_ID:** `00000000-0000-0000-0000-000000000001` - این ID همیشه AI هست
2. **سطح پیش‌فرض:** اگه `aiDifficulty` ندی، MEDIUM می‌شه
3. **تاخیر:** 1 ثانیه بعد از حرکت تو + زمان فکر AI (حدود 1-5 ثانیه)
4. **WebSocket:** فعلاً نداریم، باید GET کنی ببینی AI بازی کرده یا نه
5. **Timeout:** اگه AI crash کنه، می‌تونی `/ai-move` رو دستی صدا کنی

---

**🎯 حالا می‌تونی با AI بازی کنی!**  
فقط بازی بساز، حرکت بزن، و AI خودش باقی کارو انجام میده 🚀
