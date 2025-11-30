import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all system settings
   */
  async getAllSettings() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group by category
    const grouped = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push({
        key: setting.key,
        value: setting.value,
        description: setting.description,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(category: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      description: s.description,
    }));
  }

  /**
   * Get single setting
   */
  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    return setting
      ? {
          key: setting.key,
          value: setting.value,
          description: setting.description,
          category: setting.category,
        }
      : null;
  }

  /**
   * Update setting
   */
  async updateSetting(key: string, value: string) {
    const updated = await this.prisma.systemSetting.update({
      where: { key },
      data: { value },
    });

    return {
      key: updated.key,
      value: updated.value,
      description: updated.description,
      category: updated.category,
    };
  }

  /**
   * Update multiple settings
   */
  async updateMultipleSettings(updates: { key: string; value: string }[]) {
    const results = await Promise.all(
      updates.map((update) =>
        this.prisma.systemSetting.update({
          where: { key: update.key },
          data: { value: update.value },
        })
      )
    );

    return results.map((r) => ({
      key: r.key,
      value: r.value,
    }));
  }

  /**
   * Get calculated fee example (read-only helper)
   */
  async getFeeCalculationExample() {
    const trc20Fee = parseFloat(
      (await this.getSetting('trc20_network_fee_usd'))?.value || '1.00'
    );
    const bscFee = parseFloat(
      (await this.getSetting('bsc_network_fee_usd'))?.value || '1.00'
    );
    const feePercent = parseFloat(
      (await this.getSetting('withdraw_fee_percent'))?.value || '0.5'
    );

    const trc20Service = trc20Fee * (feePercent / 100);
    const trc20Total = trc20Fee + trc20Service;

    const bscService = bscFee * (feePercent / 100);
    const bscTotal = bscFee + bscService;

    return {
      trc20: {
        networkFee: trc20Fee.toFixed(2),
        serviceFee: trc20Service.toFixed(3),
        totalFee: trc20Total.toFixed(3),
        example: `TRC20: $${trc20Fee.toFixed(2)} + ${feePercent}% ($${trc20Service.toFixed(3)}) = $${trc20Total.toFixed(3)} total`,
      },
      bsc: {
        networkFee: bscFee.toFixed(2),
        serviceFee: bscService.toFixed(3),
        totalFee: bscTotal.toFixed(3),
        example: `BSC: $${bscFee.toFixed(2)} + ${feePercent}% ($${bscService.toFixed(3)}) = $${bscTotal.toFixed(3)} total`,
      },
      note: `${feePercent}% service fee is calculated on the network fee`,
    };
  }
}
