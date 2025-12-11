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
import { LoginHistoryService } from './login-history.service';
import { getDeviceInfo, getLocationFromIp } from '../../utils/device-detector.util';
import { EmailService } from '../email/email.service';

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
    private loginHistoryService: LoginHistoryService,
    private emailService: EmailService,
  ) {}

  /**
   * Register new user
   * Validates uniqueness of email and username
   * Captures device info and location at registration
   */
  async register(registerDto: RegisterDto, req?: any): Promise<AuthResponse> {
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

    // Extract device and location info from request
    let registrationData: {
      registrationIp?: string;
      registrationCountry?: string;
      registrationDevice?: string;
      registrationOs?: string;
      registrationBrowser?: string;
    } = {};
    if (req) {
      const deviceInfo = getDeviceInfo(req);
      const locationInfo = await getLocationFromIp(deviceInfo.ip);

      registrationData = {
        registrationIp: deviceInfo.ip,
        registrationCountry: country || locationInfo.country || undefined,
        registrationDevice: deviceInfo.device,
        registrationOs: deviceInfo.os,
        registrationBrowser: deviceInfo.browser,
      };
    }

    // Create user with stats
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        displayName: displayName || username,
        passwordHash,
        avatar: avatar || null,
        country: country || registrationData.registrationCountry || null,
        emailVerified: false, // TODO: Implement email verification
        ...registrationData,
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

    this.logger.log(`New user registered: ${user.email} from ${registrationData.registrationCountry || 'unknown'}`);

    // Log successful registration as login
    if (req) {
      await this.loginHistoryService.logSuccessfulLogin(user.id, req);
    }

    // Generate tokens
    return this.generateAuthResponse(user);
  }

  /**
   * Login user
   * Tracks failed login attempts and locks account after 5 failures
   * Logs login history with device and location info
   */
  async login(loginDto: LoginDto, req?: any): Promise<AuthResponse> {
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
    console.log('🔐 Password verification:');
    console.log('  - Email:', email);
    console.log('  - Input password:', password);
    console.log('  - Stored hash:', user.passwordHash?.substring(0, 20) + '...');
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log('  - Valid:', isPasswordValid);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      
      // Log failed login attempt
      if (req) {
        await this.loginHistoryService.logFailedLogin(user.id, req, 'Invalid password');
      }
      
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.resetFailedLoginAttempts(user.id);

    // Log successful login
    if (req) {
      await this.loginHistoryService.logSuccessfulLogin(user.id, req);
    }

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

  /**
   * Google OAuth Login
   * Creates user if doesn't exist, or links to existing email
   */
  async googleLogin(googleUser: any, req?: any): Promise<AuthResponse> {
    const { email, firstName, lastName, picture } = googleUser.user || googleUser;
    const googleId = (googleUser.user || googleUser).id;

    if (!email) {
      throw new BadRequestException('No email provided by Google');
    }

    // Capture device info
    const deviceInfo = req ? getDeviceInfo(req) : null;
    const locationInfo = deviceInfo ? await getLocationFromIp(deviceInfo.ip) : null;

    // Check if user exists by email or googleId
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { googleId },
        ],
      },
    });

    // If user doesn't exist, create one
    if (!user) {
      // Generate username from email
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;
      let counter = 1;

      // Ensure unique username
      while (await this.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      const displayName = firstName && lastName 
        ? `${firstName} ${lastName}` 
        : firstName || username;

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          displayName,
          avatar: picture,
          googleId,
          passwordHash: null, // No password for OAuth users
          country: locationInfo?.country || null,
          registrationIp: deviceInfo?.ip || null,
          registrationCountry: locationInfo?.country || null,
          registrationDevice: deviceInfo?.device || null,
          registrationOs: deviceInfo?.os || null,
          registrationBrowser: deviceInfo?.browser || null,
          emailVerified: true, // Google verified
        },
      });

      this.logger.log(`New user created via Google OAuth: ${email}`);
    } else {
      // Update user with Google ID if not set
      if (!user.googleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      // Update last login and avatar
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          avatar: picture || user.avatar, // Update avatar if changed
        },
      });

      this.logger.log(`User logged in via Google OAuth: ${email}`);
    }

    // Log successful login
    if (req) {
      await this.loginHistoryService.logSuccessfulLogin(user.id, req);
    }

    return this.generateAuthResponse(user);
  }

  /**
   * Send email verification code
   * Generates 6-digit code, saves to DB, sends via email
   * Rate limited to prevent abuse
   */
  async sendVerificationCode(email: string, req?: any): Promise<{ message: string }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Rate limiting: Check if code was sent recently (wait 1 minute)
    if (user.emailVerificationExpires && user.emailVerificationExpires > new Date()) {
      const remainingSeconds = Math.ceil(
        (user.emailVerificationExpires.getTime() - Date.now()) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${remainingSeconds} seconds before requesting a new code`,
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save code with 15 minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expiresAt,
      },
    });

    // Extract IP for logging
    let ipAddress = 'unknown';
    if (req) {
      const deviceInfo = getDeviceInfo(req);
      ipAddress = deviceInfo.ip;
    }

    // Log verification attempt
    await this.prisma.emailVerificationLog.create({
      data: {
        userId: user.id,
        email: user.email,
        code,
        ipAddress,
        success: false,
      },
    });

    // Send email
    const emailSent = await this.emailService.sendVerificationCode(
      user.email,
      code,
      user.displayName || user.username,
    );

    if (!emailSent) {
      this.logger.warn(`Failed to send verification email to ${user.email}`);
    }

    this.logger.log(`Verification code sent to ${user.email}`);

    return {
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Verify email with code
   * Checks code validity and expiration
   */
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (!user.emailVerificationCode) {
      throw new BadRequestException('No verification code found. Please request a new one');
    }

    // Check expiration
    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification code expired. Please request a new one');
    }

    // Check code match
    if (user.emailVerificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    // Mark email as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });

    // Update verification log
    await this.prisma.emailVerificationLog.updateMany({
      where: {
        userId: user.id,
        code,
        success: false,
      },
      data: {
        success: true,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(`Email verified for user: ${user.email}`);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.displayName || user.username,
    );

    return {
      message: 'Email verified successfully',
    };
  }
}
