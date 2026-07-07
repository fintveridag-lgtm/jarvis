import { getMetaAdsSummary } from './meta-ads.js';
import { getInstagramSummary } from './instagram.js';
import { getClientPerformance } from './client-performance.js';
import { getClaudeData } from './claude-data.js';
import { cached } from './cache.js';

export async function aggregateData() {
  const [metaAds, instagram, clientPerformance, claudeData] = await Promise.all([
    cached('meta-ads', 60_000, getMetaAdsSummary).catch((err) => ({
      configured: true,
      error: err.message,
    })),
    cached('instagram', 60_000, getInstagramSummary).catch((err) => ({
      configured: true,
      error: err.message,
    })),
    cached('client-perf', 60_000, getClientPerformance).catch((err) => ({ error: err.message })),
    getClaudeData(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metaAds,
    instagram,
    clientPerformance,
    notion: claudeData?.notion || null,
    worldStage: claudeData?.worldStage || null,
    gmail: claudeData?.gmail || null,
    claudeDataAvailable: Boolean(claudeData),
    claudeDataGeneratedAt: claudeData?.generatedAt || null,
  };
}
