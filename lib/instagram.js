const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function unixDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return Math.floor(d.getTime() / 1000);
}

export async function getInstagramSummary() {
  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !igUserId) {
    return { configured: false };
  }

  const basicUrl = `${GRAPH_BASE}/${igUserId}?fields=followers_count,media_count&access_token=${token}`;
  const basicRes = await fetch(basicUrl).then((r) => r.json());
  if (basicRes.error) throw new Error(`Instagram: ${basicRes.error.message}`);

  const since = unixDaysAgo(7);
  const until = Math.floor(Date.now() / 1000);
  const insightsUrl =
    `${GRAPH_BASE}/${igUserId}/insights?metric=reach,profile_views,total_interactions` +
    `&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${token}`;

  try {
    const insightsRes = await fetch(insightsUrl).then((r) => r.json());
    if (insightsRes.error) throw new Error(insightsRes.error.message);

    const metrics = {};
    for (const item of insightsRes.data || []) {
      metrics[item.name] = item.total_value?.value ?? 0;
    }

    return {
      configured: true,
      mode: 'full',
      periodLabel: 'Siste 7 dager',
      reach: metrics.reach || 0,
      profileVisits: metrics.profile_views || 0,
      interactions: metrics.total_interactions || 0,
      followers: basicRes.followers_count || 0,
    };
  } catch (err) {
    return {
      configured: true,
      mode: 'basic',
      note: 'Manglende scope "instagram_manage_insights" — viser kun grunnleggende tall.',
      followers: basicRes.followers_count || 0,
      mediaCount: basicRes.media_count || 0,
    };
  }
}
