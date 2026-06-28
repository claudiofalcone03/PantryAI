"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trash2, Refrigerator, Sparkles, ShoppingCart, Settings } from "lucide-react";

export function DownNavbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Inventario", href: "/inventario", icon: Refrigerator },
    { name: "Spesa", href: "/lista-della-spesa", icon: ShoppingCart },
    { name: "Ricette AI", href: "/ricette-ai", icon: Sparkles },
    { name: "Spreco", href: "/waste", icon: Trash2 },
    { name: "Profilo", href: "/profilo", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-1 sm:px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.name === "Profilo" && pathname.includes("/impostazioni")); //URL corrente e relative sottopagine
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 sm:w-20 h-full space-y-1 transition-all duration-200 ${isActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-all duration-200 ${isActive ? "stroke-[2.5px] scale-110" : "stroke-[2px] scale-100"}`} />
              </div>
              <span className={`text-[10px] sm:text-xs truncate w-full text-center transition-all duration-200 ${isActive ? "font-semibold opacity-100" : "font-medium opacity-80"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
