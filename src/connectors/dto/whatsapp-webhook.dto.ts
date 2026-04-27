import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class WhatsAppWebhookDto {
  @ApiProperty({ example: 'whatsapp_business_account' })
  @IsString()
  object: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  entry: Record<string, unknown>[];
}
