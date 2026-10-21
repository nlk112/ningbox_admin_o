import { ONLINE_MS, SUB_BASE } from "@/lib/clients";

export const COLS =
  "id, email, label, username, phone, mode, is_active, expires_at, traffic_limit_bytes, total_uplink_bytes, total_downlink_bytes, last_seen_at, created_at, sub_token";

export function shape(c: any) {
  const down = Number(c.total_downlink_bytes) || 0;
  const up = Number(c.total_uplink_bytes) || 0;
  const { sub_token, total_uplink_bytes, total_downlink_bytes, ...rest } = c;
  return {
    ...rest,
    traffic_limit_bytes: c.traffic_limit_bytes == null ? null : Number(c.traffic_limit_bytes),
    down,
    up,
    used: down + up,
    online: !!c.last_seen_at && Date.now() - new Date(c.last_seen_at).getTime() < ONLINE_MS,
    sub_url: sub_token ? SUB_BASE + sub_token : null,
  };
}
