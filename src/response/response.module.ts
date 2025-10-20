import { Module } from '@nestjs/common';
import { ResponseService } from './response.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createRedis, createModels } from './response.utils';

const REDIS_CLIENT = 'REDIS_CLIENT';
const REPO_MODELS = 'REPO_MODELS';

@Module({
  imports: [ConfigModule],
  providers: [
    // Redis provider
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => createRedis(config.get<string>('REDIS_URL')),
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


/** ( Faced the cased to pass the env varible beyond the serive file to utils folder)
 * {
  provide: REDIS_CLIENT, // This is the token used to identify the provider
  useFactory: (config: ConfigService) => createRedis(config.get<string>('REDIS_URL')), 
  inject: [ConfigService], // Injects ConfigService into the factory
}
provide: REDIS_CLIENT → This is the name or token for the provider. Other services will use this token to get the Redis client.

useFactory → A factory function that creates the value (here, a Redis client).

inject → Tells Nest to inject these dependencies (here ConfigService) into the factory function.


e.g
To use the Redis client in another service, you would do:
const REDIS_CLIENT = 'REDIS_CLIENT'; and in constuctor we do :
@Inject(REDIS_CLIENT) private readonly redis,
 */