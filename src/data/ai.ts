import { isDemoMode, supabase } from './client';

export interface AiOutput {
  id: string;
  output_type: string;
  model: string | null;
  content_md: string | null;
  created_at: string;
}

export class AiError extends Error {}

export async function generateAi(input: {
  type: string; cycleId: string; locale: string; scopeRef?: number; bilingual?: boolean;
}): Promise<AiOutput> {
  if (isDemoMode) throw new AiError('demo_mode');
  const { data, error } = await supabase().functions.invoke('ai-generate', { body: input });
  if (error) {
    let code = 'ai_failed';
    try {
      code = (await (error as { context: Response }).context.json()).code ?? code;
    } catch {
      // Falls back to the generic message.
    }
    throw new AiError(code);
  }
  return data as AiOutput;
}

export async function listAiOutputs(cycleId: string): Promise<AiOutput[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase().from('ai_outputs')
    .select('id, output_type, model, content_md, created_at')
    .eq('cycle_id', cycleId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}
