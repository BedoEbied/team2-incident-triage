import type { Analysis, Analyzer, GroupedIncident } from '../../domain/ports.js';
import { createClaudeCliAnalyzer } from './claude-cli-analyzer.js';
import { createOpenAiAnalyzer } from './openai-analyzer.js';
import { createRuleAnalyzer } from './rule-analyzer.js';

export interface ChainAnalyzer extends Analyzer {
  activeProviders: string[];
  describe(): string;
}

export function createChainAnalyzer(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: { openai?: Analyzer | null; claudeCli?: Analyzer | null; rules?: Analyzer },
): ChainAnalyzer {
  const providers: { name: string; analyzer: Analyzer }[] = [];

  const openai = overrides && 'openai' in overrides
    ? overrides.openai
    : createOpenAiAnalyzer(env);
  if (openai) providers.push({ name: 'openai', analyzer: openai });

  const claudeCli = overrides && 'claudeCli' in overrides
    ? overrides.claudeCli
    : createClaudeCliAnalyzer(env);
  if (claudeCli) providers.push({ name: 'claude-cli', analyzer: claudeCli });

  const rules = overrides?.rules ?? createRuleAnalyzer();
  providers.push({ name: 'rules', analyzer: rules });

  return {
    activeProviders: providers.map((provider) => provider.name),
    describe() {
      const primary = providers[0]?.name ?? 'rules';
      const fallbacks = providers.slice(1).map((provider) => provider.name);
      return fallbacks.length
        ? `Analyzer: ${primary} (fallback: ${fallbacks.join(', ')})`
        : `Analyzer: ${primary}`;
    },
    async analyze(group: GroupedIncident): Promise<Analysis> {
      let lastError: unknown;
      for (const provider of providers) {
        try {
          return await provider.analyzer.analyze(group);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : Reflect.construct(Error, ['All analyzers failed']) as Error;
    },
  };
}
