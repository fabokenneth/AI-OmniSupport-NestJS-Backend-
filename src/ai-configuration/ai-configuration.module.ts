import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConfiguration } from './entities/ai-configuration.entity';
import { AiConfigurationService } from './ai-configuration.service';
import { AiConfigurationController } from './ai-configuration.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiConfiguration])],
  controllers: [AiConfigurationController],
  providers: [AiConfigurationService],
  exports: [AiConfigurationService],
})
export class AiConfigurationModule {}
