export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMProvider = {
  name: string;
  complete: (messages: ChatMessage[]) => Promise<string>;
};
