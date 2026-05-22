import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Company } from '../../companies/entities/company.entity';
import { Tone } from '../enums/tone.enum';

@Entity('ai_configurations')
export class AiConfiguration {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Unique per tenant — enforced both here and at DB level
  @ApiProperty()
  @Column({ name: 'company_id', unique: true })
  companyId: string;

  @OneToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ example: 'Assistant' })
  @Column({ name: 'bot_name', default: 'Assistant' })
  botName: string;

  @ApiProperty({ enum: Tone, example: Tone.PROFESSIONAL })
  @Column({ type: 'enum', enum: Tone, default: Tone.PROFESSIONAL })
  tone: Tone;

  @ApiPropertyOptional()
  @Column({ type: 'text', name: 'instructions', nullable: true })
  instructions: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
