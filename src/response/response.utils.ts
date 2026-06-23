import { gemini, openai, anthropic } from '@inngest/agent-kit';

/**
 * Utility factories to create Redis and model objects lazily.
 * These functions do NOT read process.env at import time. Instead
 * they accept keys/urls and return initialized objects. This lets
 * the Nest `ConfigService` provide env values at runtime and avoids
 * throwing during module import.
 */

export function createModels(keys: {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_API_KEY?: string;
}) {
  const {
    OPENAI_API_KEY: openAIKey,
    ANTHROPIC_API_KEY: anthropicKey,
    GEMINI_API_KEY: geminiKey,
    OPENROUTER_API_KEY: openRouterKey,
    GROQ_API_KEY: groqKey,
  } = keys || {};

  const models: Record<string, any> = {};
  if (openAIKey) {
    models.gpt4 = openai({ model: 'gpt-4o-mini', apiKey: openAIKey });
  }
  if (anthropicKey) {
    models.anthropic = anthropic({
      model: 'claude-sonnet-4-20250514',
      apiKey: anthropicKey,
      defaultParameters: { max_tokens: 1000 },
    });
  }
  if (geminiKey) {
    models.gemini = gemini({ model: 'gemini-2.5-flash', apiKey: geminiKey });
  }
  if (openRouterKey) {
    models.openRouter = openai({
      model: 'openai/gpt-4o',
      apiKey: openRouterKey,
      baseUrl: 'https://openrouter.ai/api/v1',
    });
  }
  if (groqKey) {
    models.groq = openai({
      model: 'llama-3.3-70b-versatile',
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
    });
  }

  const fallbackOrder: Array<{ model: any; modelName: string }> = [];
  if (models.groq) fallbackOrder.push({ model: models.groq, modelName: 'llama-3.3-70b-versatile' });
  if (models.openRouter) fallbackOrder.push({ model: models.openRouter, modelName: 'openai/gpt-4o' });
  if (models.gemini) fallbackOrder.push({ model: models.gemini, modelName: 'gemini-2.5-flash' });
  if (models.gpt4) fallbackOrder.push({ model: models.gpt4, modelName: 'gpt-4o-mini' });
  if (models.anthropic) fallbackOrder.push({ model: models.anthropic, modelName: 'claude-sonnet-4-20250514' });

  function getFallbackModel(index = 0) {
    if (index < fallbackOrder.length) return fallbackOrder[index].model;
    throw new RangeError(`No more models available in fallback order (index: ${index})`);
  }

  return { models, fallbackOrder, getFallbackModel };
}





