import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentStatus } from './enums/document-status.enum';

const ALLOWED_MIME_TYPES = ['application/pdf', 'text/markdown', 'text/plain'];

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async uploadDocument(
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const document = this.documentRepository.create({
      companyId: dto.companyId,
      fileName: file.filename ?? file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      status: DocumentStatus.PENDING,
      s3Key: null, // TODO: upload to S3 and persist the key
    });

    return this.documentRepository.save(document);
  }

  async findAllByCompany(companyId: string): Promise<Document[]> {
    return this.documentRepository.find({ where: { companyId } });
  }

  async findOne(id: string, companyId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id, companyId },
    });

    if (!document) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    return document;
  }

  async remove(id: string, companyId: string): Promise<void> {
    const document = await this.findOne(id, companyId);
    await this.documentRepository.remove(document);
  }
}
