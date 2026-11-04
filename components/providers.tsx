"use client";
import type {ReactNode} from "react";
import {FeatherPortalProvider,TooltipProvider} from "@aleeforoughi/feather-react";

/**
 * Whoush wraps the app once with what Feather's FeatherProvider provides (portal container and tooltips), minus its
 * ThemeProvider: FeatherProvider 1.17.0 cannot be configured (it defaults to "system" and the "theme" key), its
 * initializer reads localStorage during render and throws on the server, and it binds a global "d" shortcut. Theme is
 * handled by components/theme-toggle.tsx and the inline script in app/layout.tsx. Gap reported to aleeforoughi/feather.
 */
export function Providers({children}:{children:ReactNode}){
 return <FeatherPortalProvider container={undefined}><TooltipProvider>{children}</TooltipProvider></FeatherPortalProvider>;
}
