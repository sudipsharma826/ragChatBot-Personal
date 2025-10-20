import { Inject, Injectable } from '@nestjs/common';
import { createAgent } from '@inngest/agent-kit';
import { AIResponse } from './response.type';
import Redis from 'ioredis';

const REDIS_CLIENT = 'REDIS_CLIENT';
const REPO_MODELS = 'REPO_MODELS';

@Injectable()
export class ResponseService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis,
    @Inject(REPO_MODELS) readonly modelContainer,
  ) {}
  /**
   * Flow:
   * 1. Get past messages from Redis (for AI memory)
   * 2. Build prompt with combined context and chat history
   * 3. Run agent to generate AI response
   * 4. Save both user message and AI response with timestamp in Redis
   */
  async generateReponse({
    combinedContent,
    message,
    email,
  }: {
    combinedContent: string;
    message: string;
    email: string;
  }) {
    // Get past messages from Redis
    const pastMessages = await this.redis.lrange(`chat:${email}`, 0, -1);
    const recentMessages =
      pastMessages
        .map((msg) => JSON.parse(msg))
        .slice(-8)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n') || 'Just starting...';

    const context = combinedContent || 'No additional context provided.';

   const prompt = `
You are Sudip Sharma — respond as me in a natural, friendly, and human way. 
You are not an assistant; you are my personal AI avatar that represents me in conversations.

**Tone & Style Guidelines:**
- Write as if you are Sudip Sharma speaking directly to the user — warm, kind, and genuine.  
- Use natural, conversational language (not robotic or formal).  
- Avoid phrases like "I'm happy to help" or "How can I assist you" — instead, reply as a real person would.  
- Be concise, thoughtful, and engaging.  
- Show empathy and interest where appropriate.  
- Respect user privacy and boundaries.  
- Keep your replies on-topic and meaningful.  

**Behavior Rules:**
- If this is the **first message** of the conversation, begin with a short, warm greeting (e.g., “Hey there! It’s great to connect with you.”).  
- For **later messages**, do **not greet again** — reply directly in a friendly, conversational tone.  
- If the user asks for my profile URL, resume, CV, or social media links, provide them naturally as part of the response.  

**Relevant Context for the User’s Query:**
${context}

**Conversation So Far:**
${recentMessages}

**User’s Message:**
"${message}"

**Your Response (as Sudip Sharma):**
Write a natural, human-like response that sounds like it’s coming from me, not an AI. 
Keep it friendly, clear, and true to my personality, following the above tone and behavior rules.
`;


    // Create agent with the first available fallback model
    const getFallbackModel = this.modelContainer.getFallbackModel;
    const firstModel = getFallbackModel ? getFallbackModel(0) : undefined;

    const agent = createAgent({
      model: firstModel,
      name: 'RAG ChatBot',
      description: 'An AI assistant that responds to chat messages',
      system: prompt,
    });

    if (!agent) throw new Error('Agent creation failed.');

    const aiResponse = (await agent.run(prompt)) as AIResponse;
    const aiMessage =
      aiResponse.output?.[0]?.content ??
      "Sorry, I couldn't generate a response.";

    // Save user message
    await this.redis.rpush(
      `chat:${email}`,
      JSON.stringify({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }),
    );

    // Save AI response
    await this.redis.rpush(
      `chat:${email}`,
      JSON.stringify({
        role: 'ai',
        content: aiMessage,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      aiMessage,
      combinedContent,
    };
  }
}
