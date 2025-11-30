import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, JwtPayload } from './interfaces/auth.interface';

/**
 * Authentication Service
 * Handles user registration, login, and token management
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles authentication logic
 * - Open/Closed: Extensible for new auth methods (OAuth, etc.)
 * - Dependency Inversion: Depends on PrismaService abstraction
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds = 12;
  private readonly maxFailedAttempts = 5;
  private readonly lockDurationMinutes = 15;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register new user
   * Validates uniqueness of email and username
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, username, password, displayName, avatar, country } = registerDto;

    // Check if email exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if username exists (case-insensitive)
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user with stats
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        displayName: displayName || username,
        passwordHash,
        avatar: avatar || null,
        country: country || null,
        emailVerified: false, // TODO: Implement email verification
        stats: {
          create: {
            balance: 0,
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        country: true,
        role: true,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    // Generate tokens
    return this.generateAuthResponse(user);
  }

  /**
   * Login user
   * Tracks failed login attempts and locks account after 5 failures
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${remainingMinutes} minutes`,
      );
    }

    // Check if account is banned
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Account has been banned');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.resetFailedLoginAttempts(user.id);

    this.logger.log(`User logged in: ${user.email}`);

    // Generate tokens
    return this.generateAuthResponse({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  }

  /**
   * Handle failed login attempt
   * Lock account after 5 failed attempts
   */
  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });

    const newAttempts = (user?.failedLoginAttempts || 0) + 1;
    const shouldLock = newAttempts >= this.maxFailedAttempts;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newAttempts,
        lastFailedLoginAt: new Date(),
        ...(shouldLock && {
          lockedUntil: new Date(
            Date.now() + this.lockDurationMinutes * 60 * 1000,
          ),
        }),
      },
    });

    if (shouldLock) {
      this.logger.warn(`Account locked due to failed attempts: ${userId}`);
    }
  }

  /**
   * Reset failed login attempts
   */
  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Generate JWT tokens and auth response
   */
  private generateAuthResponse(user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role?: string;
  }): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (longer expiry)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  /**
   * Validate user by JWT payload
   */
  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        status: true,
        role: true,
      },
    });

    if (!user || user.status === 'BANNED') {
      throw new UnauthorizedException('User not found or banned');
    }

    return user;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.validateUser(payload);

      return this.generateAuthResponse(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
