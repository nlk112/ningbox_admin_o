"use client";

import { Client, daysLeft, fmtBytes, nameOf, usage } from "@/lib/clients";

type Alert = { c: Client; tone: "err" | "warn" | "info"; text: string };

function alerts(list: Client[]): Alert[] {
  const out: Alert[] = [];
  for (const c of list) {
    const p = usage(c);
    const d = daysLeft(c);
    if (!c.is_active) out.push({ c, tone: "err", text: p >= 1 ? `Выключен: израсходовал ${fmtBytes(c.used)} из ${fmtBytes(c.traffic_limit_bytes!)}` : d < 0 ? "Выключен: срок закончился" : "Доступ выключен" });
    else if (d < 0) out.push({ c, tone: "err", text: "Срок закончился" });
    else if (p >= 0.8) out.push({ c, tone: "warn", text: `Лимит израсходован на ${Math.round(p * 100)}%` });
    else if (d <= 7) out.push({ c, tone: "info", text: d < 1 ? "Срок закончится сегодня" : `Срок закончится через ${Math.ceil(d)} дн.` });
  }
  const rank = { err: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

export default function Overview({ clients, open, goClients }: { clients: Client[]; open: (c: Client) => void; goClients: () => void }) {
  const week = Date.now() - 7 * 86_400_000;
  const fresh = clients.filter((c) => new Date(c.created_at).getTime() > week).length;
  const active = clients.filter((c) => c.is_active).length;
  const online = clients.filter((c) => c.online).length;
  const down = clients.reduce((s, c) => s + c.down, 0);
  const up = clients.reduce((s, c) => s + c.up, 0);
  const top = [...clients].sort((a, b) => b.used - a.used).slice(0, 5);
  const max = top[0]?.used || 1;
  const att = alerts(clients);

  return (
    <>
      <section className="stats" aria-label="Сводка">
        <div className="stat"><div className="k">Клиентов всего</div><div className="v">{clients.length}</div><div className="s">{fresh ? `+${fresh} за неделю` : "новых за неделю нет"}</div></div>
        <div className="stat"><div className="k">Активны</div><div className="v">{active}</div><div className="s" style={active < clients.length ? { color: "var(--err-t)" } : undefined}>{active < clients.length ? `${clients.length - active} выключено` : "все включены"}</div></div>
        <div className="stat"><div className="k">Сейчас онлайн</div><div className="v"><span className="pulse" aria-hidden="true" />{online}</div><div className="s">за последние 2 минуты</div></div>
        <div className="stat"><div className="k">Трафик за всё время</div><div className="v">{fmtBytes(down + up)}</div><div className="s">↓ {fmtBytes(down)} · ↑ {fmtBytes(up)}</div></div>
      </section>

      <div className="cols">
        <section className="card">
          <div className="between"><h2 style={{ fontSize: 18 }}>Требуют внимания</h2><span className="muted">{att.length}</span></div>
          {att.length === 0 && <div className="empty">Всё спокойно</div>}
          {att.slice(0, 8).map(({ c, tone, text }) => (
            <button key={c.id} className={`alert ${tone}`} onClick={() => open(c)}>
              <span className="av">{nameOf(c)[0]?.toUpperCase()}</span>
              <span className="t"><b>{nameOf(c)}</b><span>{text}</span></span>
              <span className="go">Открыть →</span>
            </button>
          ))}
        </section>

        <section className="card" style={{ gap: 14 }}>
          <div className="between"><h2 style={{ fontSize: 18 }}>Больше всего трафика</h2><a href="#" onClick={(e) => { e.preventDefault(); goClients(); }} style={{ fontSize: 13, fontWeight: 700 }}>Все клиенты</a></div>
          {top.map((c) => (
            <button key={c.id} className="top-row" onClick={() => open(c)}>
              <div className="between" style={{ width: "100%" }}><b style={{ fontSize: 14 }}>{nameOf(c)}</b><span style={{ color: "var(--soft)" }}>{fmtBytes(c.used)}</span></div>
              <div className="bar" style={{ width: "100%" }}><div style={{ width: `${Math.max(2, (c.used / max) * 100)}%` }} /></div>
            </button>
          ))}
          {!top.length && <div className="empty">Пока пусто</div>}
        </section>
      </div>
    </>
  );
}
