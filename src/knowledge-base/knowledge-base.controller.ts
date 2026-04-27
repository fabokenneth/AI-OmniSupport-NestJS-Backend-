import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { Document } from './entities/document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@ApiTags('Knowledge Base')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post('documents')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a PDF or Markdown document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        companyId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'companyId'],
    },
  })
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Document> {
    return this.knowledgeBaseService.uploadDocument(dto, file);
  }

  @Get('documents')
  @ApiOperation({ summary: "List documents for the caller's company" })
  findAll(@CurrentUser() user: User): Promise<Document[]> {
    return this.knowledgeBaseService.findAllByCompany(user.companyId);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get a document by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<Document> {
    return this.knowledgeBaseService.findOne(id, user.companyId);
  }

  @Delete('documents/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.knowledgeBaseService.remove(id, user.companyId);
  }
}
