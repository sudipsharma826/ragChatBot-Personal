import { Module } from '@nestjs/common';
import { RetrievesService } from './retrieves.service';
import { RetrievesController } from './retrieves.controller';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { ResponseModule } from 'src/response/response.module';

@Module({
  imports: [EmbeddingsModule, ResponseModule],
  controllers: [RetrievesController],
  providers: [RetrievesService],
})
export class RetrievesModule {}
