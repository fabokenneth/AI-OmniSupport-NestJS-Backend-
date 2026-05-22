import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AiConfigurationService } from './ai-configuration.service';
import { AiConfiguration } from './entities/ai-configuration.entity';
import { UpsertAiConfigurationDto } from './dto/upsert-ai-configuration.dto';
import { Tone } from './enums/tone.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockConfigFactory = (overrides: Partial<AiConfiguration> = {}): AiConfiguration =>
  ({
    id: 'config-uuid-1',
    companyId: 'company-uuid-1',
    botName: 'Assistant',
    tone: Tone.PROFESSIONAL,
    instructions: null,
    company: {} as never,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as AiConfiguration);

type MockRepo = { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
const createMockRepo = (): MockRepo => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AiConfigurationService', () => {
  let service: AiConfigurationService;
  let repo: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiConfigurationService,
        { provide: getRepositoryToken(AiConfiguration), useValue: createMockRepo() },
      ],
    }).compile();

    service = module.get<AiConfigurationService>(AiConfigurationService);
    repo = module.get(getRepositoryToken(AiConfiguration));
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => expect(service).toBeDefined());

  // -------------------------------------------------------------------------
  // findByCompany()
  // -------------------------------------------------------------------------

  describe('findByCompany()', () => {
    it('returns the configuration for the given company', async () => {
      const config = mockConfigFactory();
      repo.findOne.mockResolvedValue(config);

      const result = await service.findByCompany('company-uuid-1');

      expect(result).toEqual(config);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { companyId: 'company-uuid-1' } });
    });

    it('throws NotFoundException when no configuration exists for the company', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByCompany('company-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // upsert()
  // -------------------------------------------------------------------------

  describe('upsert()', () => {
    const dto: UpsertAiConfigurationDto = {
      botName: 'Aria',
      tone: Tone.WARM,
      instructions: 'Always greet warmly.',
    };

    it('creates a new configuration when none exists for the company', async () => {
      const created = mockConfigFactory({ ...dto, companyId: 'company-uuid-1' });
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.upsert('company-uuid-1', dto);

      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledWith({ ...dto, companyId: 'company-uuid-1' });
      expect(repo.save).toHaveBeenCalledWith(created);
    });

    it('updates and returns an existing configuration', async () => {
      const existing = mockConfigFactory();
      const updated = { ...existing, ...dto };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue(updated);

      const result = await service.upsert('company-uuid-1', dto);

      expect(result).toEqual(updated);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining(dto));
    });
  });
});
