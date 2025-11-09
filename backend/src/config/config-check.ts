export function getConfigHealth() {
  const env = process.env as any;
  const required = [
    'BINANCE_API_KEY',
    'BINANCE_SECRET_KEY',
    'OKX_API_KEY',
    'OKX_API_SECRET',
    // optional passphrase
    'DERIBIT_API_KEY',
    'DERIBIT_API_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'DISCORD_WEBHOOK_URL'
  ];
  const optional = [
    'OKX_API_PASSPHRASE',
    'BINANCE_TESTNET',
    'OKX_DEFAULT_TYPE',
    'RATE_LIMIT_API',
    'RATE_LIMIT_EXECUTE'
  ];
  const present = required.filter(k => !!env[k]);
  const missing = required.filter(k => !env[k]);
  return {
    present,
    missing,
    optionalPresent: optional.filter(k => !!env[k]),
    optionalMissing: optional.filter(k => !env[k]),
    ok: missing.length === 0
  };
}


