import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class UpdateMultipleSettingsDto {
  @IsArray()
  @IsNotEmpty()
  settings: UpdateSettingDto[];
}
