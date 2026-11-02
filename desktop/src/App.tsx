import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Ellipsis, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { api, on, type Config, type Device, type Gesture, type Inspect, type PhoneApp, type SetupStep } from "./api";
import { APP_PREFIX, describe } from "./actions";
import { t } from "./i18n";
import { Picker } from "./Picker";
import { GestureGlyph, Stage, type Flash, type StageMode } from "./Stage";

type Phase = "tools" | "connect" | "unauthorized" | "loading" | "nokey" | "setup" | "learn" | "ready";
type Toast = { id: number; text: string; kind: "ok" | "error" };

const GESTURES: Gesture[] = ["single", "double", "hold"];
const STEPS: SetupStep["id"][] = ["install", "stock", "service", "ready"];

function needsSetup(i: Inspect) {
  return !i.installed || i.outdated || !i.stockDisabled || !i.serviceEnabled || !i.companion?.service;
}

export default function App() {
  const [tools, setTools] = useState<"checking" | "downloading" | "failed" | "ready">("checking");
  const [pct, setPct] = useState(0);
  const [devices, setDevices] = useState<Device[]>([]);
  const [serial, setSerial] = useState<string | null>(null);
  const [info, setInfo] = useState<Inspect | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  const [steps, setSteps] = useState<Partial<Record<SetupStep["id"], SetupStep>>>({});
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [pressed, setPressed] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [lit, setLit] = useState<Gesture | null>(null);

  const [picker, setPicker] = useState<Gesture | null>(null);
  const [apps, setApps] = useState<PhoneApp[] | null>(null);
  const [appsError, setAppsError] = useState(false);
  const appsLoading = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [uninstall, setUninstall] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const device = devices.find((d) => d.serial === serial);

  let phase: Phase;
  if (tools !== "ready") phase = "tools";
  else if (!device) phase = "connect";
  else if (device.state === "unauthorized") phase = "unauthorized";
  else if (device.state !== "device") phase = "connect";
  else if (!info) phase = "loading";
  else if (!info.hasKey) phase = "nokey";
  else if (needsSetup(info) || settingUp) phase = "setup";
  else if (!info.companion?.learned) phase = "learn";
  else phase = "ready";

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const appsRef = useRef(apps);
  appsRef.current = apps;

  const say = useCallback((text: string, kind: Toast["kind"] = "ok") => setToast({ id: Date.now(), text, kind }), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  // adb: reuse one if present, otherwise fetch Google's platform-tools once.
  const getTools = useCallback(async () => {
    if (await api.adbReady()) return setTools("ready");
    setTools("downloading");
    setPct(0);
    const stop = await on.adbProgress(setPct);
    try {
      await api.adbDownload();
      setTools("ready");
    } catch {
      setTools("failed");
    } finally {
      stop();
    }
  }, []);

  useEffect(() => {
    getTools();
  }, [getTools]);

  // Follow plugs and unplugs.
  useEffect(() => {
    if (tools !== "ready") return;
    let alive = true;
    const poll = async () => {
      try {
        const list = await api.devices();
        if (!alive) return;
        setDevices(list);
        setSerial((cur) => {
          if (cur && list.some((d) => d.serial === cur)) return cur;
          return (list.find((d) => d.state === "device") ?? list[0])?.serial ?? null;
        });
      } catch {
        /* adb server restarting: next tick */
      }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tools]);

  const refresh = useCallback(async (s: string) => {
    try {
      const next = await api.inspect(s);
      setInfo(next);
      if (next.companion) setConfig(next.companion.config);
      return next;
    } catch {
      return null;
    }
  }, []);

  const online = device?.state === "device" ? device.serial : null;

  useEffect(() => {
    setInfo(null);
    setConfig(null);
    setApps(null);
    setAppsError(false);
    setSteps({});
    setSetupError(null);
    setFlash(null);
    setPicker(null);
    if (online) refresh(online);
  }, [online, refresh]);

  const listening = phase === "learn" || phase === "ready";
  useEffect(() => {
    if (online && listening) api.watch(online).catch(() => {});
  }, [online, listening]);

  useEffect(() => {
    if (phase !== "learn" || !online) return;
    api.learn(online).catch(() => {});
    // Fallback in case a log line is missed.
    const id = setInterval(() => refresh(online), 2500);
    return () => clearInterval(id);
  }, [phase, online, refresh]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let flashTimer: ReturnType<typeof setTimeout>;
    on.phoneEvent((e) => {
      if (e.kind === "down") setPressed(true);
      else if (e.kind === "up") setPressed(false);
      else if (e.kind === "learned" && phaseRef.current === "learn") {
        setPressed(false);
        setInfo((i) => (i?.companion ? { ...i, companion: { ...i.companion, learned: true } } : i));
      } else if (e.kind === "gesture" && e.gesture && e.action) {
        const d = describe(e.action, appsRef.current);
        setFlash({ id: Date.now(), gesture: e.gesture, label: d.label, icon: d.icon, image: d.image, ok: e.ok ?? true });
        setLit(e.gesture);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => setLit(null), 1600);
      }
    }).then((s) => (stop = s));
    return () => {
      stop?.();
      clearTimeout(flashTimer);
    };
  }, []);

  const loadApps = useCallback(() => {
    if (!online || appsLoading.current || appsRef.current) return;
    appsLoading.current = true;
    setAppsError(false);
    api
      .apps(online)
      .then(setApps)
      .catch(() => setAppsError(true))
      .finally(() => (appsLoading.current = false));
  }, [online]);

  // App names for mappings that open an app.
  useEffect(() => {
    if (phase === "ready" && config && GESTURES.some((g) => config[g].startsWith(APP_PREFIX))) loadApps();
  }, [phase, config, loadApps]);

  const save = useCallback(
    async (next: Config) => {
      if (!online || !config) return;
      const prev = config;
      setConfig(next);
      try {
        await api.setConfig(online, next);
        say(t("map.saved"));
      } catch {
        setConfig(prev);
        say(t("map.failed"), "error");
      }
    },
    [online, config, say],
  );

  const pick = (id: string) => {
    if (!picker || !config) return;
    setPicker(null);
    if (id === "dnd" && info?.companion && !info.companion.dndAccess) say(t("map.dndHint"), "error");
    if (config[picker] !== id) save({ ...config, [picker]: id });
  };

  const runSetup = async () => {
    if (!online) return;
    setSettingUp(true);
    setSetupError(null);
    setSteps({});
    const stop = await on.setupStep((s) => setSteps((prev) => ({ ...prev, [s.id]: s })));
    try {
      await api.setup(online);
      await refresh(online);
    } catch (e) {
      setSetupError(String(e));
    } finally {
      stop();
      setSettingUp(false);
    }
  };

  const relearn = async () => {
    if (!online) return;
    setMenuOpen(false);
    try {
      await api.forget(online);
    } finally {
      await refresh(online);
    }
  };

  const restore = async () => {
    if (!online) return;
    setBusy(true);
    try {
      await api.restore(online, uninstall);
      setRestoreOpen(false);
      say(t("restore.done"));
      await refresh(online);
    } catch {
      say(t("restore.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest(".ekr-menu")) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const stageMode: StageMode =
    phase === "learn" ? "learn" : phase === "ready" ? "live" : phase === "setup" || phase === "nokey" ? "quiet" : "off";
  const deviceName = info?.name || device?.model || "";

  return (
    <div className="ekr-root">
      <header className="ekr-top">
        <h1 className="ekr-wordmark">Essential Key Remapper</h1>
        <div className="ekr-top__right">
          {device && (
            <div className={`ekr-device ekr-device--${device.state === "device" ? "on" : "wait"}`} title={device.serial}>
              <span className="ekr-device__dot" />
              {devices.length > 1 ? (
                <select value={serial ?? ""} onChange={(e) => setSerial(e.target.value)} aria-label="Phone">
                  {devices.map((d) => (
                    <option key={d.serial} value={d.serial}>
                      {d.serial === online && info?.name ? info.name : d.model || d.serial}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{deviceName || device.serial}</span>
              )}
            </div>
          )}
          {phase === "ready" && config && (
            <div className="ekr-menu">
              <button
                className="ekr-icon-btn"
                aria-label={t("menu.label")}
                title={t("menu.label")}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Ellipsis size={18} />
              </button>
              {menuOpen && (
                <div className="ekr-menu__list" role="menu">
                  <label className="ekr-menu__item ekr-menu__item--toggle">
                    <span>{t("menu.haptics")}</span>
                    <input
                      type="checkbox"
                      className="ekr-switch"
                      checked={config.haptics}
                      onChange={() => save({ ...config, haptics: !config.haptics })}
                    />
                  </label>
                  <button className="ekr-menu__item" role="menuitem" onClick={relearn}>
                    {t("menu.relearn")}
                  </button>
                  <button
                    className="ekr-menu__item ekr-menu__item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setRestoreOpen(true);
                    }}
                  >
                    {t("menu.restore")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="ekr-main">
        <aside className="ekr-left">
          <Stage mode={stageMode} pressed={pressed} flash={phase === "ready" ? flash : null} name={stageMode === "off" ? undefined : deviceName} />
        </aside>

        <section className="ekr-right" key={phase}>
          {phase === "tools" && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("tools.title")}</h2>
              {tools === "failed" ? (
                <>
                  <p className="ekr-error-text">{t("tools.failed")}</p>
                  <button className="ekr-btn" onClick={getTools}>{t("tools.retry")}</button>
                </>
              ) : (
                <>
                  <div className="ekr-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <p className="ekr-muted">{t("tools.note")}</p>
                </>
              )}
            </div>
          )}

          {phase === "connect" && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("connect.title")}</h2>
              <p className="ekr-lead">{t("connect.lead")}</p>
              <details className="ekr-help">
                <summary>{t("connect.help")}</summary>
                <ol className="ekr-steps">
                  <li>{t("connect.step1")}</li>
                  <li>{t("connect.step2")}</li>
                  <li>{t("connect.step3")}</li>
                </ol>
              </details>
            </div>
          )}

          {phase === "unauthorized" && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("auth.title")}</h2>
              <p className="ekr-lead">{t("auth.lead")}</p>
            </div>
          )}

          {phase === "loading" && (
            <div className="ekr-pane ekr-pane--center">
              <LoaderCircle className="ekr-spin" size={22} />
            </div>
          )}

          {phase === "nokey" && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("nokey.title")}</h2>
              <p className="ekr-lead">{t("nokey.lead")}</p>
            </div>
          )}

          {phase === "setup" && info && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("setup.title")}</h2>
              <p className="ekr-lead">{t("setup.lead")}</p>
              <ol className="ekr-checklist">
                {STEPS.map((id) => {
                  const s = steps[id];
                  return (
                    <li key={id} className={`ekr-check ekr-check--${s?.status ?? "todo"}`}>
                      <span className="ekr-check__mark">
                        {s?.status === "done" ? <Check size={14} strokeWidth={2.6} /> :
                          s?.status === "running" ? <LoaderCircle className="ekr-spin" size={14} /> :
                          s?.status === "failed" ? <X size={14} strokeWidth={2.6} /> : null}
                      </span>
                      <span>{t(`step.${id}`)}</span>
                    </li>
                  );
                })}
              </ol>
              {setupError && (
                <p className="ekr-error-text" title={setupError}>
                  <TriangleAlert size={15} /> {t("error.generic")}
                </p>
              )}
              <button className="ekr-btn" onClick={runSetup} disabled={settingUp}>
                {setupError ? t("setup.retry") : info.outdated ? t("setup.update") : t("setup.go")}
              </button>
            </div>
          )}

          {phase === "learn" && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("learn.title")}</h2>
              <p className="ekr-lead">{t("learn.lead")}</p>
            </div>
          )}

          {phase === "ready" && config && (
            <div className="ekr-pane">
              <h2 className="ekr-title">{t("map.title")}</h2>
              <ul className="ekr-gestures">
                {GESTURES.map((g) => {
                  const d = describe(config[g], apps);
                  const Icon = d.icon;
                  return (
                    <li key={g}>
                      <button className={`ekr-gesture${lit === g ? " is-lit" : ""}`} onClick={() => setPicker(g)}>
                        <GestureGlyph gesture={g} />
                        <span className="ekr-gesture__name">{t(`gesture.${g}`)}</span>
                        <span className={`ekr-gesture__action${config[g] === "none" ? " is-none" : ""}`}>
                          {d.image ? <img src={`data:image/webp;base64,${d.image}`} alt="" /> : <Icon size={17} strokeWidth={1.8} />}
                          <span>{d.label}</span>
                        </span>
                        <ChevronRight className="ekr-gesture__chev" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="ekr-muted">{t("map.live")}</p>
            </div>
          )}
        </section>
      </main>

      {picker && config && (
        <Picker
          gesture={picker}
          current={config[picker]}
          apps={apps}
          appsError={appsError}
          loadApps={loadApps}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}

      {restoreOpen && (
        <div className="ekr-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ekr-restore-title">
          <div className="ekr-sheet__scrim" onClick={() => !busy && setRestoreOpen(false)} />
          <div className="ekr-dialog__box">
            <h2 id="ekr-restore-title" className="ekr-dialog__title">{t("restore.title")}</h2>
            <p className="ekr-lead">{t("restore.lead")}</p>
            <label className="ekr-checkbox">
              <input type="checkbox" checked={uninstall} onChange={(e) => setUninstall(e.target.checked)} />
              <span>{t("restore.uninstall")}</span>
            </label>
            <div className="ekr-dialog__actions">
              <button className="ekr-btn ekr-btn--quiet" onClick={() => setRestoreOpen(false)} disabled={busy} autoFocus>
                {t("restore.cancel")}
              </button>
              <button className="ekr-btn ekr-btn--danger" onClick={restore} disabled={busy}>
                {busy && <LoaderCircle className="ekr-spin" size={15} />}
                {t("restore.go")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className={`ekr-toast ekr-toast--${toast.kind}`} role="status">
          {toast.kind === "ok" ? <Check size={15} strokeWidth={2.4} /> : <TriangleAlert size={15} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
