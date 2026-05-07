import Link from "next/link";
import { Calendar, Users, BarChart3, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/shows", label: "Shows", icon: Calendar },
  { href: "/artists", label: "Artists", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50/50 flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-200">
        <Link href="/shows" className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-zinc-900">Greenroom</span>
        </Link>
        <div className="mt-1 text-xs text-zinc-500">The Crescent · Nashville</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-zinc-200 text-xs text-zinc-500">
        <div className="font-medium text-zinc-700">Mariana Reyes</div>
        <div>Lead Booker</div>
      </div>
    </aside>
  );
}
