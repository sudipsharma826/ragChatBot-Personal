import { Module } from '@nestjs/common';
import { RetrievesService } from './retrieves.service';
import { RetrievesController } from './retrieves.controller';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { ResponseModule } from 'src/response/response.module';
import { ConfigService } from '@nestjs/config';
import { getRedisClient } from 'src/app.utils';
const REDIS_CLIENT = 'REDIS_CLIENT';
@Module({
  imports: [EmbeddingsModule, ResponseModule],
  controllers: [RetrievesController],
  providers: [RetrievesService,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => getRedisClient(config),
      inject: [ConfigService],
    },
  ],
})
export class RetrievesModule {}
