import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';

/**
 * Game Gateway - WebSocket Handler
 * Manages real-time game state synchronization
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles real-time communication
 * - Open/Closed: Extensible for new events
 * - Dependency Inversion: Depends on GamesService abstraction
 * 
 * Features:
 * - Room-based game sessions
 * - Real-time move broadcasting
 * - Spectator support
 * - Disconnection handling
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8083',
    credentials: true,
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // Track active connections: gameId -> [socketIds]
  private gameRooms = new Map<string, Set<string>>();
  // Track user connections: socketId -> userId
  private userSockets = new Map<string, string>();

  constructor(private gamesService: GamesService) {}

  /**
   * Handle new connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove from user sockets
    this.userSockets.delete(client.id);

    // Remove from all game rooms
    this.gameRooms.forEach((sockets, gameId) => {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        
        // Notify others in room
        this.server.to(`game_${gameId}`).emit('player_disconnected', {
          socketId: client.id,
          timestamp: new Date().toISOString(),
        });

        // Clean up empty rooms
        if (sockets.size === 0) {
          this.gameRooms.delete(gameId);
        }
      }
    });
  }

  /**
   * Join game room
   * Both players and spectators use this
   */
  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string; isSpectator?: boolean },
  ) {
    const { gameId, userId, isSpectator = false } = data;

    try {
      // Get game details
      const game = await this.gamesService.getGame(gameId);

      // Join Socket.IO room
      await client.join(`game_${gameId}`);

      // Track in our map
      if (!this.gameRooms.has(gameId)) {
        this.gameRooms.set(gameId, new Set());
      }
      this.gameRooms.get(gameId)!.add(client.id);
      this.userSockets.set(client.id, userId);

      this.logger.log(
        `${isSpectator ? 'Spectator' : 'Player'} joined game ${gameId}: ${userId}`,
      );

      // Send game state to joining user
      client.emit('game_state', {
        game,
        timestamp: new Date().toISOString(),
      });

      // Notify others in room
      client.to(`game_${gameId}`).emit('user_joined', {
        userId,
        isSpectator,
        timestamp: new Date().toISOString(),
      });

      return { success: true, game };
    } catch (error) {
      this.logger.error(`Error joining game: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Leave game room
   */
  @SubscribeMessage('leave_game')
  async handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const { gameId } = data;

    await client.leave(`game_${gameId}`);

    // Remove from tracking
    const room = this.gameRooms.get(gameId);
    if (room) {
      room.delete(client.id);
      if (room.size === 0) {
        this.gameRooms.delete(gameId);
      }
    }

    const userId = this.userSockets.get(client.id);

    // Notify others
    this.server.to(`game_${gameId}`).emit('user_left', {
      userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Make move
   * Validates move and broadcasts to all in room
   */
  @SubscribeMessage('make_move')
  async handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      gameId: string;
      move: {
        from: number | 'bar';
        to: number | 'home';
        diceValue: number;
      };
      newGameState: any;
    },
  ) {
    const { gameId, move, newGameState } = data;

    try {
      // TODO: Validate move on server side
      // For now, trust client (we'll add validation later)

      // Update game in database
      await this.gamesService.updateGameState(gameId, newGameState, {
        ...move,
        timestamp: new Date().toISOString(),
        player: newGameState.currentPlayer,
      });

      // Broadcast to everyone in the room (including sender)
      this.server.to(`game_${gameId}`).emit('game_update', {
        gameState: newGameState,
        lastMove: move,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Move made in game ${gameId}: ${JSON.stringify(move)}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error making move: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Roll dice
   * Server generates random dice values for fairness
   */
  @SubscribeMessage('roll_dice')
  async handleRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    const { gameId } = data;

    // Generate random dice values (server-side for security)
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;

    // Broadcast to everyone
    this.server.to(`game_${gameId}`).emit('dice_rolled', {
      diceValues: [dice1, dice2],
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Dice rolled in game ${gameId}: [${dice1}, ${dice2}]`);

    return { success: true, diceValues: [dice1, dice2] };
  }

  /**
   * End turn
   */
  @SubscribeMessage('end_turn')
  async handleEndTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; newGameState: any },
  ) {
    const { gameId, newGameState } = data;

    // Update state
    await this.gamesService.updateGameState(gameId, newGameState, {
      type: 'end_turn',
      timestamp: new Date().toISOString(),
    });

    // Broadcast turn change
    this.server.to(`game_${gameId}`).emit('turn_changed', {
      currentPlayer: newGameState.currentPlayer,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Game over
   */
  @SubscribeMessage('game_over')
  async handleGameOver(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { gameId: string; winner: 'WHITE' | 'BLACK'; reason: string },
  ) {
    const { gameId, winner, reason } = data;

    // End game in database
    await this.gamesService.endGame(gameId, winner, reason);

    // Broadcast game over
    this.server.to(`game_${gameId}`).emit('game_ended', {
      winner,
      reason,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Game ended: ${gameId}, Winner: ${winner}`);

    return { success: true };
  }

  /**
   * Send chat message (optional feature)
   */
  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; message: string; userId: string },
  ) {
    const { gameId, message, userId } = data;

    // Broadcast message to room
    this.server.to(`game_${gameId}`).emit('new_message', {
      userId,
      message,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }
}
