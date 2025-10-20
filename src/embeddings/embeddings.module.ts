import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports:[
    ConfigModule
  ],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService], //for using the embedding service by the another module
})
export class EmbeddingsModule {}
