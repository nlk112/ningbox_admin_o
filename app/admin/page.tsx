"use client";

import { useCallback, useEffect, useState } from "react";
import { Client } from "@/lib/clients";
import { Icon, Mark, Toaster, api, toast } from "@/components/ui";
import Overview from "@/components/Overview";
import Clients from "@/components/Clients";
import ClientDrawer from "@/components/ClientDrawer";
import NewClient from "@/components/NewClient";
import Notifications from "@/components/Notifications";

const TABS = [
  { id: "overview", title: "Обзор", icon: "grid" },
  { id: "clients", title: "Клиенты", icon: "user" },
  { id: "notifications", title: "Уведомления", icon: "bell" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClients((await api("/api/admin/clients")).clients);
      setUpdated(new Date());
    } catch (e: any) {
      toast(e.message);
      setClients((c) => c || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    addEventListener("hashchange", fromHash);
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    const t2 = setInterval(() => tick((n) => n + 1), 15_000);
    return () => { clearInterval(t); clearInterval(t2); removeEventListener("hashchange", fromHash); };
  }, [load]);

  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", "#" + t); scrollTo(0, 0); };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; };
  const open = (c: Client) => setOpenId(c.id);
  const current = clients?.find((c) => c.id === openId);
  const since = updated ? Math.round((Date.now() - updated.getTime()) / 60_000) : null;
  const title = TABS.find((t) => t.id === tab)!.title;

  return (
    <div className="shell">
      <nav className="side" aria-label="Разделы">
        <div className="brand"><span className="logo">N</span><span>Ningbox <small>admin</small></span></div>
        {TABS.map((t) => (
          <button key={t.id} className="nav" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} />{t.title}
            {t.id === "clients" && clients && <span className="count">{clients.length}</span>}
          </button>
        ))}
        <div className="side-foot">
          <Mark h={16} style={{ opacity: 0.45 }} />
          <button onClick={logout}>Выйти</button>
        </div>
      </nav>

      <main className="main">
        <header className="head">
          <div>
            <h1>{title}</h1>
            {tab !== "notifications" && <p>{since === null ? "Загрузка…" : since < 1 ? "Обновлено только что" : `Обновлено ${since} мин назад`}</p>}
          </div>
          {tab !== "notifications" && (
            <button className="btn" onClick={load} disabled={loading} aria-label="Обновить">
              <Mark h={12} eq on={loading} /><span className="txt">Обновить</span>
            </button>
          )}
          {tab !== "notifications" && <button className="btn primary" onClick={() => setCreating(true)}>+ Новый клиент</button>}

        </header>

        {clients === null ? (
          tab !== "notifications" && <div className="empty" style={{ padding: 60 }}><Mark h={22} eq on /></div>
        ) : tab === "overview" ? (
          <Overview clients={clients} open={open} goClients={() => go("clients")} />
        ) : tab === "clients" ? (
          <Clients clients={clients} open={open} reload={load} />
        ) : null}
        {tab === "notifications" && <Notifications />}

        <button className="mobile-logout" onClick={logout}>Выйти</button>
      </main>

      <nav className="tabbar" aria-label="Разделы">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={20} />{t.title}
          </button>
        ))}
      </nav>

      {current && <ClientDrawer key={current.id} c={current} onClose={() => setOpenId(null)} reload={load} />}
      {creating && <NewClient onClose={() => setCreating(false)} onCreated={load} />}
      <Toaster />
    </div>
  );
}
