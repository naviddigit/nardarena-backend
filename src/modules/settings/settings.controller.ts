import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateSettingDto, UpdateMultipleSettingsDto } from './dto/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get all settings grouped by category
   * GET /settings
   */
  @Get()
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * Get settings by category
   * GET /settings/category/:category
   */
  @Get('category/:category')
  async getSettingsByCategory(@Param('category') category: string) {
    return this.settingsService.getSettingsByCategory(category);
  }

  /**
   * Get single setting
   * GET /settings/:key
   */
  @Get(':key')
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * Get fee calculation example
   * GET /settings/fee/example
   */
  @Get('fee/example')
  async getFeeExample() {
    return this.settingsService.getFeeCalculationExample();
  }

  /**
   * Update single setting
   * PUT /settings/:key
   */
  @Put(':key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto
  ) {
    return this.settingsService.updateSetting(key, dto.value);
  }

  /**
   * Update multiple settings
   * PUT /settings
   */
  @Put()
  async updateMultipleSettings(@Body() dto: UpdateMultipleSettingsDto) {
    return this.settingsService.updateMultipleSettings(dto.settings);
  }
}
