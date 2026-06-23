import { Controller, Get, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { AuthGuard } from './embeddings.guard';

@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) { }

  // @UseGuards(AuthGuard)
  @Get('data')
  async getDataAndEmbed() {
    const isConnected = await this.embeddingsService.testSupabaseConnection();

    if (isConnected) {
      return this.embeddingsService.refreshEmbeddings();
    } else {
      throw new InternalServerErrorException('Failed to connect to Supabase database');
    }
  }
}
