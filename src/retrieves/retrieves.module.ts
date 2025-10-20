import { Module } from '@nestjs/common';
import { RetrievesService } from './retrieves.service';
import { RetrievesController } from './retrieves.controller';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { ResponseModule } from 'src/response/response.module';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
const REDIS_CLIENT = 'REDIS_CLIENT';
@Module({
  imports: [EmbeddingsModule, ResponseModule],
  controllers: [RetrievesController],
  providers: [RetrievesService,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) throw new Error('REDIS_URL is required in environment');
        return new Redis(url);
      },
      inject: [ConfigService],
    },
  ],
})
export class RetrievesModule {}
