import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MessagingService, MessageResponse } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { Conversation } from './entities/conversation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Messaging')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send a message and receive an AI response' })
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ): Promise<MessageResponse> {
    return this.messagingService.sendMessage(user.companyId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: "List conversations for the caller's company" })
  @ApiResponse({ status: 200, type: [Conversation] })
  listConversations(@CurrentUser() user: User): Promise<Conversation[]> {
    return this.messagingService.listConversations(user.companyId);
  }

  @Get('conversations/:sessionId')
  @ApiOperation({ summary: 'Get a conversation by session ID' })
  @ApiResponse({ status: 200, type: Conversation })
  getConversation(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
  ): Promise<Conversation> {
    return this.messagingService.getConversation(sessionId, user.companyId);
  }
}
