import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { RegisterDto } from './dto/register.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedvalue'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUserFactory = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'test@company.com',
    password: '$2b$10$hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.AGENT,
    companyId: 'company-uuid-1',
    company: {} as never,
    refreshToken: '$2b$10$hashedrefreshtoken',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as User);

type MockRepo = { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
const createMockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const createMockDataSource = () => ({ transaction: jest.fn() });

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: MockRepo;
  let jwtService: jest.Mocked<JwtService>;
  let dataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: createMockRepo() },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const cfg: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return cfg[key] ?? defaultVal;
            }),
          },
        },
        { provide: getDataSourceToken(), useValue: createMockDataSource() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    dataSource = module.get(getDataSourceToken());
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => expect(service).toBeDefined());

  // -------------------------------------------------------------------------
  // registerCompany()
  // -------------------------------------------------------------------------

  describe('registerCompany()', () => {
    const dto: RegisterCompanyDto = {
      companyName: 'Acme Corp',
      email: 'admin@acme.com',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Admin',
    };

    const savedCompany = { id: 'company-uuid-1', name: dto.companyName };
    const savedAdmin = mockUserFactory({ role: UserRole.ADMIN, companyId: savedCompany.id });

    const setupTransactionMock = () => {
      (dataSource.transaction as jest.Mock).mockImplementation(async (fn: (m: any) => any) => {
        const manager = {
          create: jest.fn()
            .mockReturnValueOnce(savedCompany)
            .mockReturnValueOnce(savedAdmin),
          save: jest.fn()
            .mockResolvedValueOnce(savedCompany)
            .mockResolvedValueOnce(savedAdmin),
        };
        return fn(manager);
      });
    };

    it('creates company and admin in a transaction, returns JWT pair', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      setupTransactionMock();
      (userRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.registerCompany(dto);

      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('throws ConflictException when email is already registered', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());

      await expect(service.registerCompany(dto)).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------

  describe('register()', () => {
    const dto: RegisterDto = {
      email: 'agent@acme.com',
      password: 'password123',
      firstName: 'Bob',
      lastName: 'Agent',
      role: UserRole.AGENT,
    };
    const companyId = 'company-uuid-1';

    it('creates user under the given companyId and returns a JWT pair', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      const created = mockUserFactory({ email: dto.email, companyId });
      (userRepo.create as jest.Mock).mockReturnValue(created);
      (userRepo.save as jest.Mock).mockResolvedValue(created);
      (userRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register(dto, companyId);

      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      });
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId }),
      );
    });

    it('throws ConflictException when email is already registered', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());

      await expect(service.register(dto, companyId)).rejects.toThrow(ConflictException);
      expect(userRepo.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  describe('login()', () => {
    const dto: LoginDto = { email: 'test@company.com', password: 'correct-pass' };

    it('returns a JWT pair when credentials are valid', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (userRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(dto);

      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      });
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------

  describe('logout()', () => {
    it('nullifies the refresh token in the database', async () => {
      (userRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      await service.logout('user-uuid-1');
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid-1', { refreshToken: null });
    });
  });

  // -------------------------------------------------------------------------
  // refreshTokens()
  // -------------------------------------------------------------------------

  describe('refreshTokens()', () => {
    it('issues a new token pair when refresh token matches the stored hash', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (userRepo.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens('user-uuid-1', 'valid-token');

      expect(result).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      });
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.refreshTokens('user-uuid-1', 'any')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no refresh token is stored', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory({ refreshToken: null }));
      await expect(service.refreshTokens('user-uuid-1', 'any')).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when token does not match stored hash', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUserFactory());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.refreshTokens('user-uuid-1', 'tampered')).rejects.toThrow(UnauthorizedException);
    });
  });
});
