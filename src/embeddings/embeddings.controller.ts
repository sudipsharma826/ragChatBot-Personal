import { Controller, Get, UseGuards, InternalServerErrorException, Query } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { AuthGuard } from './embeddings.guard';

@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) { }

  @UseGuards(AuthGuard)
  @Get('data')
  async getDataAndEmbed(@Query('secret') secret: string) {
    const isConnected = await this.embeddingsService.testSupabaseConnection();

    if (isConnected) {
      return this.embeddingsService.refreshEmbeddings(secret);
    } else {
      throw new InternalServerErrorException('Failed to connect to Supabase database');
    }
  }
}
