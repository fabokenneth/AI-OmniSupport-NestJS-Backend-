import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Channel } from '../enums/channel.enum';

export class SendMessageDto {
  @ApiProperty({ example: 'How do I reset my password?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: Channel, default: Channel.WEB })
  @IsEnum(Channel)
  channel: Channel;

  @ApiProperty({
    example: 'session-abc-123',
    description: 'Unique session ID for conversation continuity',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
