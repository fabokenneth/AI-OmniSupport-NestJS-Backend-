import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AiConfigurationController } from '../src/ai-configuration/ai-configuration.controller';
import { AiConfigurationService } from '../src/ai-configuration/ai-configuration.service';
import { AiConfiguration } from '../src/ai-configuration/entities/ai-configuration.entity';
import { Tone } from '../src/ai-configuration/enums/tone.enum';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { User } from '../src/auth/entities/user.entity';
import { UserRole } from '../src/auth/enums/user-role.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

// ---------------------------------------------------------------------------
// Shared mocks (reset in beforeEach)
// ---------------------------------------------------------------------------

const mockAiConfigRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

// JwtStrategy needs a User repository to validate the token owner
const mockUserRepo = { findOne: jest.fn() };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AiConfiguration (e2e)', () => {
  let app: INestApplication;
  let mockUser: User;
  let accessToken: string;

  const mockConfig: Partial<AiConfiguration> = {
    id: 'config-uuid-e2e',
    companyId: 'company-uuid-e2e',
    botName: 'Assistant',
    tone: Tone.PROFESSIONAL,
    instructions: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeAll(async () => {
    mockUser = {
      id: 'user-uuid-e2e',
      email: 'e2e@company.com',
      password: 'hashed',
      firstName: 'E2E',
      lastName: 'User',
      role: UserRole.ADMIN,
      companyId: 'company-uuid-e2e',
      company: {} as never,
      refreshToken: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: 'e2e-access-secret' })],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AiConfigurationController],
      providers: [
        AiConfigurationService,
        JwtStrategy,
        { provide: getRepositoryToken(AiConfiguration), useValue: mockAiConfigRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformResponseInterceptor(),
    );
    await app.init();

    // Sign a real JWT directly — no auth endpoint needed in this test module
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    accessToken = await jwtService.signAsync(
      { sub: mockUser.id, email: mockUser.email, role: mockUser.role, companyId: mockUser.companyId },
      { secret: 'e2e-access-secret', expiresIn: '15m' },
    );
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    // JwtStrategy validates the token owner on every authenticated request
    mockUserRepo.findOne.mockResolvedValue(mockUser);
  });

  // -------------------------------------------------------------------------
  // GET /api/ai-config
  // -------------------------------------------------------------------------

  describe('GET /api/ai-config', () => {
    it('200 — returns config for the authenticated company', async () => {
      mockAiConfigRepo.findOne.mockResolvedValue(mockConfig);

      const res = await request(app.getHttpServer())
        .get('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockConfig.id);
      expect(res.body.data.companyId).toBe(mockUser.companyId);
    });

    it('404 — returns not found when no config exists for the company', async () => {
      mockAiConfigRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('401 — rejects unauthenticated request', async () => {
      const res = await request(app.getHttpServer()).get('/api/ai-config');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/ai-config
  // -------------------------------------------------------------------------

  describe('PUT /api/ai-config', () => {
    const validBody = {
      tone: Tone.WARM,
      botName: 'Aria',
      instructions: 'Always greet warmly.',
    };

    it('200 — creates a new config when none exists', async () => {
      const created = { ...mockConfig, ...validBody };
      mockAiConfigRepo.findOne.mockResolvedValue(null);
      mockAiConfigRepo.create.mockReturnValue(created);
      mockAiConfigRepo.save.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tone).toBe(Tone.WARM);
      expect(res.body.data.botName).toBe('Aria');
    });

    it('200 — overwrites an existing config', async () => {
      const updated = { ...mockConfig, ...validBody };
      mockAiConfigRepo.findOne.mockResolvedValue({ ...mockConfig });
      mockAiConfigRepo.save.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.data.botName).toBe('Aria');
    });

    it('400 — rejects an invalid tone value', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validBody, tone: 'INVALID_TONE' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects instructions exceeding 5000 characters', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validBody, instructions: 'x'.repeat(5001) });

      expect(res.status).toBe(400);
    });

    it('400 — rejects missing required tone field', async () => {
      const { tone: _tone, ...bodyWithoutTone } = validBody;

      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(bodyWithoutTone);

      expect(res.status).toBe(400);
    });

    it('401 — rejects unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/ai-config')
        .send(validBody);

      expect(res.status).toBe(401);
    });
  });
});
