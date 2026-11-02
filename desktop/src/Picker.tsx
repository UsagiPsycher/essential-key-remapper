import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react";
import { t } from "./i18n";
import { APP_PREFIX, AppIcon, GROUPS, NONE, NoneIcon } from "./actions";
import type { Gesture, PhoneApp } from "./api";
import { GestureGlyph } from "./Stage";

export function Picker({ gesture, current, apps, appsError, loadApps, onPick, onClose }: {
  gesture: Gesture;
  current: string;
  apps: PhoneApp[] | null;
  appsError: boolean;
  loadApps: () => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"actions" | "apps">(current.startsWith(APP_PREFIX) ? "apps" : "actions");
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (view === "apps") {
      loadApps();
      search.current?.focus();
    } else {
      const tiles = panel.current;
      (tiles?.querySelector<HTMLButtonElement>(".ekr-tile.is-current") ?? tiles?.querySelector<HTMLButtonElement>(".ekr-tile"))?.focus();
    }
  }, [view, loadApps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps ?? []).filter((a) => !q || a.label.toLowerCase().includes(q) || a.pkg.includes(q));
  }, [apps, query]);

  const currentApp = current.startsWith(APP_PREFIX) ? current.slice(APP_PREFIX.length) : null;

  return (
    <div className="ekr-sheet" role="dialog" aria-modal="true" aria-label={t("picker.title")}>
      <div className="ekr-sheet__scrim" onClick={onClose} />
      <div className="ekr-sheet__panel" ref={panel}>
        <header className="ekr-sheet__head">
          {view === "apps" ? (
            <button className="ekr-icon-btn" onClick={() => setView("actions")} aria-label={t("picker.back")} title={t("picker.back")}>
              <ArrowLeft size={18} />
            </button>
          ) : (
            <GestureGlyph gesture={gesture} />
          )}
          <h2 className="ekr-sheet__title">{view === "apps" ? t("action.app") : t(`gesture.${gesture}`)}</h2>
          <button className="ekr-icon-btn" onClick={onClose} aria-label={t("picker.close")} title={t("picker.close")}>
            <X size={18} />
          </button>
        </header>

        {view === "actions" ? (
          <div className="ekr-sheet__body">
            <button className={`ekr-tile ekr-tile--wide${current === NONE ? " is-current" : ""}`} onClick={() => onPick(NONE)}>
              <NoneIcon size={18} strokeWidth={1.8} />
              <span>{t("action.none")}</span>
              {current === NONE && <Check className="ekr-tile__check" size={16} />}
            </button>
            {GROUPS.map((group) => (
              <section key={group.title} className="ekr-group">
                <h3 className="ekr-group__title">{t(group.title)}</h3>
                <div className="ekr-tiles">
                  {group.actions.map(({ id, icon: Icon, tip }) => (
                    <button
                      key={id}
                      className={`ekr-tile${current === id ? " is-current" : ""}`}
                      onClick={() => onPick(id)}
                      title={tip ? t(tip) : undefined}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{t(`action.${id}` as never)}</span>
                      {current === id && <Check className="ekr-tile__check" size={16} />}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <section className="ekr-group">
              <h3 className="ekr-group__title">{t("group.apps")}</h3>
              <button className={`ekr-tile ekr-tile--wide${currentApp ? " is-current" : ""}`} onClick={() => setView("apps")}>
                <AppIcon size={18} strokeWidth={1.8} />
                <span>{t("action.app")}</span>
                <ChevronRight className="ekr-tile__check" size={16} />
              </button>
            </section>
          </div>
        ) : (
          <div className="ekr-sheet__body ekr-sheet__body--apps">
            <label className="ekr-search">
              <Search size={16} />
              <input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("picker.search")} />
            </label>
            {apps === null && !appsError && <p className="ekr-muted">{t("picker.loading")}</p>}
            {appsError && <p className="ekr-error-text">{t("picker.appsFailed")}</p>}
            {apps && filtered.length === 0 && <p className="ekr-muted">{t("picker.noApps")}</p>}
            <ul className="ekr-apps">
              {filtered.map((app) => (
                <li key={app.pkg}>
                  <button className={`ekr-app${currentApp === app.pkg ? " is-current" : ""}`} onClick={() => onPick(APP_PREFIX + app.pkg)} title={app.pkg}>
                    <img src={`data:image/webp;base64,${app.icon}`} alt="" />
                    <span>{app.label}</span>
                    {currentApp === app.pkg && <Check className="ekr-tile__check" size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
