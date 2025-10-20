import { Test, TestingModule } from '@nestjs/testing';
import { RetrievesService } from './retrieves.service';

describe('RetrievesService', () => {
  let service: RetrievesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetrievesService],
    }).compile();

    service = module.get<RetrievesService>(RetrievesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
