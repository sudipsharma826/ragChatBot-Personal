import { Controller, Get, UseGuards } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { AuthGuard } from './embeddings.guard';

@Controller('embeddings') ///embeddings/....
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}
  @UseGuards(AuthGuard )
  @Get('data') ///embeddings/data in get method
  async getDataAndEmbed() {
    //check supabase connection 
    const isConnected: Promise<boolean> = this.embeddingsService.testSupabaseConnection();
    if(await isConnected) {
      console.log('Supabase connection successful');
      return this.embeddingsService.refreshEmbeddings();
    }else{
      console.error('Supabase connection failed');
      throw new Error('Failed to connect to Supabase database');
    }

  }
}
