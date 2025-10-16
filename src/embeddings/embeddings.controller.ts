import { Controller, Get } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

@Controller('embeddings') ///embeddings/....
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Get('data') ///embeddings/data in get method
  async getDataAndEmbed(): Promise<string> {
   return this.embeddingsService.getData();
  }
}
