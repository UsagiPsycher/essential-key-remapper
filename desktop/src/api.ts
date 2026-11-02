import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { mockInvoke, mockListen } from "./mock";

// Outside the desktop shell (plain browser), a scripted phone stands in for adb.
const inTauri = "__TAURI_INTERNALS__" in window;
const invoke = inTauri ? tauriInvoke : mockInvoke;
const listen = inTauri ? tauriListen : mockListen;

export type Gesture = "single" | "double" | "hold";

export interface Config {
  single: string;
  double: string;
  hold: string;
  haptics: boolean;
}

export interface Device {
  serial: string;
  state: string;
  model: string;
}

export interface CompanionState {
  versionCode: number;
  service: boolean;
  learning: boolean;
  learned: boolean;
  scanCode: number;
  dndAccess: boolean;
  config: Config;
}

export interface Inspect {
  name: string;
  manufacturer: string;
  android: string;
  hasKey: boolean;
  installed: boolean;
  outdated: boolean;
  stockDisabled: boolean;
  serviceEnabled: boolean;
  companion: CompanionState | null;
}

export interface PhoneApp {
  pkg: string;
  label: string;
  icon: string;
}

export interface PhoneEvent {
  kind: "down" | "up" | "learned" | "service" | "gesture";
  gesture?: Gesture;
  action?: string;
  ok?: boolean;
}

export interface SetupStep {
  id: "install" | "stock" | "service" | "ready";
  status: "running" | "done" | "failed";
  error?: string;
}

export const api = {
  adbReady: () => invoke<boolean>("adb_ready"),
  adbDownload: () => invoke<void>("adb_download"),
  devices: () => invoke<Device[]>("devices"),
  inspect: (serial: string) => invoke<Inspect>("inspect", { serial }),
  setup: (serial: string) => invoke<void>("setup", { serial }),
  setConfig: (serial: string, config: Config) => invoke<void>("set_config", { serial, config }),
  learn: (serial: string) => invoke<void>("learn", { serial }),
  forget: (serial: string) => invoke<void>("forget", { serial }),
  apps: (serial: string) => invoke<PhoneApp[]>("apps", { serial }),
  restore: (serial: string, uninstall: boolean) => invoke<void>("restore", { serial, uninstall }),
  watch: (serial: string) => invoke<void>("watch", { serial }),
};

export const on = {
  adbProgress: (cb: (pct: number) => void) => listen<number>("adb-progress", (e) => cb(e.payload)),
  setupStep: (cb: (s: SetupStep) => void) => listen<SetupStep>("setup-step", (e) => cb(e.payload)),
  phoneEvent: (cb: (e: PhoneEvent) => void) => listen<PhoneEvent>("phone-event", (e) => cb(e.payload)),
};
