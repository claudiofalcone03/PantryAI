import React from "react";
import AppGuard from "./AppGuard";
import { DownNavbar, GlobalVoiceFab } from "@/components";
import { LiveChefProvider } from "@/context/LiveChefContext";
import { OfflineBanner } from "@/components/offline/OfflineBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			<LiveChefProvider>
				<div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))]">
					<OfflineBanner />
					{children}
					<GlobalVoiceFab />
					<DownNavbar />
				</div>
			</LiveChefProvider>
		</AppGuard>
	);
}
