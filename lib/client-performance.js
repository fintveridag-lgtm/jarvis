const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function fetchClientMTD(accountId, token) {
  const acct = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const fields = ['spend', 'action_values', 'purchase_roas'].join(',');
  const url =
    `${GRAPH_BASE}/${acct}/insights?date_preset=this_month&time_increment=1` +
    `&fields=${encodeURIComponent(fields)}&access_token=${token}`;

  const res = await fetch(url).then((r) => r.json());
  if (res.error) throw new Error(res.error.message);

  const days = (res.data || []).map((row) => {
    const spend = Number(row.spend || 0);
    const salesEntry = (row.action_values || []).find(
      (a) => a.action_type === 'omni_purchase' || a.action_type === 'purchase'
    );
    const sales = salesEntry ? Number(salesEntry.value) : 0;
    const roasEntry = (row.purchase_roas || []).find(
      (a) => a.action_type === 'omni_purchase' || a.action_type === 'purchase'
    );
    const roas = roasEntry ? Number(roasEntry.value) : spend > 0 ? sales / spend : 0;
    return { date: row.date_start, spend, sales, roas: Number(roas.toFixed(2)) };
  });

  const totalSpend = days.reduce((sum, d) => sum + d.spend, 0);
  const totalSales = days.reduce((sum, d) => sum + d.sales, 0);
  const roas = totalSpend > 0 ? totalSales / totalSpend : 0;

  return {
    configured: true,
    totalSpend: Number(totalSpend.toFixed(2)),
    totalSales: Number(totalSales.toFixed(2)),
    roas: Number(roas.toFixed(2)),
    days,
  };
}

export async function getClientPerformance() {
  const token = process.env.META_ACCESS_TOKEN;
  const clients = [
    {
      key: 'clientA',
      name: process.env.CLIENT_A_NAME || 'Klient A',
      accountId: process.env.CLIENT_A_AD_ACCOUNT_ID,
    },
    {
      key: 'clientB',
      name: process.env.CLIENT_B_NAME || 'Klient B',
      accountId: process.env.CLIENT_B_AD_ACCOUNT_ID,
    },
  ];

  const results = {};
  for (const c of clients) {
    if (!token || !c.accountId) {
      results[c.key] = { configured: false, name: c.name };
      continue;
    }
    try {
      const data = await fetchClientMTD(c.accountId, token);
      results[c.key] = { ...data, name: c.name };
    } catch (err) {
      results[c.key] = { configured: true, error: err.message, name: c.name };
    }
  }
  return results;
}
