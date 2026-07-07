const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const GOAL_LABELS = {
  THRUPLAY: 'Thruplays',
  VIDEO_VIEWS: 'Thruplays',
  LINK_CLICKS: 'Klikk',
  LEAD_GENERATION: 'Leads',
  OFFSITE_CONVERSIONS: 'Leads',
  POST_ENGAGEMENT: 'Engasjement',
};

function labelForGoal(goal) {
  return GOAL_LABELS[goal] || 'Resultater';
}

function extractActionValue(actions, types) {
  if (!actions) return 0;
  return actions
    .filter((a) => types.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

function resultForGoal(row, goal) {
  switch (goal) {
    case 'THRUPLAY':
    case 'VIDEO_VIEWS': {
      const thruplays = row.video_thruplay_watched_actions || [];
      return thruplays.reduce((sum, a) => sum + Number(a.value || 0), 0);
    }
    case 'LINK_CLICKS':
      return extractActionValue(row.actions, ['link_click']);
    case 'LEAD_GENERATION':
    case 'OFFSITE_CONVERSIONS':
      return extractActionValue(row.actions, [
        'lead',
        'offsite_conversion.fb_pixel_lead',
        'onsite_conversion.lead_grouped',
      ]);
    case 'POST_ENGAGEMENT':
      return extractActionValue(row.actions, ['post_engagement']);
    default:
      return extractActionValue(row.actions, ['link_click']);
  }
}

export async function getMetaAdsSummary() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    return { configured: false };
  }

  const acct = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const fields = [
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'spend',
    'clicks',
    'impressions',
    'actions',
    'video_thruplay_watched_actions',
  ].join(',');

  const insightsUrl =
    `${GRAPH_BASE}/${acct}/insights?level=adset&date_preset=last_7d&limit=200` +
    `&fields=${encodeURIComponent(fields)}&access_token=${token}`;
  const adsetsUrl =
    `${GRAPH_BASE}/${acct}/adsets?fields=id,name,optimization_goal&limit=500&access_token=${token}`;

  const [insightsRes, adsetsRes] = await Promise.all([
    fetch(insightsUrl).then((r) => r.json()),
    fetch(adsetsUrl).then((r) => r.json()),
  ]);

  if (insightsRes.error) throw new Error(`Meta insights: ${insightsRes.error.message}`);
  if (adsetsRes.error) throw new Error(`Meta adsets: ${adsetsRes.error.message}`);

  const goalByAdset = new Map((adsetsRes.data || []).map((a) => [a.id, a.optimization_goal]));

  const rows = (insightsRes.data || []).map((row) => {
    const goal = goalByAdset.get(row.adset_id) || 'UNKNOWN';
    const result = resultForGoal(row, goal);
    return {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      resultLabel: labelForGoal(goal),
      spend: Number(row.spend || 0),
      result,
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
    };
  });

  const byCampaign = new Map();
  for (const row of rows) {
    if (!byCampaign.has(row.campaignId)) {
      byCampaign.set(row.campaignId, {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        resultLabel: row.resultLabel,
        spend: 0,
        result: 0,
        clicks: 0,
        impressions: 0,
      });
    }
    const c = byCampaign.get(row.campaignId);
    c.spend += row.spend;
    c.result += row.result;
    c.clicks += row.clicks;
    c.impressions += row.impressions;
  }

  const campaigns = [...byCampaign.values()]
    .map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      resultLabel: c.resultLabel,
      spend: Number(c.spend.toFixed(2)),
      result: Math.round(c.result),
      clicks: c.clicks,
      ctr: c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0,
      costPerResult: c.result > 0 ? Number((c.spend / c.result).toFixed(2)) : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

  return {
    configured: true,
    accountId: acct,
    periodLabel: 'Siste 7 dager',
    totalSpend: Number(totalSpend.toFixed(2)),
    campaigns,
  };
}
