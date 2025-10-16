import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsController', () => {
  let controller: EmbeddingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmbeddingsController],
      providers: [EmbeddingsService],
    }).compile();

    controller = module.get<EmbeddingsController>(EmbeddingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
