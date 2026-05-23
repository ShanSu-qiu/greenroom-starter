"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

export function SidebarWrapper() {
  const pathname = usePathname();
  if (pathname.startsWith("/agent-review")) return null;
  return <Sidebar />;
}
