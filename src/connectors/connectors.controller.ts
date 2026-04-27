import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConnectorsService } from './connectors.service';
import { WhatsAppWebhookDto } from './dto/whatsapp-webhook.dto';

@ApiTags('Connectors')
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Post('webhooks/whatsapp')
  @ApiOperation({ summary: 'Receive incoming events from WhatsApp Cloud API' })
  @ApiHeader({
    name: 'x-hub-signature-256',
    description: 'HMAC-SHA256 signature provided by Meta',
    required: false,
  })
  handleWhatsAppWebhook(
    @Body() payload: WhatsAppWebhookDto,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ received: boolean }> {
    return this.connectorsService.handleWhatsAppWebhook(payload, signature);
  }
}
