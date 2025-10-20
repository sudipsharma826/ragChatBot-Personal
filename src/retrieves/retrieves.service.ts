import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingsService } from 'src/embeddings/embeddings.service';
import { ResponseService } from 'src/response/response.service';

@Injectable()
export class RetrievesService {
  private supabase: SupabaseClient;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly responseService: ResponseService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY are required in environment',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async handleChat({ message }: { message: string }) {
    const chatMessage = (message || '').trim();
    if (!chatMessage) throw new Error('Message is required');

    try {
      // 1️⃣ Generate query embedding
      const embeddedQuery = await this.embedQuery(chatMessage);

      // 2️⃣ Retrieve relevant documents
      const relevantDocuments = await this.retrieveDocuments(embeddedQuery);

      // 3️⃣ Generate LLM response using the combined content
      const responseByLLM = await this.responseService.generateReponse({
        combinedContent: relevantDocuments.combinedContent,
        message: chatMessage,
        email: 'sudeepsharma826@gmail.com',
      });

      return {
        message: chatMessage,
        response: responseByLLM,
      };
    } catch (err) {
      console.error('❌ handleChat failed:', err?.message || err);
      throw new Error(err?.message || 'Failed to handle chat request');
    }
  }

  private async embedQuery(query: string): Promise<number[]> {
    const queryEmbedding = await this.embeddingsService.generateEmbedding(query);

    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    console.log('🔹 Query embedding generated, length:', queryEmbedding.length);
    return queryEmbedding;
  }

  private async retrieveDocuments(
    embeddedQuery: number[],
    topK = 15,
    similarityThreshold = 0.65,
    typeFilter?: string, 
  ) {
    if (!Array.isArray(embeddedQuery) || embeddedQuery.length === 0)
      throw new Error('Invalid embedded query');

    console.log('🔍 Starting vector search with embedding length:', embeddedQuery.length);

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: embeddedQuery,
      match_threshold: similarityThreshold,
      match_count: topK,
    });


    if (error) {
      console.error('❌ Vector search failed:', error);
      throw new Error('Vector search failed: ' + (error.message || JSON.stringify(error)));
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No documents matched the query');
      return { combinedContent: '' };
    }

    // Optional type filter ( for debugging purpose)
    const filteredData = typeFilter ? data.filter(d => d.type === typeFilter) : data;

    // Combine all content safely
    const combinedContent = (filteredData.length ? filteredData : data)
      .map(doc => doc.content)
      .filter(Boolean)
      .join('\n\n');

    // for debugging purpose , wheather the is perfectly done or not
    console.log(
      '✅ Vector search matched docs:',
      (filteredData.length ? filteredData : data).map(d => `${d.title || 'N/A'} (${d.type || 'N/A'})`),
    );

    return { combinedContent };
  }
}
