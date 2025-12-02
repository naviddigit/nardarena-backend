import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateSettingDto, UpdateMultipleSettingsDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ==========================================
  // PUBLIC GAME SETTINGS (no auth required)
  // ==========================================

  /**
   * Get AI move delay settings (public)
   * GET /settings/game/ai-delays
   */
  @Get('game/ai-delays')
  async getAIMoveDelays() {
    return this.settingsService.getAIMoveDelays();
  }

  /**
   * Get all game settings (public)
   * GET /settings/game
   */
  @Get('game')
  async getAllGameSettings() {
    return this.settingsService.getAllGameSettings();
  }

  // ==========================================
  // PROTECTED GAME SETTINGS (auth required)
  // ==========================================

  /**
   * Get game settings by category
   * GET /settings/game/category/:category
   */
  @Get('game/category/:category')
  @UseGuards(JwtAuthGuard)
  async getGameSettingsByCategory(@Param('category') category: string) {
    return this.settingsService.getGameSettingsByCategory(category);
  }

  /**
   * Get single game setting
   * GET /settings/game/:key
   */
  @Get('game/:key')
  @UseGuards(JwtAuthGuard)
  async getGameSetting(@Param('key') key: string) {
    return this.settingsService.getGameSetting(key);
  }

  /**
   * Update single game setting (admin only)
   * PUT /settings/game/:key
   */
  @Put('game/:key')
  @UseGuards(JwtAuthGuard)
  async updateGameSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto
  ) {
    return this.settingsService.updateGameSetting(key, dto.value);
  }

  /**
   * Update multiple game settings (admin only)
   * PATCH /settings/game/bulk
   */
  @Patch('game/bulk')
  @UseGuards(JwtAuthGuard)
  async updateGameSettingsBulk(
    @Body() dto: { settings: { key: string; value: string }[] }
  ) {
    const results = await Promise.all(
      dto.settings.map((setting) =>
        this.settingsService.updateGameSetting(setting.key, setting.value)
      )
    );
    return results;
  }

  // ==========================================
  // SYSTEM SETTINGS (auth required)
  // ==========================================

  /**
   * Get fee calculation example
   * GET /settings/fee/example
   */
  @Get('fee/example')
  @UseGuards(JwtAuthGuard)
  async getFeeExample() {
    return this.settingsService.getFeeCalculationExample();
  }

  /**
   * Get settings by category
   * GET /settings/category/:category
   */
  @Get('category/:category')
  @UseGuards(JwtAuthGuard)
  async getSettingsByCategory(@Param('category') category: string) {
    return this.settingsService.getSettingsByCategory(category);
  }

  /**
   * Update multiple settings
   * PUT /settings
   */
  @Put()
  @UseGuards(JwtAuthGuard)
  async updateMultipleSettings(@Body() dto: UpdateMultipleSettingsDto) {
    return this.settingsService.updateMultipleSettings(dto.settings);
  }

  /**
   * Get all settings grouped by category
   * GET /settings
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * Get single setting
   * GET /settings/:key
   */
  @Get(':key')
  @UseGuards(JwtAuthGuard)
  async getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * Update single setting
   * PUT /settings/:key
   */
  @Put(':key')
  @UseGuards(JwtAuthGuard)
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto
  ) {
    return this.settingsService.updateSetting(key, dto.value);
  }
}
