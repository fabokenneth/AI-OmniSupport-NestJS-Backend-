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
import { DocumentStatus } from '../enums/document-status.enum';
import { Company } from '../../companies/entities/company.entity';

@Entity('documents')
export class Document {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty()
  @Column({ name: 'file_name' })
  fileName: string;

  @ApiProperty()
  @Column({ name: 'original_name' })
  originalName: string;

  @ApiProperty()
  @Column({ name: 'mime_type' })
  mimeType: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 's3_key', nullable: true, type: 'text' })
  s3Key: string | null;

  @ApiProperty({ enum: DocumentStatus })
  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @ApiProperty()
  @Column({ type: 'bigint', default: 0 })
  size: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
