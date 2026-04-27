import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Channel } from '../enums/channel.enum';
import { Company } from '../../companies/entities/company.entity';

@Entity('conversations')
export class Conversation {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ enum: Channel })
  @Column({ type: 'enum', enum: Channel, default: Channel.WEB })
  channel: Channel;

  @ApiProperty()
  @Column({ name: 'session_id', unique: true })
  sessionId: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @Column({ type: 'jsonb', default: [] })
  messages: Record<string, unknown>[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
