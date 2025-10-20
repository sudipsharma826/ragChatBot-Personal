import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ConfigModule } from '@nestjs/config';
import { RetrievesModule } from './retrieves/retrieves.module';
import { ResponseModule } from './response/response.module';

@Module({
  imports: [
    EmbeddingsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RetrievesModule,
    ResponseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
