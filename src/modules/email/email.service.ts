import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('⚠️  RESEND_API_KEY not configured - Email service disabled');
      return;
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'Nard Arena <noreply@mail.nardarena.com>');
    this.logger.log('✅ Email service initialized');
  }

  /**
   * Send email verification code
   */
  async sendVerificationCode(email: string, code: string, username: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`Email service not configured - skipping verification email to ${email}`);
      return false;
    }

    try {
      this.logger.log(`📧 Sending verification code to ${email}`);

      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Email - Nard Arena',
        html: this.getVerificationTemplate(code, username),
      });

      this.logger.log(`✅ Verification email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send verification email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetToken: string, username: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`Email service not configured - skipping password reset email to ${email}`);
      return false;
    }

    try {
      const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${resetToken}`;

      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Reset Your Password - Nard Arena',
        html: this.getPasswordResetTemplate(resetUrl, username),
      });

      this.logger.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send password reset email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    if (!this.resend) {
      return false;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to Nard Arena! 🎲',
        html: this.getWelcomeTemplate(username),
      });

      this.logger.log(`✅ Welcome email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send welcome email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Email verification template
   */
  private getVerificationTemplate(code: string, username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">🎲 Nard Arena</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Verify Your Email</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hi <strong>${username}</strong>,
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Thank you for signing up! Please use the verification code below to verify your email address:
                    </p>
                    
                    <!-- Verification Code -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: inline-block; padding: 20px 40px; border-radius: 8px;">
                            <span style="color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                      ⏰ This code expires in 15 minutes
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
                    
                    <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 0;">
                      If you didn't create an account with Nard Arena, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0 0 10px 0;">
                      © 2025 Nard Arena. All rights reserved.
                    </p>
                    <a href="${this.configService.get('FRONTEND_URL')}" style="color: #667eea; text-decoration: none; font-size: 12px;">
                      Visit Website →
                    </a>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Password reset template
   */
  private getPasswordResetTemplate(resetUrl: string, username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">🔒 Reset Password</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hi <strong>${username}</strong>,
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We received a request to reset your password. Click the button below to create a new password:
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 20px 0 0 0;">
                      Or copy and paste this link into your browser:<br>
                      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
                    
                    <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 0;">
                      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      © 2025 Nard Arena. All rights reserved.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Welcome email template
   */
  private getWelcomeTemplate(username: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">🎉 Welcome to Nard Arena!</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Welcome, ${username}! 🎲</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Thank you for joining Nard Arena - the ultimate online backgammon experience!
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Your account has been successfully created and verified. You're now ready to:
                    </p>
                    
                    <ul style="color: #666666; font-size: 15px; line-height: 1.8; margin: 0 0 30px 20px;">
                      <li>🎮 Play against AI or real players</li>
                      <li>💰 Compete in tournaments and win prizes</li>
                      <li>📊 Track your stats and rankings</li>
                      <li>👥 Connect with players worldwide</li>
                    </ul>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${this.configService.get('FRONTEND_URL')}/dashboard" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                            Start Playing Now
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
                    
                    <p style="color: #999999; font-size: 13px; line-height: 1.6; margin: 0;">
                      Need help? Visit our <a href="${this.configService.get('FRONTEND_URL')}/support" style="color: #667eea;">support page</a> or contact us anytime.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      © 2025 Nard Arena. All rights reserved.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
