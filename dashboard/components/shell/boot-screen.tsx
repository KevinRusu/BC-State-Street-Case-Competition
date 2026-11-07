"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { BOOT_KEY } from "./boot-flag";
import { BrandLogo } from "./brand-logo";

// Timings in seconds. The bar is decoration on a fixed clock: it claims no real loading progress.
const CLOSE_AFTER = 2.0;
const CLOSE_AFTER_REDUCED = 1.2;
const FADE_OUT = 0.3;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const STILL = { duration: 0 };

const subscribeNothing = () => () => {};

function markBooted() {
  document.documentElement.dataset.booted = "1";
}

function rememberSeen() {
  try {
    sessionStorage.setItem(BOOT_KEY, "1");
  } catch {
    // Blocked storage: the screen plays again on the next full page load, which is harmless.
  }
}

// Whether this session had seen the screen when the page loaded. Read once and kept, so that marking the session
// on close does not cut the screen's own fade short.
let seenAtLoad: boolean | undefined;
function seenBefore() {
  if (seenAtLoad === undefined) {
    let stored = false;
    try {
      stored = sessionStorage.getItem(BOOT_KEY) !== null;
    } catch {
      // Blocked storage counts as not seen.
    }
    seenAtLoad = document.documentElement.dataset.booted === "1" || stored;
  }
  return seenAtLoad;
}

// A short logo reveal that plays once per browser session and fades into the dashboard, which renders underneath
// from the start. The server renders it, so nothing of the dashboard shows before it; a click or any key skips it.
export function BootScreen() {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const skip = useSyncExternalStore(subscribeNothing, seenBefore, () => false);
  const reduce = useReducedMotion() === true;
  const [open, setOpen] = useState(true);

  // The flag script only runs on a full page load, and React's development remount can strip it from <html>.
  // Re-applying it before paint keeps the server copy hidden until React removes it.
  useLayoutEffect(() => {
    if (skip) markBooted();
  }, [skip]);

  const close = useCallback(() => {
    setOpen(false);
    rememberSeen();
  }, []);

  useEffect(() => {
    if (skip || !open) return;
    const timer = window.setTimeout(close, (reduce ? CLOSE_AFTER_REDUCED : CLOSE_AFTER) * 1000);
    window.addEventListener("keydown", close);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, [skip, open, reduce, close]);

  if (skip) return null;

  return (
    // Flagging <html> waits for the fade to end: the CSS rule it triggers would hide the screen at once.
    <AnimatePresence onExitComplete={markBooted}>
      {open && (
        <motion.div
          key="boot"
          data-boot-screen=""
          data-boot-ready={hydrated ? "" : undefined}
          role="status"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-background"
          onClick={close}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_OUT, ease: "easeOut" }}
        >
          <span className="sr-only">Opening Data Flow Explorer</span>
          <div aria-hidden="true" className="flex flex-col items-center gap-6 px-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? STILL : { duration: 0.3, ease: EASE_OUT }}
            >
              <BrandLogo className="h-11 w-auto" />
            </motion.div>
            <motion.div
              className="text-center leading-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduce ? STILL : { delay: 0.35, duration: 0.25, ease: "easeOut" }}
            >
              <div className="text-lg font-semibold tracking-tight">Data Flow Explorer</div>
              <div className="mt-1 text-balance text-sm text-muted-foreground">
                Prepared for State Street · Boston College case competition
              </div>
            </motion.div>
            <div className="h-0.5 w-48 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full origin-left rounded-full bg-brand"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={reduce ? STILL : { delay: 0.5, duration: 1.1, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
