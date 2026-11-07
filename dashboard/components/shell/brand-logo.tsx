"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-state";

// Source size of the generated PNGs (scripts/build_logo.py); next/image needs it to reserve the space.
const WIDTH = 738;
const HEIGHT = 201;

// The blue logo for light mode and the white one for dark mode. CSS hides the one that does not fit the theme,
// so the right one shows from the first paint. Local files, so no image optimiser is involved.
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/brand/state-street-blue.png"
        alt="State Street"
        width={WIDTH}
        height={HEIGHT}
        unoptimized
        loading="eager"
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/state-street-white.png"
        alt="State Street"
        width={WIDTH}
        height={HEIGHT}
        unoptimized
        loading="eager"
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}

// The logo lives in the left menu. The top bar carries it whenever that menu is not on screen: hidden by the
// toggle, or open but below the md breakpoint where the menu never shows.
export function HeaderLogo() {
  const { menuOpen } = useShell();
  // The hiding rule sits on a wrapper: on the white image, `dark:block` would out-rank `md:hidden`.
  return (
    <span className={cn("flex shrink-0", menuOpen && "md:hidden")}>
      <BrandLogo className="h-5 w-auto" />
    </span>
  );
}
