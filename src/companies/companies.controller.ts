import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company } from './entities/company.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { User } from '../auth/entities/user.entity';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the caller's company" })
  @ApiResponse({ status: 200, type: Company })
  getMyCompany(@CurrentUser() user: User): Promise<Company> {
    return this.companiesService.findOne(user.companyId);
  }

  @Put('me')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update the caller's company (Admin only)" })
  @ApiResponse({ status: 200, type: Company })
  updateMyCompany(
    @CurrentUser() user: User,
    @Body() dto: UpdateCompanyDto,
  ): Promise<Company> {
    return this.companiesService.update(user.companyId, dto);
  }
}
