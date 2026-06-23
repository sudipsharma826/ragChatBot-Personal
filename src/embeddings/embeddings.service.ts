import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createAdvancedChunks } from './embeddings.utils';
import { ProfileData } from './embeddings.types';
import { getSupabaseClient } from '../app.utils';
import { InferenceClient } from '@huggingface/inference';

type EmbeddingChunk = {
  id: string;
  text: string;
  type?: string;
  title?: string;
};

@Injectable()
export class EmbeddingsService {
  private readonly supabase: SupabaseClient;
  private readonly hf: InferenceClient;

  constructor(private readonly config: ConfigService) {
    this.supabase = getSupabaseClient(this.config);

    const token = this.config.get<string>('HF_TOKEN');
    if (!token) throw new Error('HF_TOKEN is missing');

    this.hf = new InferenceClient(token);
  }

  // -----------------------------
  // EMBEDDING GENERATION
  // -----------------------------
  async generateEmbedding(text: string): Promise<number[]> {
    const cleanedText = text?.trim();
    if (!cleanedText) throw new Error('Text is required');

    try {
      const result = await this.hf.featureExtraction({
        model: 'BAAI/bge-small-en-v1.5',
        inputs: cleanedText,
      });

      // Case 1: flat embedding
      if (Array.isArray(result) && typeof result[0] === 'number') {
        return result as number[];
      }

      // Case 2: token-level embeddings → average pooling
      if (Array.isArray(result) && Array.isArray(result[0])) {
        const vectors = result as number[][];
        const dim = vectors[0].length;

        const sum = new Array(dim).fill(0);

        for (const vec of vectors) {
          for (let i = 0; i < dim; i++) {
            sum[i] += vec[i];
          }
        }

        return sum.map((v) => v / vectors.length);
      }

      throw new Error('Unexpected embedding format from Hugging Face');
    } catch (error: any) {
      console.error('❌ Embedding failed:', error?.message);
      throw new Error(`Embedding generation failed: ${error?.message}`);
    }
  }

  // -----------------------------
  // REFRESH PIPELINE
  // -----------------------------
  async refreshEmbeddings() {
    const profileData = await this.fetchProfileData();

    const chunks = createAdvancedChunks(profileData, 1500) as EmbeddingChunk[];

    if (!chunks.length) {
      throw new Error('No chunks generated');
    }

    await this.clearVectors();
    await this.insertEmbeddings(chunks);

    return {
      message: '✅ Embeddings refreshed successfully',
      totalChunks: chunks.length,
      provider: 'huggingface:bge-small-en-v1.5',
    };
  }

  // -----------------------------
  // INSERT EMBEDDINGS
  // -----------------------------
  private async insertEmbeddings(chunks: EmbeddingChunk[]) {
    for (const chunk of chunks) {
      const text = chunk.text?.trim();
      if (!text) continue;

      try {
        const embedding = await this.generateEmbedding(text);

        const { error } = await this.supabase.from('documents').insert({
          id: chunk.id,
          content: text,
          embedding,
          type: chunk.type ?? null,
          title: chunk.title ?? null,
        });

        if (error) throw error;

        await new Promise((r) => setTimeout(r, 300));
      } catch (err: any) {
        console.error(`❌ Failed chunk ${chunk.id}:`, err.message);
        throw err;
      }
    }
  }

  // -----------------------------
  // CLEAR VECTORS
  // -----------------------------
  private async clearVectors() {
    const { error } = await this.supabase
      .from('documents')
      .delete()
      .not('id', 'is', null);

    if (error) throw error;
  }

  // -----------------------------
  // TEST SUPABASE
  // -----------------------------
  async testSupabaseConnection() {
    const { error } = await this.supabase
      .from('documents')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('⚠️ Supabase issue:', error.message);
      return false;
    }

    return true;
  }

  // -----------------------------
  // FETCH PROFILE DATA
  // -----------------------------
  private async fetchProfileData(): Promise<ProfileData> {
    const siteBase = this.config.get<string>('SITE_BASE');
    const secret = this.config.get<string>('SECRET_KEY');

    if (!siteBase || !secret) {
      throw new Error('SITE_BASE and SECRET_KEY are required');
    }

    const url = `${siteBase}?secret=${encodeURIComponent(secret)}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('Failed to fetch profile data');
    }

    return (await res.json()) as ProfileData;
  }
}