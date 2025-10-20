import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeEmbeddingDimensions,
  createTextChunks,
} from './embeddings.utils';
import { ProfileData } from './embeddings.types';


@Injectable()
export class EmbeddingsService {
  private readonly supabase;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Supabase URL and Key are required');
    console.log('Supabase URL and Key found', url, key);
    this.supabase = createClient(url, key);
  }

  // ===================================================
  // EMBEDDING GENERATION
  // ===================================================
  async generateEmbedding(text: string) {
    const hfToken = this.config.get<string>('HF_TOKEN');
    if (!hfToken) throw new Error('HF_TOKEN is missing');

    try {
      const { data } = await axios.post(
        'https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5',
        { inputs: text },
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );

      let embedding: number[];

      if (Array.isArray(data[0])) {
        const dim = data[0].length;
        const sum = new Array(dim).fill(0);
        for (const v of data) for (let i = 0; i < dim; i++) sum[i] += v[i];
        embedding = sum.map((x) => x / data.length);
      } else {
        embedding = data;
      }

      if (embedding.length !== 384) {
        embedding = normalizeEmbeddingDimensions(embedding, 384);
      }

      return embedding;
    } catch (err: any) {
      console.error('Embedding generation failed:', err?.message ?? err);
    }
  }

  // ===================================================
  // PIPELINE
  // ===================================================
  async refreshEmbeddings() {
    const profileData = await this.fetchProfileData();
    const result = createTextChunks(profileData);
    const chunks = (result as unknown as ProfileData[]) || [];
    await this.clearVectors();
    await this.upsertEmbeddings(chunks);

    return {
      message: '✅ Embeddings refreshed successfully',
      totalChunks: chunks.length,
      provider: 'huggingface:baai-bge-small-en-v1.5',
    };
  }


  // ===================================================
  // DATABASE OPS
  // ===================================================
  private async upsertEmbeddings(chunks: any[]) {
    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk.text);
      const { error } = await this.supabase.from('documents').insert({
        id: chunk.id,
        content: chunk.text,
        embedding,
        type: chunk.type,
        title: chunk.title,
      });
      if (error) throw error;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  private async clearVectors() {
    const { error } = await this.supabase.from('documents').delete().not('id', 'is', null);
    if (error) throw error;
  }

  async testSupabaseConnection() {
    try {
      const { error } = await this.supabase.from('documents').select('id').limit(1);
      if (error && error.message.includes('does not exist')) {
        console.warn('Table does not exist,');
      } else {
        console.log('✅ Supabase connection OK');
        return true;
      }
    } catch (err: any) {
      console.error('❌ Supabase test failed:', err.message);
      return false;
    }
  }

  //Data fetching
  private async fetchProfileData() {
    const siteBase = this.config.get<string>('SITE_BASE');
    const secret = this.config.get<string>('SECRET_KEY');
    if (!siteBase || !secret) throw new Error('SITE_BASE and SECRET_KEY required');
    const url = `${siteBase}?secret=${encodeURIComponent(secret)}`;
    const res = await axios.get(url);
    console.log('Profile data fetched, length:', res.data);
    return res.data;
  }
}
