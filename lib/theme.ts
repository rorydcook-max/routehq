/**
 * Light or dark. The choice is a cookie (My account): "light", "dark", or none
 * for "System", which follows the phone or computer and changes with it.
 */
export const THEME_COOKIE = "routehq_theme";
export type ThemeChoice = "system" | "light" | "dark";

/**
 * Runs in <head> before anything is drawn, so a dark page never flashes white.
 * Printing is always light: the attribute is lifted for the print and put back.
 */
export const themeScript = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var q=window.matchMedia("(prefers-color-scheme: dark)");function set(){var t=m?m[1]:(q.matches?"dark":"light");if(t==="dark")d.setAttribute("data-theme","dark");else if(m)d.setAttribute("data-theme","light");else d.removeAttribute("data-theme");}set();if(!m&&q.addEventListener)q.addEventListener("change",function(){m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);set();});var saved;window.addEventListener("beforeprint",function(){saved=d.getAttribute("data-theme");d.removeAttribute("data-theme");});window.addEventListener("afterprint",function(){if(saved)d.setAttribute("data-theme",saved);});}catch(e){}})();`;

/** Saves the choice for a year and applies it straight away, without reloading the page. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  } else {
    document.cookie = `${THEME_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax`;
    root.setAttribute("data-theme", choice);
  }
}

/** The current choice, read in the browser. */
export function currentTheme(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return match ? (match[1] as ThemeChoice) : "system";
}
