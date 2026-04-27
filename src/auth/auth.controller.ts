import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokensDto } from './dto/tokens.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from './enums/user-role.enum';
import { User } from './entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-company')
  @ApiOperation({ summary: 'Register a new company and its first admin (public)' })
  @ApiResponse({ status: 201, type: TokensDto })
  registerCompany(@Body() dto: RegisterCompanyDto): Promise<TokensDto> {
    return this.authService.registerCompany(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a Manager or Agent to your company (Admin only)' })
  @ApiResponse({ status: 201, type: TokensDto })
  register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: User,
  ): Promise<TokensDto> {
    return this.authService.register(dto, user.companyId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password (public)' })
  @ApiResponse({ status: 200, type: TokensDto })
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.authService.login(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(@CurrentUser() user: User): Promise<void> {
    return this.authService.logout(user.id);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token (public)' })
  @ApiResponse({ status: 200, type: TokensDto })
  refreshTokens(
    @CurrentUser() user: User & { refreshToken: string },
  ): Promise<TokensDto> {
    return this.authService.refreshTokens(user.id, user.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, type: User })
  getMe(@CurrentUser() user: User): User {
    return user;
  }
}
