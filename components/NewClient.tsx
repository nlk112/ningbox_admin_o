"use client";

import { useState } from "react";
import { Client, fmtPhone, happLink, nameOf } from "@/lib/clients";
import { Icon, Qr, api, copy, useEsc } from "./ui";

const LIMITS = [["", "Без лимита"], ["5", "5 ГБ"], ["50", "50 ГБ"], ["1024", "1 ТБ"]];
const TERMS = [[0, "Бессрочно"], [1, "1 месяц"], [3, "3 месяца"]] as const;

export default function NewClient({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [limit, setLimit] = useState("");
  const [custom, setCustom] = useState("");
  const [months, setMonths] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ client: Client; password: string } | null>(null);
  useEsc(onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const limit_gb = custom ? parseFloat(custom.replace(",", ".")) : limit ? Number(limit) : null;
      const res = await api("/api/admin/clients", "POST", { phone, label, limit_gb, months });
      setDone(res);
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop modal-wrap" onClick={onClose}>
      {done ? (
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="between" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 22 }}>{nameOf(done.client)} добавлен</h2>
            <button className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>
          {done.client.sub_url && (
            <div className="row" style={{ alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
              <Qr text={happLink(done.client)!} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="hint" style={{ fontWeight: 700 }}>{done.client.sub_crypt ? "Криптоссылка Happ 🔐" : "Ссылка для Happ"}</div>
                <code className="code" style={{ maxHeight: 64, overflow: "hidden" }}>{happLink(done.client)}</code>
                <div className="row">
                  <button className="btn primary sm" onClick={() => copy(happLink(done.client)!, "Ссылка скопирована")}>Копировать</button>
                  {done.client.sub_crypt && <button className="btn sm" onClick={() => copy(done.client.sub_url!, "Обычная ссылка скопирована")}>обычная</button>}
                </div>
              </div>
            </div>
          )}
          <div className="section" style={{ gap: 6 }}>
            <div className="hint">Вход в Ningbox</div>
            <div>логин: <span className="secret">{done.client.username}</span></div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>пароль: <span className="secret">{done.password}</span></span>
              <button className="btn sm" onClick={() => copy(`${done.client.username} / ${done.password}`, "Логин и пароль скопированы")}>Копировать</button>
            </div>
            <div className="hint">Пароль показывается один раз. Потом можно сменить в карточке.</div>
          </div>
          <div className="note">Номер {fmtPhone(done.client.phone)} уже работает на сайте. В VPN человек появится примерно через минуту.</div>
          <button className="btn primary" onClick={onClose}>Готово</button>
        </div>
      ) : (
        <form className="modal" aria-label="Новый клиент" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
          <div className="between" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 22 }}>Новый клиент</h2>
            <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="x" size={15} /></button>
          </div>

          <div className="field">
            <label className="lbl" htmlFor="ph">Номер телефона</label>
            <input id="ph" className="input" type="tel" autoFocus required placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <span className="hint">По нему человек получит ссылку на сайте. Он же станет логином в Ningbox.</span>
          </div>

          <div className="field">
            <label className="lbl" htmlFor="nm">Имя</label>
            <input id="nm" className="input" placeholder="Как подписать в списке" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lbl" style={{ marginBottom: 8 }}>Лимит трафика</legend>
            <div className="row">
              {LIMITS.map(([v, l]) => (
                <button key={l} type="button" className="chip" aria-pressed={!custom && limit === v} onClick={() => { setLimit(v); setCustom(""); }}>{l}</button>
              ))}
              <input className="input sm" style={{ width: 110 }} inputMode="decimal" placeholder="своё, ГБ" aria-label="Свой лимит в ГБ" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lbl" style={{ marginBottom: 8 }}>Срок доступа</legend>
            <div className="row">
              {TERMS.map(([v, l]) => (
                <button key={l} type="button" className="chip" aria-pressed={months === v} onClick={() => setMonths(v)}>{l}</button>
              ))}
            </div>
          </fieldset>

          {err ? <div className="note err">{err}</div> : <div className="note">После создания сразу покажем ссылку Happ и QR.</div>}

          <div className="row" style={{ flexWrap: "nowrap" }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>Отмена</button>
            <button type="submit" className="btn primary" style={{ flex: 2 }} disabled={busy}>{busy ? "Создаю…" : "Создать клиента"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
