import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    EmbeddingsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
