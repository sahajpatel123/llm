type RateWindow = {
  timestamps: number[];
};

const windowMs = 60_000;
const maxRequests = 20;
const rateMap = new Map<string, RateWindow>();

export function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = rateMap.get(userId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    rateMap.set(userId, entry);
    return false;
  }

  entry.timestamps.push(now);
  rateMap.set(userId, entry);
  return true;
}
