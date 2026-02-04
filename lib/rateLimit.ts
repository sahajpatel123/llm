type RateWindow = {
  timestamps: number[];
};

const windowMs = 60_000;
const maxRequests = 20;
const rateMap = new Map<string, RateWindow>();

export function getRateLimitKey(req: Request, userId?: string | null) {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp || "unknown";
  return `ip:${ip}`;
}

export function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = rateMap.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    rateMap.set(key, entry);
    return false;
  }

  entry.timestamps.push(now);
  rateMap.set(key, entry);
  return true;
}
