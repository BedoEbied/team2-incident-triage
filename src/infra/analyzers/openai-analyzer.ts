import OpenAI from 'openai';
import type { Analysis, Analyzer, GroupedIncident } from '../../domain/ports.js';
import {
  ANALYSIS_SCHEMA,
  SYSTEM_PROMPT,
  type AnalysisCache,
  buildUserPrompt,
  createFileAnalysisCache,
  validateAnalysis,
  withTimeoutRetry,
} from './shared.js';

/** Current general-purpose model from the official Responses API documentation. */
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6';

interface ResponsesClient {
  responses: {
    create(
      input: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<{
      status?: string;
      output_text?: string;
      output?: unknown[];
    }>;
  };
}

interface OpenAiAnalyzerOptions {
  client?: ResponsesClient;
  cache?: AnalysisCache;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export function createOpenAiAnalyzer(
  env: NodeJS.ProcessEnv = process.env,
  options: OpenAiAnalyzerOptions = {},
): Analyzer | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const client = options.client
    ?? new OpenAI({ apiKey }) as unknown as ResponsesClient;
  const cache = options.cache ?? createFileAnalysisCache('data/analysis-cache.json');
  const cacheKey = (group: GroupedIncident) => `openai:${model}:${group.fingerprint}:v1`;

  return {
    async analyze(group: GroupedIncident): Promise<Analysis> {
      const key = cacheKey(group);
      const hit = cache.get(key);
      if (hit) return hit;

      const analysis = await withTimeoutRetry(
        async (signal) => {
          const response = await client.responses.create(
            {
              model,
              store: false,
              input: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: buildUserPrompt(group) },
              ],
              text: {
                format: {
                  type: 'json_schema',
                  name: 'incident_analysis',
                  strict: true,
                  schema: ANALYSIS_SCHEMA,
                },
              },
            },
            { signal },
          );
          if (response.status && response.status !== 'completed') {
            throw Reflect.construct(Error, [`OpenAI response status was ${response.status}`]) as Error;
          }
          if (containsRefusal(response.output)) {
            throw Reflect.construct(Error, ['OpenAI refused the analysis']) as Error;
          }
          const content = response.output_text?.trim();
          if (!content) throw Reflect.construct(Error, ['OpenAI returned empty content']) as Error;
          const parsed = validateAnalysis(JSON.parse(content) as unknown);
          if (!parsed) throw Reflect.construct(Error, ['OpenAI response failed validation']) as Error;
          return parsed;
        },
        options.timeoutMs,
        options.retryDelayMs,
      );

      await cache.set(key, analysis);
      return analysis;
    },
  };
}

function containsRefusal(output: unknown[] | undefined): boolean {
  if (!output) return false;
  return JSON.stringify(output).includes('"type":"refusal"');
}
