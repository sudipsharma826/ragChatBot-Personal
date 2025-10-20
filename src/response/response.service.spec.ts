import { Test, TestingModule } from '@nestjs/testing';
import { ReponseService } from './reponse.service';

describe('ReponseService', () => {
  let service: ReponseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReponseService],
    }).compile();

    service = module.get<ReponseService>(ReponseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
