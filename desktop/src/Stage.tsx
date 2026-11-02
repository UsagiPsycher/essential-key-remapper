import type { LucideIcon } from "lucide-react";
import { t } from "./i18n";
import type { Gesture } from "./api";

export type StageMode = "off" | "learn" | "live" | "quiet";

export interface Flash {
  id: number;
  gesture: Gesture;
  label: string;
  icon: LucideIcon;
  image?: string;
  ok: boolean;
}

/** The phone drawn in profile of its keys; it mirrors the real key as it is pressed. */
export function Stage({ mode, pressed, flash, name }: {
  mode: StageMode;
  pressed: boolean;
  flash: Flash | null;
  name?: string;
}) {
  const Icon = flash?.icon;
  let caption = "";
  if (mode === "off") caption = t("stage.notPlugged");
  else if (mode === "live") caption = flash && !flash.ok ? t("stage.failed") : t("stage.idle");

  return (
    <div className={`ekr-stage ekr-stage--${mode}`}>
      <div className={`ekr-phone${pressed ? " is-pressed" : ""}`}>
        <span className="ekr-phone__power" aria-hidden />
        <span className="ekr-phone__key" aria-hidden>
          {pressed && <span className="ekr-phone__ripple" />}
        </span>
        <span className="ekr-cable" aria-hidden>
          <span className="ekr-cable__plug" />
        </span>
        <div className="ekr-phone__screen">
          {flash && Icon && (
            <div key={flash.id} className={`ekr-flash${flash.ok ? "" : " is-failed"}`}>
              {flash.image ? (
                <img className="ekr-flash__img" src={`data:image/webp;base64,${flash.image}`} alt="" />
              ) : (
                <Icon className="ekr-flash__icon" strokeWidth={1.6} />
              )}
              <span className="ekr-flash__label">{flash.label}</span>
              <span className="ekr-flash__gesture">{t(`gesture.${flash.gesture}`)}</span>
            </div>
          )}
        </div>
      </div>
      <p className="ekr-stage__name">{name}</p>
      <p className="ekr-stage__caption" aria-live="polite">{caption}</p>
    </div>
  );
}

export function GestureGlyph({ gesture }: { gesture: Gesture }) {
  return (
    <span className={`ekr-glyph ekr-glyph--${gesture}`} aria-hidden>
      <i />
      {gesture === "double" && <i />}
    </span>
  );
}
