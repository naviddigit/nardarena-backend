# AI Player Testing Guide

## Overview
The AI Player Service has been implemented with complete backgammon rules including:
- Move generation with bar priority
- Move validation (blocking, hitting, bearing off)
- 4 difficulty levels (EASY, MEDIUM, HARD, EXPERT)
- Evaluation functions (safety, advancement, blocking, hitting)

## Test Endpoint
**URL**: `POST http://localhost:3002/api/game/ai-move`

**Authentication**: Requires JWT Bearer token (login first to get token)

## Request Format
```json
{
  "points": [
    {"white": 2, "black": 0},  // Point 0
    {"white": 0, "black": 0},  // Point 1
    // ... 24 points total (0-23)
  ],
  "bar": {"white": 0, "black": 0},
  "off": {"white": 0, "black": 0},
  "currentPlayer": "white",
  "diceRoll": [3, 5],
  "difficulty": "MEDIUM"  // EASY, MEDIUM, HARD, or EXPERT
}
```

## Response Format
```json
{
  "moves": [
    {"from": 12, "to": 15},
    {"from": 12, "to": 17}
  ],
  "difficulty": "MEDIUM",
  "diceRoll": [3, 5]
}
```

## Testing with VS Code REST Client

1. Open `test-ai-move.http`
2. Get your JWT token:
   - Login via `/api/auth/login`
   - Copy the `access_token` from response
   - Replace `YOUR_JWT_TOKEN_HERE` in the test file

3. Run any test case:
   - Click "Send Request" above each test
   - Or use keyboard shortcut: `Ctrl+Alt+R`

## Test Cases

### Test 1: Simple Move (MEDIUM difficulty)
- Standard opening position
- Dice: [3, 5]
- Expected: AI should move 2 checkers forward

### Test 2: Bar Re-entry (HARD difficulty)
- 2 white checkers on bar
- Dice: [3, 4]
- Expected: AI should prioritize entering from bar

### Test 3: Bearing Off (EXPERT difficulty)
- All checkers in home board (18-23)
- Dice: [5, 6]
- Expected: AI should bear off 2 checkers

## Difficulty Level Behavior

| Level | Strategy | Selection Method |
|-------|----------|------------------|
| EASY | Random | Picks any valid move |
| MEDIUM | Cautious | Top 50% scored moves (safety 40%, advancement 30%) |
| HARD | Balanced | Top 25% scored moves (safety 30%, advancement 30%) |
| EXPERT | Optimal | Always best move (equal weights 25% each) |

## Evaluation Weights

| Factor | MEDIUM | HARD | EXPERT |
|--------|--------|------|--------|
| Safety | 40% | 30% | 25% |
| Advancement | 30% | 30% | 25% |
| Blocking | 20% | 20% | 25% |
| Hitting | 10% | 20% | 25% |

## Implementation Details

### Move Generation (`generatePossibleMoves`)
1. Check bar first (mandatory moves)
2. Generate move sequences for dice combinations
3. Handle doubles (4 moves instead of 2)
4. Validate each move against game rules

### Move Validation (`isValidMove`)
- Checks if destination is blocked (2+ opponent checkers)
- Validates bearing off eligibility
- Ensures all checkers in home board before bearing off

### Evaluation Functions

**Safety** (`evaluateSafety`):
- Penalizes leaving blots (single checkers)
- Checks if opponent can hit within 6 spaces
- Rewards moving to existing checkers (making points)

**Advancement** (`evaluateAdvancement`):
- Rewards moving checkers forward
- Normalized to distance / 24

**Blocking** (`evaluateBlocking`):
- Rewards creating points (2+ checkers)
- Strategic positions block opponent movement

**Hitting** (`evaluateHitting`):
- Rewards hitting opponent blots
- Sends opponent to bar (must re-enter)

## Files Modified

### Backend
- `src/modules/game/ai/ai-player.service.ts` - Complete AI implementation (420+ lines)
- `src/modules/game/game.controller.ts` - Added `/ai-move` endpoint
- `src/modules/game/game.module.ts` - Registered AIPlayerService
- `src/modules/games/games.module.ts` - Exported AIPlayerService
- `src/modules/game/dto/ai-move.dto.ts` - Request/Response DTOs

## Next Steps

1. **Integration Testing**: Test with real game scenarios
2. **WebSocket Integration**: Add AI moves to game gateway
3. **Game Service Integration**: Auto-play AI turns
4. **Frontend Connection**: Display AI moves with animation
5. **Performance Optimization**: Cache move evaluations
6. **Analytics**: Track AI win rates by difficulty

## Known Limitations

1. No look-ahead (doesn't predict opponent moves)
2. Simplified evaluation (no position-specific strategies)
3. No doubling cube logic
4. No race vs. holding game detection

## Future Improvements

1. **Monte Carlo Tree Search**: Better move evaluation
2. **Opening Book**: Pre-computed optimal opening moves
3. **Endgame Database**: Perfect play in endgames
4. **Learning**: Track successful strategies
5. **Personality**: Different playing styles per difficulty
