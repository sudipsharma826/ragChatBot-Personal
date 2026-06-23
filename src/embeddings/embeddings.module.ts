import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT, getSupabaseClient } from '../app.utils';


@Module({
  imports: [ConfigModule],
  controllers: [EmbeddingsController],
  providers: [
    EmbeddingsService,
    {
      provide: SUPABASE_CLIENT,
      useFactory: (configService: ConfigService) => {
        return getSupabaseClient(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
