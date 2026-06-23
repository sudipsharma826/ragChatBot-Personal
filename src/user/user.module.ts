import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRedisClient, getSupabaseClient, REDIS_CLIENT, SUPABASE_CLIENT } from '../app.utils';
import { ChatGuard } from 'src/retrieves/retrieves.guard';

@Module({
  imports: [ConfigModule],
  controllers: [UserController],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => getRedisClient(config),
      inject: [ConfigService],
    },
    {
      provide: SUPABASE_CLIENT,
      useFactory: (config: ConfigService) => getSupabaseClient(config),
      inject: [ConfigService],
    },
    UserService,
    ChatGuard,
  ],
})
export class UserModule {}
