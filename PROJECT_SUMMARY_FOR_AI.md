# 🎮 NardAria Backgammon - Complete Project Summary for AI Assistant

## 📌 CRITICAL: Read This First! (Updated Dec 7, 2025 - 9:05 PM)

This project has been through **MONTHS** of debugging and testing. Many files are **LOCKED** and should **NEVER** be modified without explicit permission.

### 🚨 NEW CRITICAL BUG - AI TIMER STEALING HUMAN TIME (Dec 7, 2025)
**Status**: ⚠️ UNRESOLVED - Multiple fix attempts failed
**Priority**: CRITICAL - Human player loses extra seconds when AI plays

**Problem**: When AI finishes its turn, human player's timer shows 10+ seconds already passed!

**Example Logs**:
```
User presses Done (01:03:46):
  lastDoneBy: 'white'
  lastDoneAt: '2025-12-08T01:03:46.221Z'
  whiteTime: 234 seconds ✅

AI plays for 6 seconds...

AI finishes (01:03:52):
  Frontend shows: whiteTime: 225 seconds ❌ (should be 234!)
  Lost: 9 seconds during AI's turn!
```

**Root Cause Analysis**:
The timer calculation happens at wrong time:

1. **Current Flow (WRONG)**:
   - User Done → `lastDoneBy: 'white'`, `lastDoneAt: 01:03:46`
   - AI starts playing (6 seconds thinking)
   - During AI play: `lastDoneBy` is still `'white'` → `activePlayer: 'black'` (AI)
   - `calculateCurrentTimers` runs → AI timer decrements from 240 to 234
   - AI Done → `lastDoneAt: 01:03:46` (AI start time, trying to "rewind")
   - Frontend fetches timers → sees white: 225 (lost 9 seconds!)
   - **Why?** Because elapsed time calculated from `lastDoneAt` but AI timer already decremented!

