import { createServer, IncomingMessage, ServerResponse } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let server: any;

async function bootstrap(): Promise<any> {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); 
  await app.init(); 
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!server) {
    const app = await bootstrap();
    server = createServer(app);
  }
  server.emit('request', req, res);
}
