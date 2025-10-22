import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { ChatGuard } from 'src/retrieves/retrieves.guard';

const REDIS_CLIENT = 'REDIS_CLIENT';
const Supabase = 'SUPABASE_CLIENT';

@Module({
  imports: [ConfigModule],
  controllers: [UserController],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) throw new Error('REDIS_URL is required in environment');
        return new Redis(url);
      },
      inject: [ConfigService],
    },
    {
      provide:Supabase,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('SUPABASE_URL');
        const key = config.get<string>('SUPABASE_ANON_KEY');
        if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required in environment');
        return createClient(url, key);
      },
      inject: [ConfigService],
    },
    UserService,
    ChatGuard,
  ],
})
export class UserModule {}
