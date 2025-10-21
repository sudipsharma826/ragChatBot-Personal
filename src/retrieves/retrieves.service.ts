import { createAgent } from '@inngest/agent-kit';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ResponseService } from '../response/response.service';
import { AIResponse } from '../response/response.type';

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

    // Correct the message by ai agent for the correctness
    const correctedMessage = await this.correctMessage(message);
    
    const chatMessage = (correctedMessage || '').trim();
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
      const errorMsg = typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string'
        ? (err as any).message
        : String(err);
      console.error('❌ handleChat failed:', errorMsg);
      throw new Error(errorMsg || 'Failed to handle chat request');
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

  // Ai Agent to correct the user message for better response
  async correctMessage(message: string) {
  // Get the fallback model
  const getFallbackModel = this.responseService.modelContainer.getFallbackModel;
  const firstModel = getFallbackModel ? getFallbackModel(0) : undefined;

  // Construct the prompt
  const prompt = `You are an AI assistant that preprocesses a user's message before retrieving relevant documents from the database.

Instructions:
- Correct grammar, spelling, and punctuation in the user's message.
- Rephrase it to be logically clear and concise.
- Preserve the original meaning.
- Return only one final corrected message, with no explanations or additional text.
- The message should be formatted and ready for document retrieval in Supabase.

User's Original Message:
"${message}"
`;


  // Create the agent
  const agent = createAgent({
    model: firstModel,
    name: 'AI Chat Corrector',
    description: 'An AI assistant that grammatically corrects user messages and helps retrieve documents from a vector database.',
    system: prompt,
  });

  if (!agent) throw new Error('Agent creation failed.');

  // Run the agent
  const aiResponse = (await agent.run(prompt)) as AIResponse;

  // Extract the corrected message
  const aiMessage =
    aiResponse.output?.[0]?.content ??
    message;
  // console.log('Corrected Message:', aiMessage);
  return aiMessage;
}

}
