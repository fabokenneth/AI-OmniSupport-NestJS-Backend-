import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, GeneratedTokens } from './auth.service';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/tokens.dto';
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

  private get cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };
  }

  private setAuthCookies(res: Response, tokens: GeneratedTokens): AuthResponseDto {
    const now = Date.now();
    res.cookie('accessToken', tokens.accessToken, {
      ...this.cookieOptions,
      maxAge: tokens.accessTokenExpiresAt.getTime() - now,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...this.cookieOptions,
      maxAge: tokens.refreshTokenExpiresAt.getTime() - now,
    });
    return {
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    };
  }

  @Post('register-company')
  @ApiOperation({ summary: 'Register a new company and its first admin (public)' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async registerCompany(
    @Body() dto: RegisterCompanyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.registerCompany(dto);
    return this.setAuthCookies(res, tokens);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a Manager or Agent to your company (Admin only)' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.register(dto, user.companyId);
    return this.setAuthCookies(res, tokens);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password (public)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.login(dto);
    return this.setAuthCookies(res, tokens);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    res.clearCookie('accessToken', this.cookieOptions);
    res.clearCookie('refreshToken', this.cookieOptions);
    return this.authService.logout(user.id);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh token pair via httpOnly cookie (public)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refreshTokens(
    @CurrentUser() user: User & { refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.refreshTokens(user.id, user.refreshToken);
    return this.setAuthCookies(res, tokens);
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
