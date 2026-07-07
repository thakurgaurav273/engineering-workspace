import { IsObject, IsString } from 'class-validator';

export class InstallationTargetDto {
  @IsString()
  orgId!: string;

  @IsString()
  application!: string;
}

export class ConfigurationDto extends InstallationTargetDto {
  @IsObject()
  config!: Record<string, unknown>;
}
