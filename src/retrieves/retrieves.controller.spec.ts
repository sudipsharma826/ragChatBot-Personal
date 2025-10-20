import { Test, TestingModule } from '@nestjs/testing';
import { RetrievesController } from './retrieves.controller';
import { RetrievesService } from './retrieves.service';

describe('RetrievesController', () => {
  let controller: RetrievesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetrievesController],
      providers: [RetrievesService],
    }).compile();

    controller = module.get<RetrievesController>(RetrievesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
