import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Tone } from '../enums/tone.enum';

export class UpsertAiConfigurationDto {
  @ApiPropertyOptional({ example: 'Assistant', maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  botName?: string;

  @ApiProperty({ enum: Tone, example: Tone.PROFESSIONAL })
  @IsEnum(Tone)
  tone: Tone;

  @ApiPropertyOptional({
    example: 'Always respond politely. Never discuss competitors. Stay on topic.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;
}
