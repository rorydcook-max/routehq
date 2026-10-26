"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type ThemeChoice } from "@/lib/theme";

/** Light, dark, or the same as the phone. Saved on this device and applied straight away. */
export function ThemePicker() {
  const t = useTranslations("accountPage");
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(currentTheme()), []);
  const options: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
    { value: "system", label: t("themeSystem"), Icon: Monitor },
    { value: "light", label: t("themeLight"), Icon: Sun },
    { value: "dark", label: t("themeDark"), Icon: Moon }
  ];
  return (
    <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("themeTitle")}>
      {options.map(({ value, label, Icon }) => {
        const on = choice === value;
        return (
          <button
            aria-checked={on}
            className={`pressable flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center font-bold ${on ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}
            key={value}
            onClick={() => {
              applyTheme(value);
              setChoice(value);
            }}
            role="radio"
            type="button"
          >
            <Icon size={22} />
            <span className="leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
