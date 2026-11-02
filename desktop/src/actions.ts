import {
  AppWindow, Ban, Bell, Camera, Flashlight, Layers, Lock, type LucideIcon, Mic, MoonStar, Play,
  Power, ScanLine, SkipForward, SlidersHorizontal, Vibrate,
} from "lucide-react";
import { t, type Key } from "./i18n";
import type { PhoneApp } from "./api";

export interface ActionDef {
  id: string;
  icon: LucideIcon;
  tip?: Key;
}

export const GROUPS: { title: Key; actions: ActionDef[] }[] = [
  {
    title: "group.shortcuts",
    actions: [
      { id: "torch", icon: Flashlight, tip: "tip.torch" },
      { id: "camera", icon: Camera, tip: "tip.camera" },
      { id: "screenshot", icon: ScanLine },
      { id: "assistant", icon: Mic, tip: "tip.assistant" },
    ],
  },
  {
    title: "group.system",
    actions: [
      { id: "lock", icon: Lock },
      { id: "notifications", icon: Bell },
      { id: "quick_settings", icon: SlidersHorizontal },
      { id: "recents", icon: Layers },
      { id: "power_menu", icon: Power },
    ],
  },
  {
    title: "group.sound",
    actions: [
      { id: "play_pause", icon: Play },
      { id: "next_track", icon: SkipForward },
      { id: "vibrate_mode", icon: Vibrate, tip: "tip.vibrate_mode" },
      { id: "dnd", icon: MoonStar, tip: "tip.dnd" },
    ],
  },
];

const BY_ID = new Map(GROUPS.flatMap((g) => g.actions).map((a) => [a.id, a]));

export const NONE = "none";
export const APP_PREFIX = "app:";
export const NoneIcon = Ban;
export const AppIcon = AppWindow;

/** How an action id reads in the UI, given the apps known so far. */
export function describe(id: string, apps: PhoneApp[] | null) {
  if (id.startsWith(APP_PREFIX)) {
    const pkg = id.slice(APP_PREFIX.length);
    const app = apps?.find((a) => a.pkg === pkg);
    return { label: app?.label ?? pkg, icon: AppWindow, image: app?.icon };
  }
  const def = BY_ID.get(id);
  if (!def) return { label: t("action.none"), icon: Ban, image: undefined };
  return { label: t(`action.${id}` as Key), icon: def.icon, image: undefined };
}
