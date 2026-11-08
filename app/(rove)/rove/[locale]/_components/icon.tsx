import type { CSSProperties } from "react";
import { ICON_PATHS, type IconName } from "./icon-paths";
import { PathIcon } from "./path-icon";

export type { IconName };

/** A Tabler icon by name, drawn inline (path-icon.tsx). For server components; client ones use PathIcon. */
export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <PathIcon className={className} d={ICON_PATHS[name]} style={style} />;
}
