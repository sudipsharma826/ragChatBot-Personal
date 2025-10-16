import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';

@Module({
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
})
export class EmbeddingsModule {}
