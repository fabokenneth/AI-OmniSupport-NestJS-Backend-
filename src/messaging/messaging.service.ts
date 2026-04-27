import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Conversation } from './entities/conversation.entity';
import { SendMessageDto } from './dto/send-message.dto';

export interface MessageResponse {
  conversationId: string;
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  async sendMessage(
    companyId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponse> {
    let conversation = await this.conversationRepository.findOne({
      where: { sessionId: dto.sessionId, companyId },
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        companyId,
        channel: dto.channel,
        sessionId: dto.sessionId,
        messages: [],
      });
    }

    const now = new Date().toISOString();

    const userMessage = {
      id: randomUUID(),
      role: 'user',
      content: dto.content,
      timestamp: now,
    };

    // TODO: wire up LangChain RAG pipeline — query pgvector, build context, call LLM
    const assistantReply = 'RAG pipeline not yet implemented.';

    const assistantMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: assistantReply,
      timestamp: now,
    };

    conversation.messages = [
      ...conversation.messages,
      userMessage,
      assistantMessage,
    ];

    const saved = await this.conversationRepository.save(conversation);

    return {
      conversationId: saved.id,
      sessionId: dto.sessionId,
      userMessage: dto.content,
      assistantMessage: assistantReply,
    };
  }

  async getConversation(
    sessionId: string,
    companyId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { sessionId, companyId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with session "${sessionId}" not found`);
    }

    return conversation;
  }

  async listConversations(companyId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }
}
