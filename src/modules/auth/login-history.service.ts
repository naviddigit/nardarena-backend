import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getDeviceInfo, getLocationFromIp } from '../../utils/device-detector.util';

export interface LoginLogData {
  userId: string;
  ipAddress: string;
  country?: string | null;
  city?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  success: boolean;
  failReason?: string | null;
}

@Injectable()
export class LoginHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log a login attempt (success or failure)
   */
  async logLogin(data: LoginLogData) {
    try {
      return await this.prisma.loginHistory.create({
        data: {
          userId: data.userId,
          ipAddress: data.ipAddress,
          country: data.country,
          city: data.city,
          device: data.device,
          os: data.os,
          browser: data.browser,
          success: data.success,
          failReason: data.failReason,
        },
      });
    } catch (error) {
      console.error('Failed to log login history:', error);
      // Don't throw - login should work even if logging fails
      return null;
    }
  }

  /**
   * Log successful login from request
   */
  async logSuccessfulLogin(userId: string, req: any) {
    const deviceInfo = getDeviceInfo(req);
    const locationInfo = await getLocationFromIp(deviceInfo.ip);

    return this.logLogin({
      userId,
      ipAddress: deviceInfo.ip,
      country: locationInfo.country,
      city: locationInfo.city,
      device: deviceInfo.device,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      success: true,
    });
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(userId: string, req: any, reason: string) {
    const deviceInfo = getDeviceInfo(req);
    const locationInfo = await getLocationFromIp(deviceInfo.ip);

    return this.logLogin({
      userId,
      ipAddress: deviceInfo.ip,
      country: locationInfo.country,
      city: locationInfo.city,
      device: deviceInfo.device,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      success: false,
      failReason: reason,
    });
  }

  /**
   * Get user's login history
   */
  async getUserLoginHistory(userId: string, limit = 50) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent logins from a specific IP
   */
  async getLoginsByIp(ipAddress: string, limit = 50) {
    return this.prisma.loginHistory.findMany({
      where: { ipAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get suspicious login activity
   * (e.g., multiple failed attempts, logins from new countries)
   */
  async getSuspiciousActivity(userId: string, hoursBack = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const recentLogins = await this.prisma.loginHistory.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    const failedLogins = recentLogins.filter((login) => !login.success);
    const uniqueCountries = new Set(recentLogins.map((login) => login.country).filter(Boolean));
    const uniqueIps = new Set(recentLogins.map((login) => login.ipAddress));

    return {
      totalLogins: recentLogins.length,
      failedLogins: failedLogins.length,
      uniqueCountries: uniqueCountries.size,
      uniqueIps: uniqueIps.size,
      countries: Array.from(uniqueCountries),
      ips: Array.from(uniqueIps),
      recentFailed: failedLogins.slice(0, 5),
    };
  }
}
