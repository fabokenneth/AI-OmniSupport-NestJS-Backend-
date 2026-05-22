import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfiguration } from './entities/ai-configuration.entity';
import { UpsertAiConfigurationDto } from './dto/upsert-ai-configuration.dto';

@Injectable()
export class AiConfigurationService {
  constructor(
    @InjectRepository(AiConfiguration)
    private readonly aiConfigRepository: Repository<AiConfiguration>,
  ) {}

  async findByCompany(companyId: string): Promise<AiConfiguration> {
    const config = await this.aiConfigRepository.findOne({
      where: { companyId },
    });

    if (!config) {
      throw new NotFoundException('AI configuration not found for this company');
    }

    return config;
  }

  async upsert(
    companyId: string,
    dto: UpsertAiConfigurationDto,
  ): Promise<AiConfiguration> {
    const existing = await this.aiConfigRepository.findOne({
      where: { companyId },
    });

    if (existing) {
      Object.assign(existing, dto);
      return this.aiConfigRepository.save(existing);
    }

    // companyId is injected from the JWT — never from the request body
    const config = this.aiConfigRepository.create({ ...dto, companyId });
    return this.aiConfigRepository.save(config);
  }
}
