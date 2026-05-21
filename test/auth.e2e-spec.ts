import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../src/auth/strategies/jwt-refresh.strategy';
import { User } from '../src/auth/entities/user.entity';
import { UserRole } from '../src/auth/enums/user-role.enum';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';

// ---------------------------------------------------------------------------
// Constants & shared state
// ---------------------------------------------------------------------------

const PLAIN_PASSWORD = 'password123';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockDataSource = { transaction: jest.fn() };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let mockUser: User;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10);

    mockUser = {
      id: 'user-uuid-e2e',
      email: 'e2e@company.com',
      password: hashedPassword,
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
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'e2e-access-secret',
              JWT_REFRESH_SECRET: 'e2e-refresh-secret',
              JWT_ACCESS_EXPIRES_IN: '15m',
              JWT_REFRESH_EXPIRES_IN: '7d',
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtRefreshStrategy,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
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

    // Obtain real JWT tokens via login for protected-route tests
    mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
    mockUserRepo.update.mockResolvedValue({ affected: 1 });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: mockUser.email, password: PLAIN_PASSWORD });

    accessToken = loginRes.body.data.accessToken;
    refreshToken = loginRes.body.data.refreshToken;
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // POST /api/auth/register-company
  // -------------------------------------------------------------------------

  describe('POST /api/auth/register-company', () => {
    const validBody = {
      companyName: 'Test Corp',
      email: 'admin@testcorp.com',
      password: 'password123',
      firstName: 'Alice',
      lastName: 'Admin',
    };

    const setupTransactionMock = (user: User) => {
      mockDataSource.transaction.mockImplementation(async (fn: (m: any) => any) => {
        const manager = {
          create: jest.fn()
            .mockReturnValueOnce({ id: 'co-1', name: validBody.companyName })
            .mockReturnValueOnce({ ...user }),
          save: jest.fn()
            .mockResolvedValueOnce({ id: 'co-1', name: validBody.companyName })
            .mockResolvedValueOnce({ ...user }),
        };
        return fn(manager);
      });
    };

    it('201 — creates company + admin and returns JWT pair', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      setupTransactionMock(mockUser);
      mockUserRepo.update.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register-company')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('409 — returns Conflict when email is already registered', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register-company')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('400 — rejects short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register-company')
        .send({ ...validBody, password: 'short' });

      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register-company')
        .send({ ...validBody, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/register  (Admin-only invite)
  // -------------------------------------------------------------------------

  describe('POST /api/auth/register', () => {
    const validBody = {
      email: 'agent@company.com',
      password: 'password123',
      firstName: 'Bob',
      lastName: 'Agent',
      role: 'agent',
    };

    it('201 — admin invites a new agent (no companyId in body)', async () => {
      // First findOne: JWT strategy validates admin token
      // Second findOne: AuthService checks email availability
      mockUserRepo.findOne
        .mockResolvedValueOnce(Object.assign(new User(), mockUser))
        .mockResolvedValueOnce(null);
      mockUserRepo.create.mockReturnValue({ ...mockUser, email: validBody.email });
      mockUserRepo.save.mockResolvedValue({ ...mockUser, email: validBody.email });
      mockUserRepo.update.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('409 — returns Conflict when email is already taken', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(Object.assign(new User(), mockUser)) // JWT validation
        .mockResolvedValueOnce({ ...mockUser });                     // email exists

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('400 — rejects admin role in invite body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validBody, role: 'admin' });

      expect(res.status).toBe(400);
    });

    it('401 — rejects unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------

  describe('POST /api/auth/login', () => {
    it('200 — returns JWT pair for valid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      mockUserRepo.update.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: mockUser.email, password: PLAIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('401 — rejects incorrect password', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: mockUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('401 — rejects unknown email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ghost@company.com', password: PLAIN_PASSWORD });

      expect(res.status).toBe(401);
    });

    it('400 — rejects missing password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: mockUser.email });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/auth/me
  // -------------------------------------------------------------------------

  describe('GET /api/auth/me', () => {
    it('200 — returns profile without password or refreshToken', async () => {
      mockUserRepo.findOne.mockResolvedValue(Object.assign(new User(), mockUser));

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(mockUser.email);
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('refreshToken');
    });

    it('401 — rejects missing token', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('401 — rejects malformed token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bad.token.here');
      expect(res.status).toBe(401);
    });

    it('401 — rejects when user is deactivated after token was issued', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/refresh
  // -------------------------------------------------------------------------

  describe('POST /api/auth/refresh', () => {
    it('200 — issues a new token pair for a valid refresh token', async () => {
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, refreshToken: hashedRefreshToken });
      mockUserRepo.update.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
    });

    it('401 — rejects invalid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'completely.invalid.garbage' });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------------------------

  describe('POST /api/auth/logout', () => {
    it('200 — clears the refresh token', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser });
      mockUserRepo.update.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(mockUserRepo.update).toHaveBeenCalledWith(mockUser.id, { refreshToken: null });
    });

    it('401 — rejects unauthenticated request', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });
});