2. **What User Expects**:
   - User Done at 01:03:46
   - AI plays (user shouldn't lose ANY time during this!)
   - AI Done → User timer starts counting FROM NOW
   - Result: User only loses time during their actual turn

**Attempted Fixes (ALL FAILED)**:
1. ❌ Set `lastDoneAt` to AI start time instead of end time → Still lost time
2. ❌ Save AI timer BEFORE AI plays → Still lost time
3. ❌ Preserve `lastDoneBy`/`lastDoneAt` in syncGameState → Fixed different bug but not this

**Key Insight**:
The problem is that `calculateCurrentTimers` uses `lastDoneBy` to determine whose timer counts.
- If `lastDoneBy: 'white'` → AI's timer counts
- If `lastDoneBy: 'black'` → User's timer counts

But during AI's turn, we can't change `lastDoneBy` because that would start user's timer too early!

**Possible Solutions for Next AI**:
1. **Stop timer during AI play**: When AI starts, save both timers and FREEZE them. Don't calculate elapsed time until AI finishes.
2. **Separate AI flag**: Add `isAIPlaying: boolean` flag. When true, calculateCurrentTimers returns saved values without decrementing.
3. **Timer snapshots**: Save timer snapshots before AI starts, restore them after AI finishes.

**Files Modified (need reverting or fixing)**:
- `nard-backend/src/modules/game/game.service.ts` (lines 1206-1270, 1387-1427)
  - Lines 1245-1260: Added timer save BEFORE AI plays
  - Lines 1395-1401: Removed timer calculation AFTER AI plays
  - These changes didn't work - user still loses time!

**Critical Commits**:
- `28ac6f1`: Fix syncGameState preserving lastDoneBy (GOOD - keep this!)
- `44e24cb`: Use AI start time for lastDoneAt (BAD - didn't work)
- `6ccd6a5`: Save timer before AI plays (BAD - didn't work)

---

### ✅ PREVIOUS BUG FIXED - syncGameState Timer Loss (Dec 7, 2025)
**Status**: ✅ RESOLVED - This bug is fixed, don't touch it!
**Fix**: syncGameState was overwriting `lastDoneBy`/`lastDoneAt` with frontend state

**Root Cause Found**: 
```typescript
// ❌ BEFORE (WRONG):
const updatedGameState = {
  ...syncStateDto.gameState, // Only has frontend fields!
  diceValues: syncStateDto.diceValues || [],
};

// ✅ AFTER (FIXED):
const updatedGameState = {
  ...existingGameState, // Start with DB state (has lastDoneBy/lastDoneAt)
  ...syncStateDto.gameState, // Merge frontend changes
  diceValues: syncStateDto.diceValues || [],
  lastDoneBy: existingGameState.lastDoneBy, // Force preserve
  lastDoneAt: existingGameState.lastDoneAt, // Force preserve
};
```

**This fix works! Don't change syncGameState or updateGameState!**

---

### ⛔ ABSOLUTELY LOCKED FILES - DO NOT TOUCH:
1. `nard-frontend/src/app/game/ai/page.tsx` - ⛔⛔⛔ MAIN GAME PAGE - Heart of entire game
2. `nard-frontend/src/app/game/ai/hooks/useGameTimers.ts` - Timer management
3. `nard-frontend/src/app/game/ai/hooks/useDiceRollControl.ts` - Roll button control
4. `nard-frontend/src/app/game/ai/hooks/useAIGameLogic.ts` - AI logic with delays
5. `nard-frontend/src/app/game/ai/hooks/useDiceRoller.ts` - Dice rolling
6. `nard-frontend/src/app/game/ai/hooks/useBackendDice.ts` - Backend dice
7. `nard-frontend/src/components/dice-roller/dice-roller-load.tsx` - 3D dice renderer
8. `nard-backend/src/modules/game/game.service.ts` - ⛔ Core game logic with hit detection

### 🎲 CURRENT CRITICAL ISSUE (Dec 6, 2025):
**DICE DISPLAY BUG**: Backend generates correct pre-generated dice values, but Three.js renderer shows WRONG faces on screen!

**Problem Details:**
- Backend generates: `openingDiceWhite: 6, openingDiceBlack: 5, firstRollDice: [6, 5]`
- Physics animation shows: `[4, 4]` (WRONG!)
- Manual geometry fix logs success but display unchanged
- dice.js `shift_dice_faces()` runs but animation overwrites changes

**What Works:**
- ✅ Ctrl+6 hotkey (`triggerDoubleSix`) works perfectly with `setDiceValues([6, 6])`
- ✅ Backend correctly generates and returns dice values
- ✅ Frontend receives correct values from backend
- ✅ Timer system works (chess-clock Done-based persistence)

**What Doesn't Work:**
- ❌ Pre-generated dice don't display correctly (geometry modified but renderer doesn't update)
- ❌ Three.js r73 doesn't recognize update flags
- ❌ `shift_dice_faces` called before animation, but animation overwrites it

**Latest Fix Attempt (lines 445-497 in dice-roller-load.tsx):**
- Removed `setTimeout(100ms)` delay
- Applied geometry fix synchronously in callback
- Called `box.renderer.render()` immediately after fix
- Still doesn't work - renderer shows wrong faces

**Critical Files for Dice Bug:**
- `nard-frontend/src/components/dice-roller/dice-roller-load.tsx` (lines 440-500)
- `nard-frontend/public/dice.js` (lines 418-433, 851-872)
- `nard-backend/src/modules/game/game.service.ts` (lines 188-201, 418-428, 1558-1580)

**⚠️ WARNING:** User has been EXTREMELY frustrated with repeated bugs caused by modifying working code. Do NOT modify these files unless there is a clear, reproducible error AND explicit permission.

**🚨 IMPORTANT:** Development servers (frontend on :8083, backend on :3002) are ALWAYS running. Never try to restart them unless explicitly asked!

---

## 🏗️ Project Architecture

### Tech Stack:
- **Frontend**: Next.js 14.2.4, React, TypeScript, Material-UI
- **Backend**: NestJS, Prisma ORM, PostgreSQL
- **Dice Rendering**: dice.js 3D physics library (Canvas/Three.js)
- **State Management**: Custom hooks with React state

### Repository Structure:
```
NardAria-v4/Minimal_TypeScript_v5.7.0/
├── nard-frontend/          # Next.js frontend
│   ├── src/
│   │   ├── app/game/ai/    # AI game page
│   │   │   ├── hooks/      # 🔒 LOCKED HOOKS (see above)
│   │   │   └── page.tsx    # Main game page (CRITICAL)
│   │   ├── components/
│   │   │   └── dice-roller/ # Dice 3D rendering
│   │   ├── hooks/
│   │   │   └── game-logic/ # Core game state management
│   │   └── services/
│   │       └── game-persistence-api.ts # Backend API calls
│   └── public/libs/        # dice.js, three.js, cannon.js
│
└── nard-backend/           # NestJS backend
    └── src/modules/game/
        ├── game.service.ts  # 🔒 LOCKED - Core game logic
        ├── ai-player.service.ts # AI move calculation
        └── dice.service.ts  # Dice management

Branches:
- Frontend: temp-with-themes (https://github.com/naviddigit/nardarena-mui)
- Backend: main (https://github.com/naviddigit/nardarena-backend)

**Development Servers (ALWAYS RUNNING)**:
- Frontend: http://localhost:8083 (Next.js with Turbopack)
- Backend: http://localhost:3002 (NestJS with watch mode)
- ⚠️ Never restart these unless explicitly asked!
```

---

## 🎲 Game Rules (ABSOLUTE - NEVER CHANGE)

### Movement Directions:
- **White (⚪)**: Moves from point 23 → 0 (SUBTRACT die value)
- **Black (⚫)**: Moves from point 0 → 23 (ADD die value)

### Bar Entry:
- **White from bar**: Goes to point (24 - die value)
- **Black from bar**: Goes to point (die value - 1)

### Home Boards:
- **White home**: Points 0-5
- **Black home**: Points 18-23

### Hit Logic:
- If opponent has **exactly 1 checker** on destination → Hit (send to bar)
- If opponent has **2+ checkers** → Blocked (cannot move there)

### Doubles:
- Rolling [3,3] → Expands to [3,3,3,3] for 4 moves
- Frontend shows [3,3,3,3], Backend stores [3,3] - **This is CORRECT, not a bug!**

---

## 🔥 Critical Bugs Fixed (DO NOT REINTRODUCE!)

### 1. Dice Synchronization Issues ✅ FIXED
**Problem**: AI would roll dice showing [2,3] but play with [4,5]

**Root Cause**: 
- dice.js library cannot reliably force specific values
- Animation callback returns wrong values
- State was being updated from animation instead of backend

**Solution (LOCKED)**:
```typescript
// ⛔ CRITICAL: Always get dice from backend FIRST
const diceResponse = await gamePersistenceAPI.rollDice();

// Apply to game state IMMEDIATELY (don't wait for animation)
handleDiceRollWithTimestamp(results);

// THEN trigger animation (visual only)
setSkipBackendDice(true); // Flag to ignore animation callback
diceRoller.setDiceValues(diceResponse.dice);
```

**Key Files**: 
- `page.tsx` lines ~610-640 (Player roll)
- `page.tsx` lines ~876-920 (AI roll)
- `dice-roller-load.tsx` - Always uses requested values, NOT callback result

### 2. Timer Issues ✅ FIXED
**Problem**: 
- Player timer jumping/resetting during their turn
- Opponent timer running at wrong times
- Timers not stopping when clicking Done

**Root Cause**: Timer logic scattered across multiple useEffects with no clear ownership

**Solution (LOCKED)**: Created `useGameTimers.ts` hook with 3 clear responsibilities:
1. Start timer when turn begins
2. Check for timeout
3. Stop all timers when game ends

**File**: `src/app/game/ai/hooks/useGameTimers.ts` (95 lines)

### 3. Roll Button Not Disabling ✅ FIXED
**Problem**: After rolling dice, Roll button would stay enabled even though player should be moving pieces

**Root Causes**:
1. `handleDiceRollWithTimestamp` wasn't being called before animation
2. `isRolling` state wasn't synced with `gamePhase` changes
3. Dependencies missing from AI auto-roll useEffect

**Solution (LOCKED)**: 
- Created `useDiceRollControl.ts` hook with clear enable/disable logic
- Added useEffect to set `isRolling=false` when gamePhase changes to 'moving'
- Added `isRolling` and `isWaitingForBackend` to AI useEffect dependencies

**File**: `src/app/game/ai/hooks/useDiceRollControl.ts`

### 4. AI Moves Executing Simultaneously ✅ FIXED
**Problem**: All AI moves happening at once instead of sequentially with human-like delays

**Solution (LOCKED)**:
```typescript
// Execute moves sequentially with random 1-4 second delays
for (let i = 0; i < aiResult.moves.length; i++) {
  await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
  
  // Show selection
  setGameState(prev => ({ ...prev, selectedPoint: move.from }));
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Execute move
  setGameState(prev => {
    // ... manipulate boardState arrays
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

**File**: `src/app/game/ai/hooks/useAIGameLogic.ts` lines ~99-170

### 5. Hit Logic Not Working ✅ FIXED
**Problem**: Pieces stacking instead of hitting opponent's single checkers

**Solution (LOCKED)**: Added hit detection in backend `applyMove` function:
```typescript
const destPoint = newBoard.points[move.to];
if (destPoint[opponentColor] === 1) {
  destPoint[opponentColor] = 0;
  newBoard.bar[opponentColor]++;
}
```

**File**: `nard-backend/src/modules/game/game.service.ts` lines ~483-530

### 6. Old Dice Showing Before New Dice ✅ FIXED
**Problem**: When AI rolls, old dice values show for a moment before new ones

**Solution**: Clear dice with delays before showing new ones:
```typescript
// Player roll: 200ms delay
if (diceRollerRef.current?.clearDice) {
  diceRollerRef.current.clearDice();
  await new Promise(resolve => setTimeout(resolve, 200));
}

// AI roll: 500ms delay (more time for smoother transition)
if (diceRollerRef.current?.clearDice) {
  diceRollerRef.current.clearDice();
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

**Files**: 
- `page.tsx` triggerDiceRoll function
- `page.tsx` AI auto-roll useEffect
- `dice-roller-load.tsx` - setDiceValues() now calls box.clear() first

### 7. AI Move Delays Hardcoded ✅ FIXED → Made Configurable
**Problem**: AI move delays were hardcoded in frontend (1000-4000ms)

**Solution**: Made AI delays configurable from database via admin panel:
- Added `GameSetting` model to database with categories (TIMING, SCORING, RULES, BETS, AI)
- Created seed data: `ai.move_delay_min=1000`, `ai.move_delay_max=4000`
- Backend API endpoints:
  - GET `/api/settings/game/ai-delays` (public) - Returns {min, max}
  - GET `/api/settings/game` (public) - Returns all game settings
  - PATCH `/api/settings/game/bulk` (protected) - Bulk update multiple settings
  - PUT `/api/settings/game/:key` (protected) - Update single setting
- Frontend loads delays on component mount via useEffect
- Admin UI: Game Settings page has "AI Behavior" section with 2 fields

**Files**:
- `nard-backend/prisma/schema.prisma` - Added GameSetting model and enums
- `nard-backend/prisma/seed.ts` - Added ai.move_delay_min and ai.move_delay_max
- `nard-backend/src/modules/settings/settings.service.ts` - Added game settings CRUD methods
- `nard-backend/src/modules/settings/settings.controller.ts` - Added public/protected endpoints
- `nard-frontend/src/app/game/ai/hooks/useAIGameLogic.ts` - Load delays from API on mount
- `nard-frontend/src/services/game-persistence-api.ts` - Added getAIMoveDelays() method
- `nard-frontend/src/sections/dashboard/game-settings/game-settings-view.tsx` - Added AI section UI

**Key Notes**:
- Settings are read-only in game (loaded once on mount)
- Changes require starting a new game to take effect
- Authentication: Public endpoints accessible without JWT, protected endpoints require admin auth

---

## 🎯 How The Game Flow Works

### 1. Opening Roll Phase:
```
1. Player (white) rolls 1 die
2. AI (black) rolls 1 die  
3. Higher roll starts
4. If tie, re-roll
5. Winner goes to 'waiting' phase to roll 2 dice
```

### 2. Normal Turn Flow:
```
Player Turn:
1. gamePhase = 'waiting'
2. Player clicks Roll button
3. Backend generates dice → Frontend applies to state
4. Animation plays (visual only)
5. gamePhase changes to 'moving'
6. Player moves pieces
7. Player clicks Done
8. Timer stops, turn switches to AI

AI Turn:
1. gamePhase = 'waiting'  
2. AI auto-rolls after 2 seconds
3. Backend generates dice → Frontend applies to state
4. Animation plays
5. gamePhase changes to 'moving'
6. useAIGameLogic hook detects and executes moves:
   - Syncs state to backend
   - Gets AI moves from backend
   - Executes each move with delays (1-4 seconds)
   - Applies final backend state
   - Auto-clicks Done after delay
7. Turn switches back to player
```

### 3. State Flow Diagram:
```
opening → waiting → moving → waiting → moving → ...
   ↓         ↓         ↓
 Roll     Roll      Move    
  Die     2 Dice   Pieces
```

---

## 🔧 Key Services & APIs

### Frontend API (`game-persistence-api.ts`):
```typescript
// Create AI game
createAIGame(difficulty: 'EASY' | 'MEDIUM' | 'HARD')

// Roll dice (called by both player and AI)
rollDice()

// Sync state before AI calculates moves
syncGameState(gameId, boardState, currentPlayer, diceValues)

// Get AI moves
getAIMoves(gameId)

// Apply moves to backend
applyMove(gameId, move)

// End turn
endTurn(gameId)

// Get AI move delays (NEW - for configurable timing)
getAIMoveDelays() // Returns { min: number, max: number }
```

### Backend Services:

**GameService** (`game.service.ts`):
- `rollDice()` - Generate random dice
- `applyMove()` - 🔒 LOCKED - Has hit logic
- `validateMove()` - Check if move is legal
- `endTurn()` - Switch players

**AIPlayerService** (`ai-player.service.ts`):
- `calculateBestMoves()` - Get optimal moves for AI
- Uses minimax algorithm with difficulty levels

**DiceService** (`dice.service.ts`):
- Centralized dice generation
- Ensures randomness

**SettingsService** (`settings.service.ts`):
- System settings CRUD (fees, limits, etc.)
- Game settings CRUD (AI timing, scoring, rules, bets)
- `getAllGameSettings()` - Get all game settings
- `getAIMoveDelays()` - Get AI delay min/max
- `updateGameSetting(key, value)` - Update single setting
- Category filtering support (TIMING, SCORING, RULES, BETS, AI)

---

## 🐛 Common Pitfalls & How to Avoid Them

### ❌ DON'T: Modify board state with number operations
```typescript
// WRONG - This breaks because checkers is an array!
newBoard.points[from].count--;
```

### ✅ DO: Use array operations
```typescript
// CORRECT
newBoard.points[from].checkers.pop();
newBoard.points[from].count = newBoard.points[from].checkers.length;
```

### ❌ DON'T: Trust dice.js animation callback results
```typescript
// WRONG - dice.js often returns wrong values!
box.roll(vectors, values, (result) => {
  handleDiceRoll(result); // ❌ NO!
});
```

### ✅ DO: Use requested values, ignore callback
```typescript
// CORRECT
box.roll(vectors, values, (result) => {
  // Use 'values', NOT 'result'
  const correctResults = values.map(v => ({ value: v, type: 'd6' }));
  handleDiceRoll(correctResults);
});
```

### ❌ DON'T: Update isRolling immediately after calling handleDiceRoll
```typescript
// WRONG - gamePhase hasn't changed yet!
handleDiceRollWithTimestamp(results);
setIsRolling(false); // ❌ Too early!
```

### ✅ DO: Let useEffect handle it when gamePhase changes
```typescript
// CORRECT - useEffect watches gamePhase
useEffect(() => {
  if (gamePhase === 'moving' && isRolling) {
    setIsRolling(false);
  }
}, [gamePhase, isRolling]);
```

### ❌ DON'T: Validate dice with strict equality for doubles
```typescript
// WRONG - Doubles expand to 4 moves!
if (frontendDice.length !== backendDice.length) {
  throw new Error('Dice mismatch'); // ❌ False positive!
}
```

### ✅ DO: Understand doubles expansion is correct
```typescript
// CORRECT - This is expected behavior
Frontend: [3,3,3,3] // 4 moves for doubles
Backend: [3,3]      // Original roll
// Not a bug! Doubles get expanded on frontend.
```

---

## 📝 Important Code Patterns

### Hook Call Order in page.tsx:
```typescript
// 1. Game state
const { handleDiceRoll, handleEndTurn, ... } = useGameState();

// 2. AI logic
const { isExecutingAIMove } = useAIGameLogic({
  gameState, setGameState, backendGameId
});

// 3. Timers
const whiteTimer = useCountdownSeconds(1800);
const blackTimer = useCountdownSeconds(1800);

// 4. Timer management (needs timer objects first!)
useGameTimers({
  gameState, playerColor, whiteTimer, blackTimer, winner, onTimeout
});

// 5. Roll control (needs all states)
const { canRoll } = useDiceRollControl({
  gameState, playerColor, isRolling, isWaitingForBackend, isExecutingAIMove
});
```

### Critical Flags:
- `skipBackendDice`: Set to `true` when dice already applied, prevents double application
- `isWaitingForBackend`: Prevents duplicate API calls
- `isExecutingAIMove`: Prevents interference during AI moves
- `isRolling`: Controls dice animation state

### State Synchronization Pattern:
```typescript
// 1. Get backend data
const diceResponse = await gamePersistenceAPI.rollDice();

// 2. Apply to state FIRST
handleDiceRollWithTimestamp(results);

// 3. THEN show animation
setSkipBackendDice(true);
diceRoller.setDiceValues(diceResponse.dice);
```

---

## 🎨 UI Components

### Dice Roller (`dice-roller-load.tsx`):
- Loads dice.js, three.js, cannon.js dynamically
- Creates 3D dice with physics
- **CRITICAL**: Always uses requested values, NOT callback results
- Has warning log when dice.js returns wrong values

### Player Card:
- Shows player info, timer, dice
- Roll/Done/Undo buttons
- Controlled by `canRoll`, `canDone`, `canUndo` props

### Game Board:
- 24 points (triangles)
- Bar for hit pieces
- Off area for borne-off pieces
- Click handlers for selecting/moving checkers

---

## 🚨 User Frustration History

The user has been **EXTREMELY** frustrated with:

1. **Repeated bugs coming back**: Fixing one thing breaks another
2. **AI playing with wrong dice**: Took weeks to fix dice synchronization
3. **Timer not working**: Multiple attempts to get timers right
4. **Roll button staying enabled**: After fixing, broke again multiple times
5. **Excessive logging**: Console filled with useless logs

### User's Expectations:
- ✅ **Lock files after they work**: Add DO NOT MODIFY comments
- ✅ **Don't touch working code**: Only fix if there's a clear bug
- ✅ **Test before committing**: Make sure changes don't break other things
- ✅ **Clean code**: Remove excessive console.logs
- ✅ **Minimal changes**: Fix only what's broken, don't refactor unnecessarily

### Phrases User Has Used (shows frustration level):
- "کسکش" (repeatedly)
- "کونی" 
- "ریدم بهت"
- "چیکار میکنی"
- "دیگه نمیتونم"

**Translation**: User is at breaking point. Be VERY careful with changes!

---

## 📚 Documentation Files

- `README.md` - Main project README
- `AI_GAME_GUIDE.md` (backend) - AI implementation guide
- `AI_TESTING.md` (backend) - How to test AI moves
- `ANIMATION-DIAGNOSIS.md` (frontend) - Animation debugging
- `BUG-FIXES.md` (frontend) - History of bug fixes
- `DEV-GUIDE.md` (frontend) - Development guide
- `SERVER_GAME_ARCHITECTURE.md` (frontend) - Architecture overview
- `TIMER-SECURITY.md` (frontend) - Timer security notes

---

## 🎯 When Helping User Next Time

### ✅ DO:
1. Read this file completely first
2. Check if file is LOCKED before modifying
3. Ask for permission before touching locked files
4. Test changes thoroughly
5. Make minimal, focused changes
6. Keep console.logs minimal
7. Understand the full flow before changing anything

### ❌ DON'T:
1. Touch locked files without explicit permission
2. Refactor working code "to make it better"
3. Change file structure or patterns
4. Add excessive logging
5. Modify multiple files when fixing one issue
6. Assume you know better than existing code
7. Break working features while fixing others

### 🔍 Debugging Approach:
1. Ask user for specific logs/behavior
2. Read relevant locked files to understand current implementation
3. Identify exact issue without touching working code
4. Propose minimal fix
5. Get approval before implementing
6. Test thoroughly
7. Remove debug logs before committing

### 💬 Communication:
- Be direct and concise (user prefers short answers)
- Don't apologize excessively
- Show what you're doing with actions, not words
- If you break something, fix it immediately
- User speaks Persian - respond in Persian when appropriate
- **NEVER** restart dev servers unless explicitly asked (they are always running)
- User updates this summary file - keep it current with all changes

---

## 🔐 Last Stable Commits

### Frontend (temp-with-themes):
- Repository: https://github.com/naviddigit/nardarena-mui
- Commit: `0878aad`
- Message: "🔒 Lock critical hooks and fix dice/timer/roll issues"
- All hooks locked and working

**Uncommitted Changes (6 files)**:
1. `useAIGameLogic.ts` - Load AI delays from backend on mount
2. `useGameTimers.ts` - Strengthened lock warning
3. `page.tsx` - AI game page updates
4. `dice-roller-load.tsx` - Locked with clear warning, old dice clearing
5. `game-settings-view.tsx` - Added AI Behavior section
6. `game-persistence-api.ts` - Added getAIMoveDelays() method

### Backend (main):
- Repository: https://github.com/naviddigit/nardarena-backend
- Commit: `d819506`
- Message: "🔒 Stable backend - AI game logic working"
- AI logic tested and stable

**Uncommitted Changes (4 files)**:
1. `prisma/schema.prisma` - Added GameSetting model with enums
2. `prisma/seed.ts` - Added ai.move_delay_min and ai.move_delay_max
3. `settings.controller.ts` - Added public/protected game settings endpoints
4. `settings.service.ts` - Added game settings CRUD methods

**Database Migration**:
- Migration: `20251202160455_add_game_settings`
- Status: ✅ Applied successfully

---

## 🎮 Game State Structure

```typescript
interface GameState {
  boardState: {
    points: Array<{
      checkers: ('white' | 'black')[];
      count: number;
    }>;
    bar: { white: number; black: number };
    off: { white: number; black: number };
  };
  currentPlayer: 'white' | 'black';
  diceValues: number[];
  validMoves: Array<{ from: number; to: number }>;
  gamePhase: 'opening' | 'waiting' | 'moving';
  openingRoll: { white: number | null; black: number | null };
  moveHistory: Array<{ from: number; to: number; dice: number }>;
  selectedPoint: number | null;
}
```

---

## 🎲 Dice.js Library Quirks

- **Cannot reliably force values**: Often returns different values than requested
- **Workaround**: Always use requested values, ignore callback results
- **Warning added**: Logs when mismatch detected but uses correct values
- **Visual only**: Animation is just for show, doesn't affect game logic
- **Don't trust it**: Backend is source of truth for dice values

---

## ⏱️ Timer System

### States:
- Each player has 30 minutes (1800 seconds)
- Timer counts down only during that player's turn
- Opponent timer stops during their turn
- Timeout = opponent wins

### Management (`useGameTimers.ts` - LOCKED):
```typescript
// 3 useEffects:
// 1. Start timer when turn begins (only if at 1800 and not counting)
// 2. Check for timeout (countdown <= 0)
// 3. Stop all timers when game ends (winner !== null)
```

### Integration in page.tsx:
```typescript
// handleDone:
// 1. Stop current player timer
// 2. End turn (switches currentPlayer)
// 3. Start next player timer (after 100ms delay)
```

---

## 🎯 Testing Checklist

When making any changes, test:

1. ✅ Opening roll works (re-roll on tie)
2. ✅ Player can roll dice and move pieces
3. ✅ Roll button disables after rolling
4. ✅ Dice values match between display and game state
5. ✅ AI auto-rolls after player's turn
6. ✅ AI moves pieces with human-like delays
7. ✅ AI clicks Done automatically
8. ✅ Hit logic works (single checker gets sent to bar)
9. ✅ Doubles expand to 4 moves
10. ✅ Timer counts down during active player's turn
11. ✅ Timer switches when clicking Done
12. ✅ Timeout detection works
13. ✅ Game ends when someone wins
14. ✅ Can start new game after winning

---

## 🏁 Final Notes

This project has been through **MONTHS** of pain. The code is stable now. **DO NOT** modify locked files unless absolutely necessary and with explicit permission.

**Good luck! 🍀**

---

**Date Created**: December 2, 2025
**Last Updated**: December 2, 2025 - Session complete
**Status**: ✅ STABLE - All systems working
**Next AI**: Read this file completely before ANY changes!

---

## 📋 Latest Session (Dec 3, 2025) - Bug Fixes

### 🐛 Fixed Issues:

**1. Opening Roll Tie - AI Re-roll** ✅
- **Problem**: When both players rolled same number (tie), AI wouldn't re-roll
- **Root Cause**: `hasRolledRef.current` stayed `true` after tie reset
- **Fix**: Reset flag when both rolls become null
- **File**: `use-ai-opening-roll.ts`
- **Commit**: `11219b0` (frontend)

**2. AI Color Detection After Refresh** ✅
- **Problem**: After refresh, wrong AI color determined (especially when player switched colors)
- **Root Cause**: AI color calculated from player ID instead of database
- **Fix**: Read `aiPlayerColor` directly from `game.gameState`
- **File**: `page.tsx` (lines 378-398)
- **Commit**: `11219b0` (frontend)

**3. AI Resume After Refresh** ✅
- **Problem**: After refresh during AI turn, AI wouldn't continue playing
- **Root Cause**: `makeAIMove` didn't set `turnCompleted = true`
- **Fix**: Set `turnCompleted`, `lastDoneBy`, `lastDoneAt` after AI completes turn
- **File**: `game.service.ts` (lines 790-803)
- **Commit**: `136c056` (backend)

### 🔄 Commits Pushed:
- Frontend: `11219b0` - "Fix: Opening roll tie re-roll and AI color detection from DB"
- Backend: `136c056` - "Fix: Set turnCompleted after AI move for proper refresh handling"

### ⚠️ Status:
- ✅ All fixes deployed
- ✅ Backend restarted
- ⏳ Awaiting user testing

---

## 📝 Previous Session (Dec 2, 2025) - COMPLETE

### ✅ Completed Features:

**1. Game Settings System**:
- 12 settings in database (TIMING, SCORING, RULES, BETS, AI)
- All connected to backend API
- Admin panel UI complete and working
- Settings save/load correctly

**2. Auto Token Refresh**:
- Access token: 4 hours (was 15 min)
- Refresh token: 30 days (was 7 days)
- Auto-refresh every 1 hour in background
- 401 interceptor with auto-retry
- **User never kicked out during gameplay!**

**3. Fixes Applied**:
- Removed all mock data from settings
- Fixed category case-sensitivity (TIMING vs timing)
- Added 12 game settings to seed
- Mock stats endpoints (prevent 404 errors)
- Locked all critical game files with headers

### 🔒 All Game Files Now Locked:
- Main game page
- All 5 game hooks
- Dice roller component  
- Backend game service

---
