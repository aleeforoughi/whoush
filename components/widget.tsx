"use client";
import type React from "react";
import type {LucideIcon} from "lucide-react";
import {Icon} from "@aleeforoughi/feather-react";

/**
 * How every card and widget in the chat is built (owner, 2026-11-08): full width, clean and balanced; a clear title on top (WidgetHeader), the
 * content in the middle, the actions at the very bottom (WidgetActions): one button the full width, two or more splitting it evenly, each at least
 * 48px tall with generous padding.
 */
export const WIDGET_BUTTON="h-auto min-h-12 min-w-0 flex-1 whitespace-normal px-4 py-3 text-center";

/** The widget's title row: its icon in a soft square, the title, then anything that belongs beside it (a tag, a badge) at the end. */
export function WidgetHeader({icon,title,children,tone="neutral"}:{icon:LucideIcon;title:React.ReactNode;children?:React.ReactNode;
 /** "attention": the icon in the brand colour (a widget waiting for the user). */tone?:"neutral"|"attention"}){
 return <div className="flex min-w-0 items-center gap-2">
  <span className={"flex size-9 shrink-0 items-center justify-center rounded-control "+(tone==="attention"?"bg-primary/15 text-primary":"bg-surface-hover text-fg-secondary")}><Icon icon={icon} size={20} aria-hidden="true"/></span>
  <span className="min-w-0 truncate type-label text-fg-primary">{title}</span>
  {children}
 </div>;
}

/** The widget's actions at its bottom: one button full width, more buttons splitting the width evenly (pass each a WIDGET_BUTTON class). */
export function WidgetActions({children,label}:{children:React.ReactNode;label?:string}){
 return <div role={label?"group":undefined} aria-label={label} className="flex w-full gap-2">{children}</div>;
}
