// Scripted phone for previewing the UI in a browser: ?scene=<name>&click=<css>,<css>
type Handler = (e: { payload: unknown }) => void;
const handlers = new Map<string, Set<Handler>>();
const emit = (name: string, payload: unknown) => handlers.get(name)?.forEach((h) => h({ payload }));

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? "ready";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const config = { single: "torch", double: "app:com.spotify.music", hold: "none", haptics: true };
const dot = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=";
const apps = ["Agenda", "Appareil photo", "Calculatrice", "Chrome", "Gmail", "Maps", "Messages", "Photos", "Spotify", "WhatsApp"]
  .map((label) => ({ pkg: label === "Spotify" ? "com.spotify.music" : `com.example.${label.toLowerCase()}`, label, icon: dot }));

const learned = !["learn", "setup", "setup-running"].includes(scene);
const inspect = {
  name: "Phone (3a)",
  manufacturer: "Nothing",
  android: "16",
  hasKey: scene !== "nokey",
  installed: !scene.startsWith("setup"),
  outdated: false,
  stockDisabled: !scene.startsWith("setup"),
  serviceEnabled: !scene.startsWith("setup"),
  companion: scene.startsWith("setup") ? null : { versionCode: 1, service: true, learning: false, learned, scanCode: 250, dndAccess: true, config },
};

export async function mockInvoke<T>(cmd: string, _args?: unknown): Promise<T> {
  const r = await (async (): Promise<unknown> => {
    switch (cmd) {
      case "adb_ready": return scene !== "tools";
      case "adb_download": await new Promise(() => {}); return;
      case "devices":
        if (scene === "connect") return [];
        return [{ serial: "A059XYZ", state: scene === "unauthorized" ? "unauthorized" : "device", model: "A059" }];
      case "inspect": return inspect;
      case "apps": await wait(200); return apps;
      case "setup":
        emit("setup-step", { id: "install", status: "done" });
        emit("setup-step", { id: "stock", status: "done" });
        emit("setup-step", { id: "service", status: "running" });
        await new Promise(() => {});
        return;
      default: return;
    }
  })();
  return r as T;
}

export async function mockListen<T>(name: string, h: (e: { payload: T }) => void) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(h as Handler);
  return () => void handlers.get(name)!.delete(h as Handler);
}

if (scene === "tools") setTimeout(() => emit("adb-progress", 62), 300);
if (scene === "flash") {
  // Headless captures freeze CSS animations at their first frame.
  document.head.insertAdjacentHTML("beforeend", "<style>.ekr-flash{animation:none!important}</style>");
  setTimeout(() => emit("phone-event", { kind: "down" }), 6400);
  setTimeout(() => emit("phone-event", { kind: "gesture", gesture: "single", action: "torch", ok: true }), 6500);
}

// Clicks, in order, once the page has settled.
const clicks = (params.get("click") ?? "").split(",").filter(Boolean);
(async () => {
  for (const sel of clicks) {
    await wait(500);
    document.querySelector<HTMLElement>(sel)?.click();
  }
})();
