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
})
export class EmbeddingsModule {}
