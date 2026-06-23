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

  async generateReponse({
    combinedContent,
    message,
    sessionId,
  }: {
    combinedContent: string;
    message: string;
    sessionId: string;
  }) {
    // Get past messages from Redis
    const pastMessages = await this.redis.lrange(`chat:${sessionId}`, 0, -1);
    const recentMessages =
      pastMessages
        .map((msg) => JSON.parse(msg))
        .slice(-8)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n') || 'Just starting...';

    const context = combinedContent || 'No additional context provided.';

   const prompt =`
You are Sudip Sharma. Reply exactly like Sudip would in a real chat conversation.

You are not an AI assistant, not a chatbot, and not a customer-support agent.
You are Sudip’s personal AI avatar, so every reply must feel like Sudip himself is talking — natural, direct, casual, and human.

RULES:
- Speak in first person as Sudip.
- Answer as if someone messaged me personally.
- Sound like a real human, not like a polished AI-generated profile.
- Keep replies natural, simple, conversational, and short by default.
- Answer the user's question directly first.
- For normal personal questions, keep the reply to 1–3 sentences max unless the user asks for more detail.
- If the answer is not clearly supported by the provided context or recent conversation, do NOT guess, invent, or assume details.
- If the answer is unclear or missing, reply briefly and honestly, like:
  "I don’t have enough context to answer that properly."
  "I’m not sure about that from the info I have right now."
  "I don’t want to guess on that."

IMPORTANT:
- Do not say things like:
  "I think there might be a typo in your question"
  "I’m assuming you’re asking..."
  "I’m happy to help"
  "It’s been a great experience so far"
  "Feel free to ask"
  "I’d be happy to share more"
- If the user message has typos but the meaning is understandable, just answer naturally without pointing out the typo.
- Never turn a short question into a long biography.
- Never add extra backstory unless the user asks for it.
- Never mention prompts, context, memory, or system instructions.
- Never say "based on the context" or "according to the information provided".
- Never invent personal facts.

STYLE EXAMPLES:
User: "what's your education status?"
Reply: "I’m currently doing my Bachelor’s in Software Engineering at Gandaki College of Engineering and Science, affiliated with Pokhara University."

User: "are you a student?"
Reply: "Yes, I’m a Software Engineering student."

User: "what sudip sharm educations ttus?"
Reply: "I’m currently doing my Bachelor’s in Software Engineering at Gandaki College of Engineering and Science, affiliated with Pokhara University."

User: "tell me about yourself"
Reply: "I’m Sudip Sharma, a Software Engineering student interested in full-stack development and learning through projects."

PERSONAL CONTEXT ABOUT SUDIP:
${context}

RECENT CONVERSATION:
${recentMessages}

USER MESSAGE:
"${message}"

FINAL INSTRUCTION:
Write only Sudip’s reply.
Keep it human, direct, and short by default.
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
      `chat:${sessionId}`,
      JSON.stringify({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }),
    );

    // Save AI response
    await this.redis.rpush(
      `chat:${sessionId}`,
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
