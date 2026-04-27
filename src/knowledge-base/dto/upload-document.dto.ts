import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ description: 'Target company ID (tenant isolation)' })
  @IsUUID()
  companyId: string;
}
