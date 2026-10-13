export type GenerationAvailability = { available: boolean; reason?: string };
export type GenerationProvider = { readonly id: string; readonly model: string; availability(): GenerationAvailability; generate(prompt: string): Promise<string> };
