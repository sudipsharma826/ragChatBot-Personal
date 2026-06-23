import { Module } from '@nestjs/common';
import { ResponseService } from './response.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createModels } from './response.utils';
import { getRedisClient } from 'src/app.utils';

const REDIS_CLIENT = 'REDIS_CLIENT';
const REPO_MODELS = 'REPO_MODELS';

@Module({
  imports: [ConfigModule],
  providers: [
    // Redis provider
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => getRedisClient(config),
      inject: [ConfigService],
    },
    // Models provider
    {
      provide: REPO_MODELS,
      useFactory: (config: ConfigService) =>
        createModels({
          OPENAI_API_KEY: config.get<string>('OPENAI_API_KEY'),
          ANTHROPIC_API_KEY: config.get<string>('ANTHROPIC_API_KEY'),
          GEMINI_API_KEY: config.get<string>('GEMINI_API_KEY'),
          OPENROUTER_API_KEY: config.get<string>('OPENROUTER_API_KEY'),
          GROQ_API_KEY: config.get<string>('GROQ_API_KEY'),
        }),
      inject: [ConfigService],
    },
    ResponseService,
  ],
  exports: [ResponseService],
})
export class ResponseModule {}