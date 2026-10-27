import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * A setting that is enabled or disabled: a switch, its name on the same line (centred on it), and an
 * optional line below saying what it does. Works in plain forms (name/value/defaultChecked) and
 * controlled (checked/onChange). Used wherever a setting is switched on and off.
 */
export function SwitchField({
  label,
  description,
  className = "",
  labelClassName = "text-[16px] font-bold text-[var(--foreground)]",
  ...input
}: { label: ReactNode; description?: ReactNode; className?: string; labelClassName?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className={`block cursor-pointer ${className}`}>
      {/* The switch is as tall as one line of the label (24px), so lining up their tops centres it on the
          first line, however many lines the label wraps to. */}
      <span className="flex items-start gap-3 py-2">
        <input {...input} className="switch" role="switch" type="checkbox" />
        <span className={`min-w-0 leading-6 ${labelClassName}`}>{label}</span>
      </span>
      {description ? <span className="mt-0.5 block ps-[54px] font-medium text-[var(--foreground-secondary)]">{description}</span> : null}
    </label>
  );
}
