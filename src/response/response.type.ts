
interface AIOutput {
  role: string;
  type: string;
  content: string;
}

export interface AIResponse {
  agentName: string;
  output: AIOutput[];
  toolCalls?: unknown[];
  createdAt?: Date;
  prompt?: unknown[];
  history?: unknown[];
  raw?: unknown;
}