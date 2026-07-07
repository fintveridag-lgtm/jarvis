import { getClaudeData } from './claude-data.js';

// Kontotall kan ikke hentes live uten bank-API-avtale (PSD2). I stedet leses
// de fra data/claude-data.json (feltet "account"), som morgenrutinen — eller
// eieren manuelt — kan oppdatere. Eksempel:
//   "account": {
//     "currency": "kr",
//     "accounts": [
//       { "name": "Brukskonto", "balance": 12345.67 },
//       { "name": "Sparekonto", "balance": 50000 }
//     ],
//     "updated": "2026-07-07"
//   }
export async function getAccount() {
  const data = await getClaudeData();
  const account = data?.account;
  if (!account || !Array.isArray(account.accounts) || !account.accounts.length) {
    return { configured: false };
  }
  const total = account.accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  return {
    configured: true,
    currency: account.currency || 'kr',
    accounts: account.accounts,
    total,
    updated: account.updated || null,
  };
}
