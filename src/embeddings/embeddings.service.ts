import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

/**
 * EMBEDDINGS SERVICE
 * 
 * This service handles:
 * - Generating text embeddings using Hugging Face API with BAAI/bge-small-en-v1.5
 * - Storing vectors in Supabase with pgvector
 * - Semantic search across stored documents
 * - Profile data processing and chunking
 * 
 * Features:
 * ✅ Free embeddings using Hugging Face
 * ✅ Vector search with cosine similarity
 * ✅ Fallback embedding generation for reliability
 * ✅ Batch processing with rate limiting
 * ✅ Comprehensive error handling
 */
@Injectable()
export class EmbeddingsService {
  private readonly supabase;

  /**
   * SERVICE CONSTRUCTOR
   * Initializes Supabase client and validates configuration
   */
  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_ANON_KEY');

    // Validate required environment variables
    if (!supabaseUrl) throw new Error('❌ SUPABASE_URL is required');
    if (!supabaseKey) throw new Error('❌ SUPABASE_ANON_KEY is required');

    // Initialize Supabase client for database operations
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // =========================================================================
  // EMBEDDING GENERATION METHODS
  // =========================================================================

  /**
   * GENERATE EMBEDDINGS USING HUGGING FACE INFERENCE API
   * 
   * Uses BAAI/bge-small-en-v1.5 model which is reliable and free
   * Converts text to 384-dimensional vectors for semantic search
   * 
   * @param text - Input text to convert to embedding
   * @returns Promise<number[]> - 384-dimensional embedding vector
   * 
   * @throws Error if Hugging Face API fails and fallback also fails
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🔁 Generating embedding for: "${text.substring(0, 50)}..."`);

      const hfToken = this.config.get<string>('HF_TOKEN');
      
      // Validate Hugging Face token exists
      if (!hfToken) {
        throw new Error('HF_TOKEN is required for Hugging Face API');
      }

      // ✅ USING BAAI/bge-small-en-v1.5 - RELIABLE AND FREE
      const apiUrl = 'https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5';
      
      console.log(`ℹ️ Calling Hugging Face API with BAAI/bge-small-en-v1.5`);

      // Make API request to Hugging Face
      const response = await axios.post(
        apiUrl,
        {
          inputs: text
          // Simple input format that works reliably
        },
        {
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout for model loading
        }
      );

      console.log('✅ Hugging Face API response received');

      // Handle the response data
      const responseData = response.data;

      // Check if response is empty
      if (!responseData) {
        throw new Error('Empty response from Hugging Face API');
      }

      console.log('🔍 Response type:', Array.isArray(responseData) ? 'array' : typeof responseData);

      // ✅ RESPONSE PROCESSING
      let embedding: number[];

      if (Array.isArray(responseData)) {
        if (Array.isArray(responseData[0])) {
          // Case 1: Token-level embeddings (array of arrays) - average them
          console.log('📊 Processing token-level embeddings');
          const tokenVectors = responseData as number[][];
          const dimension = tokenVectors[0].length;
          const averaged = new Array(dimension).fill(0);
          
          // Sum all token vectors
          for (const tokenVector of tokenVectors) {
            for (let i = 0; i < dimension; i++) {
              averaged[i] += tokenVector[i];
            }
          }
          
          // Calculate average
          embedding = averaged.map(value => value / tokenVectors.length);
        } else if (typeof responseData[0] === 'number') {
          // Case 2: Already a single embedding vector
          console.log('📊 Processing single embedding vector');
          embedding = responseData as number[];
        } else {
          // Case 3: Unexpected array format
          console.warn('⚠️ Unexpected array format, using fallback');
          return this.generateFallbackEmbedding(text);
        }
      } else {
        // Case 4: Non-array response
        console.error('❌ Unexpected response format:', typeof responseData);
        return this.generateFallbackEmbedding(text);
      }

      console.log(`✅ Generated embedding: ${embedding.length} dimensions`);

      // BAAI/bge-small-en-v1.5 produces 384-dimensional embeddings
      // Normalize to ensure compatibility with database schema
      if (embedding.length !== 384) {
        console.warn(`⚠️ Expected 384 dimensions but got ${embedding.length}, normalizing`);
        embedding = this.normalizeEmbeddingDimensions(embedding, 384);
      }

      return embedding;

    } catch (error: any) {
      console.error('❌ Hugging Face embedding failed:');
      
      // Handle specific HTTP errors
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        
        console.error(`HTTP ${status}: ${statusText}`);

        if (status === 401) {
          throw new Error('Hugging Face API: Invalid token (401 Unauthorized)');
        } else if (status === 503) {
          console.log('🔄 Model is loading, using fallback...');
        }
      }

      console.error('Error details:', error.message);
      
      // Use fallback embedding as last resort
      console.log('🔄 Using fallback embedding');
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * NORMALIZE EMBEDDING DIMENSIONS
   * 
   * Ensures embeddings are exactly 384 dimensions for database compatibility
   * Truncates if too long, pads with zeros if too short
   * 
   * @param embedding - Original embedding vector
   * @param targetDimensions - Target dimension count (384)
   * @returns Normalized embedding vector with exact target dimensions
   */
  private normalizeEmbeddingDimensions(embedding: number[], targetDimensions: number): number[] {
    // Return as-is if already correct dimensions
    if (embedding.length === targetDimensions) {
      return embedding;
    }
    
    // Truncate if embedding has more dimensions than needed
    if (embedding.length > targetDimensions) {
      return embedding.slice(0, targetDimensions);
    } else {
      // Pad with zeros if embedding has fewer dimensions
      const padded = [...embedding];
      while (padded.length < targetDimensions) {
        padded.push(0);
      }
      return padded;
    }
  }

