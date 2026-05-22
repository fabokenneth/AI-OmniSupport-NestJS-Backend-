import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { Company } from '../companies/entities/company.entity';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async registerCompany(dto: RegisterCompanyDto): Promise<GeneratedTokens> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const savedUser = await this.dataSource.transaction(async (manager) => {
      const company = manager.create(Company, {
        name: dto.companyName,
      });
      const savedCompany = await manager.save(Company, company);

      const user = manager.create(User, {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.ADMIN,
        companyId: savedCompany.id,
      });
      return manager.save(User, user);
    });

    return this.generateAndStoreTokens(savedUser);
  }

  async register(dto: RegisterDto, companyId: string): Promise<GeneratedTokens> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      companyId,
    });
    const saved = await this.userRepository.save(user);

    return this.generateAndStoreTokens(saved);
  }

  async login(dto: LoginDto): Promise<GeneratedTokens> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email, isActive: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAndStoreTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { refreshToken: null });
  }

  async refreshTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<GeneratedTokens> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(
      incomingRefreshToken,
      user.refreshToken,
    );

    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    return this.generateAndStoreTokens(user);
  }

  private parseTtlMs(ttl: string): number {
    const value = parseInt(ttl, 10);
    if (ttl.endsWith('d')) return value * 24 * 60 * 60 * 1000;
    if (ttl.endsWith('h')) return value * 60 * 60 * 1000;
    if (ttl.endsWith('m')) return value * 60 * 1000;
    return value * 1000;
  }

  private async generateAndStoreTokens(user: User): Promise<GeneratedTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessTtl = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshTtl = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(user.id, { refreshToken: hashedRefreshToken });

    const now = Date.now();
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(now + this.parseTtlMs(accessTtl)),
      refreshTokenExpiresAt: new Date(now + this.parseTtlMs(refreshTtl)),
    };
  }
}
