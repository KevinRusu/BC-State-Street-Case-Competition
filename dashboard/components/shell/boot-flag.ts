// The startup screen's session flag, kept out of boot-screen.tsx on purpose: the root layout (a Server Component)
// needs the script text itself, and every export of a "use client" file reaches the server only as a client reference.

export const BOOT_KEY = "dfe-boot-seen";

// Runs in <head> before first paint. When this browser session has already seen the startup screen, it flags <html>
// so the CSS rule in globals.css hides the server-rendered screen and the dashboard never flashes behind it.
// Blocked storage throws; the screen then simply plays.
export const BOOT_FLAG_SCRIPT = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(BOOT_KEY)}))document.documentElement.dataset.booted="1"}catch(e){}})()`;