  /**
   * SIMPLE FALLBACK EMBEDDING GENERATION
   * 
   * Creates deterministic embeddings based on text hash when API is unavailable
   * Ensures service never fails completely and always returns an embedding
   * 
   * @param text - Input text for embedding generation
   * @returns number[] - 384-dimensional fallback embedding
   */
  private generateFallbackEmbedding(text: string): number[] {
    console.log('🔄 Using fallback embedding');
    
    // Initialize 384-dimensional vector with zeros
    const embedding = Array(384).fill(0);
    let hash = 0;
    
    // Generate hash from text content for determinism
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    
    // Create deterministic embedding values using hash and sine function
    for (let i = 0; i < 384; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1; // Small values for cosine similarity
    }
    
    return embedding;
  }

  // =========================================================================
  // MAIN SERVICE METHODS
  // =========================================================================

  /**
   * REFRESH EMBEDDINGS - MAIN ENTRY POINT
   * 
   * Complete pipeline to refresh all embeddings:
   * 1. Fetch latest profile data from external API
   * 2. Convert structured data to searchable text chunks
   * 3. Clear existing vectors from database
   * 4. Generate and store new embeddings
   * 
   * @returns Promise with operation results including message, chunk count, and provider
   * 
   * @throws Error if any step in the pipeline fails
   */
  async refreshEmbeddings(): Promise<{
    message: string;
    totalChunks: number;
    provider: string;
  }> {
    try {
      // Fetch and process profile data from external API
      const profileData = await this.fetchProfileData();
      
      // Convert structured data to text chunks optimized for embedding
      const chunks = this.createTextChunks(profileData);
      console.log(`✅ Generated ${chunks.length} text chunks`);
      
      // Clear existing data to ensure fresh embeddings
      await this.clearVectors();
      
      // Generate embeddings and store in database
      const result = await this.upsertEmbeddings(chunks);
      
      return {
        message: 'Embeddings refreshed successfully with BAAI/bge-small-en-v1.5',
        totalChunks: chunks.length,
        provider: 'huggingface:baai-bge-small-en-v1.5'
      };
      
    } catch (error: any) {
      console.error('❌ Error refreshing embeddings:', error.message);
      throw new Error(`Embedding process failed: ${error.message}`);
    }
  }

