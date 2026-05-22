import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { AiConfigurationService } from './ai-configuration.service';
import { UpsertAiConfigurationDto } from './dto/upsert-ai-configuration.dto';
import { AiConfiguration } from './entities/ai-configuration.entity';

@ApiTags('ai-configuration')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('ai-config')
export class AiConfigurationController {
  constructor(private readonly aiConfigService: AiConfigurationService) {}

  @Get()
  @ApiOperation({ summary: "Fetch the current company's AI configuration" })
  @ApiResponse({ status: 200, type: AiConfiguration })
  @ApiResponse({ status: 404, description: 'No configuration found yet' })
  findOne(@CurrentUser() user: User): Promise<AiConfiguration> {
    return this.aiConfigService.findByCompany(user.companyId);
  }

  // PUT handles both create and overwrite — companyId comes from the JWT, never the body
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create or overwrite the current company's AI configuration" })
  @ApiResponse({ status: 200, type: AiConfiguration })
  upsert(
    @CurrentUser() user: User,
    @Body() dto: UpsertAiConfigurationDto,
  ): Promise<AiConfiguration> {
    return this.aiConfigService.upsert(user.companyId, dto);
  }
}
