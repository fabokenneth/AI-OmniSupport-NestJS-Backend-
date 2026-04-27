import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppWebhookDto } from './dto/whatsapp-webhook.dto';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  async handleWhatsAppWebhook(
    payload: WhatsAppWebhookDto,
    signature: string,
  ): Promise<{ received: boolean }> {
    // TODO: validate HMAC-SHA256 signature against WHATSAPP_WEBHOOK_SECRET
    // TODO: parse payload.entry, extract messages, route to MessagingService
    this.logger.log(
      `WhatsApp webhook received — object: ${payload.object}, signature: ${signature ?? 'none'}`,
    );
    return { received: true };
  }
}