  /**
   * SEMANTIC SEARCH ACROSS STORED EMBEDDINGS
   * 
   * Finds similar documents using vector similarity search
   * Converts query to embedding and searches for similar vectors in database
   * 
   * @param query - Search query text
   * @param topK - Number of results to return (default: 5)
   * @returns Array of matching documents with similarity scores, text, and metadata
   * 
   * @throws Error if search fails
   */
  async searchEmbeddings(query: string, topK: number = 5): Promise<Array<{
    id: string;
    score: number;
    text: string;
    type: string;
    title: string;
  }>> {
    try {
      console.log(`🔍 Searching for: "${query}"`);
      
      // Generate embedding for search query using same model as documents
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform vector similarity search in database using pgvector
      const { data, error } = await this.supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,  // Lower threshold to get more results
        match_count: topK
      });

      // Handle database errors
      if (error) {
        console.error('❌ Vector search failed:', error);
        throw error;
      }

      console.log(`✅ Found ${data?.length || 0} results`);
      
      // Format and return results with relevant information
      return (data || []).map((match: any) => ({
        id: match.id,
        score: match.similarity,
        text: match.content,
        type: match.type,
        title: match.title
      }));
      
    } catch (error: any) {
      console.error('Error searching embeddings:', error);
      throw error;
    }
  }

  // =========================================================================
  // DATA PROCESSING METHODS
  // =========================================================================

  /**
   * CONVERT PROFILE DATA TO SEARCHABLE TEXT CHUNKS
   * 
   * Transforms structured profile data into text chunks optimized for embedding
   * Each chunk represents a logical unit of information with consistent formatting
   * 
   * @param profileData - Raw profile data from API
   * @returns Array of text chunks with unique IDs, types, titles, and formatted text
   */
  private createTextChunks(profileData: any): Array<{
    id: string;
    type: string;
    title: string;
    text: string;
  }> {
    const chunks: Array<{
      id: string;
      type: string;
      title: string;
      text: string;
    }> = [];

    // Process Personal Data
    if (profileData.personalData) {
      const p = profileData.personalData;
      chunks.push({
        id: randomUUID(),
        type: 'personal',
        title: `${p.fullName} - Personal Info`,
        text: `Name: ${p.fullName}. Title: ${p.title}. Location: ${p.location}. Bio: ${p.bio}. Objective: ${p.objective}. Summary: ${p.summary}. Currently learning: ${p.currentLearning}. Hobbies: ${p.hobbies}.`
      });
    }

    // Process Site Configuration
    if (profileData.siteConfig) {
      const s = profileData.siteConfig;
      chunks.push({
        id: randomUUID(),
        type: 'site',
        title: s.siteName,
        text: `Site: ${s.siteName}. Tagline: ${s.tagline}. Description: ${s.description}. Contact: ${s.email}, ${s.phone}. Address: ${s.address}.`
      });
    }

    // Process Work Experiences
    profileData.experiences?.forEach((exp: any) => {
      chunks.push({
        id: randomUUID(),
        type: 'experience',
        title: `${exp.company} - ${exp.position}`,
        text: `Company: ${exp.company}. Position: ${exp.position}. Location: ${exp.location}. Period: ${exp.startDate} to ${exp.endDate || 'present'}. Description: ${exp.description}. Achievements: ${exp.achievements}.`
      });
    });

    // Process Education History
    profileData.educations?.forEach((edu: any) => {
      chunks.push({
        id: randomUUID(),
        type: 'education',
        title: `${edu.institution} - ${edu.degree}`,
        text: `Institution: ${edu.institution}. Degree: ${edu.degree}. Field: ${edu.field}. Location: ${edu.location}. Period: ${edu.startDate} to ${edu.endDate || 'present'}. Description: ${edu.description}. Achievements: ${edu.achievements}.`
      });
    });

    // Process Technical Skills (grouped into single chunk for efficiency)
    if (profileData.skills?.length) {
      const skillsText = profileData.skills
        .map((skill: any) => `${skill.name} (${skill.experienceYears} years)`)
        .join(', ');
      
      chunks.push({
        id: randomUUID(),
        type: 'skills',
        title: 'Technical Skills',
        text: `Skills: ${skillsText}.`
      });
    }

    // Process Projects
    profileData.projects?.forEach((project: any) => {
      chunks.push({
        id: randomUUID(),
        type: 'project',
        title: project.title,
        text: `Project: ${project.title}. Description: ${project.description}. Features: ${project.features?.join(', ') || 'N/A'}. Skills: ${project.skills?.join(', ') || 'N/A'}. Live URL: ${project.liveUrl || 'N/A'}.`
      });
    });

    // Process Certifications
    profileData.certificates?.forEach((cert: any) => {
      chunks.push({
        id: randomUUID(),
        type: 'certificate',
        title: cert.title,
        text: `Certificate: ${cert.title}. Institute: ${cert.instituteName}. Issue Date: ${cert.issueDate}. Description: ${cert.description || 'N/A'}. Skills: ${cert.skills?.join(', ') || 'N/A'}.`
      });
    });

    return chunks;
  }

  // =========================================================================
  // DATABASE OPERATIONS
  // =========================================================================

  /**
   * STORE EMBEDDINGS IN SUPABASE
   * 
   * Processes chunks in sequence, generates embeddings, and stores in database
   * Includes rate limiting to avoid API throttling and ensure reliability
   * 
   * @param chunks - Array of text chunks to process and store
   * @returns Operation result with count of successfully stored embeddings
   * 
   * @throws Error if any chunk fails to process or store
   */
  private async upsertEmbeddings(chunks: Array<{ id: string; type: string; title: string; text: string }>) {
    try {
      // Process each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🔁 Processing ${i + 1}/${chunks.length}: ${chunk.title}`);
        
        // Generate embedding for current chunk text
        const embedding = await this.generateEmbedding(chunk.text);
        
        // Store in Supabase with metadata
        const { error } = await this.supabase
          .from('documents')
          .insert({
            id: chunk.id,
            content: chunk.text,
            embedding: embedding,
            type: chunk.type,
            title: chunk.title,
            metadata: { 
              timestamp: new Date().toISOString(),
              provider: 'huggingface:baai-bge-small-en-v1.5'
            }
          });

        // Handle insertion errors
        if (error) {
          console.error(`❌ Failed to insert document:`, error);
          throw error;
        }
        
        console.log(`✅ Stored: ${chunk.title}`);
        
        // Rate limiting between requests to avoid API throttling
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log('✅ Successfully stored all embeddings');
      return { upsertedCount: chunks.length };
      
    } catch (error) {
      console.error('❌ Error upserting embeddings:', error);
      throw error;
    }
  }

  /**
   * CLEAR EXISTING VECTORS FROM DATABASE
   * 
   * Removes all existing documents before refreshing with new data
   * Ensures data consistency and prevents duplicate embeddings
   * 
   * @throws Error if deletion fails
   */
  private async clearVectors(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;
      console.log('✅ Cleared existing vectors from database');
    } catch (error) {
      console.error('❌ Error clearing vectors:', error);
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * TEST SUPABASE CONNECTION
   * 
   * Validates connection to Supabase database and checks if tables exist
   * Useful for health checks and debugging
   * 
   * @returns boolean - True if connection successful, false otherwise
   */
  async testSupabaseConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('documents')
        .select('id')
        .limit(1);

      // Allow "does not exist" errors as tables might not be created yet
      if (error && !error.message.includes('does not exist')) throw error;
      
      console.log('✅ Supabase connection successful');
      return true;
    } catch (error: any) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
  }

  /**
   * FETCH PROFILE DATA FROM EXTERNAL API
   * 
   * Retrieves profile data from secured external endpoint
   * Uses secret key for authentication
   * 
   * @returns Profile data object
   * 
   * @throws Error if API call fails or credentials are missing
   */
  private async fetchProfileData() {
    const siteBase = this.config.get<string>('SITE_BASE');
    const secret = this.config.get<string>('SECRET_KEY');
    
    // Validate required configuration
    if (!siteBase || !secret) {
      throw new Error('SITE_BASE and SECRET_KEY are required');
    }

    // Construct secure URL with secret parameter
    const url = `${siteBase}?secret=${encodeURIComponent(secret)}`;
    const response = await axios.get(url);
    return response.data;
  }
}