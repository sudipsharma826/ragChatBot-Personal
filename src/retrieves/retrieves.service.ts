import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ResponseService } from '../response/response.service';

type HandleChatInput = {
  message: string;
  sessionId?: string;
};

type RetrievedDocumentsResult = {
  combinedContent: string;
};

type MatchDocumentRow = {
  id?: string;
  content: string;
  type?: string;
  similarity?: number;
};

@Injectable()
export class RetrievesService {
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly responseService: ResponseService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in environment',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async handleChat({ message, sessionId }: HandleChatInput) {
    const chatMessage = message?.trim();

    if (!chatMessage) {
      throw new Error('Message is required');
    }

    try {
      const embeddedQuery = await this.embedQuery(chatMessage);

      const { combinedContent } = await this.retrieveDocuments(embeddedQuery);

      const responseByLLM = await this.responseService.generateReponse({
        combinedContent,
        message: chatMessage,
        sessionId: sessionId ?? 'default-session-id',
      });

      return {
        message: chatMessage,
        response: responseByLLM,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to handle chat request';

      console.error('❌ handleChat failed:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  private async embedQuery(query: string): Promise<number[]> {
    const queryEmbedding =
      await this.embeddingsService.generateEmbedding(query);

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    console.log('✅ Query embedding generated, length:', queryEmbedding.length);
    return queryEmbedding;
  }

  private async retrieveDocuments(
    embeddedQuery: number[],
    topK = 5,
    similarityThreshold = 0.5,
    typeFilter?: string,
  ): Promise<RetrievedDocumentsResult> {
    if (!Array.isArray(embeddedQuery) || embeddedQuery.length === 0) {
      throw new Error('Invalid embedded query');
    }

    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: embeddedQuery,
      match_threshold: similarityThreshold,
      match_count: topK,
    });

    if (error) {
      console.error('❌ Vector search failed:', error);
      throw new Error(
        `Vector search failed: ${error.message || JSON.stringify(error)}`,
      );
    }

    console.log('✅ Vector search returned matches:', data?.length || 0);

    const documents = (data as MatchDocumentRow[]) || [];
    const combinedContent = documents.map((doc) => doc.content).join('\n\n');

    return { combinedContent };
  }
}