import React from "react";
import AppGuard from "./AppGuard";
import { DownNavbar, GlobalVoiceFab } from "@/components";
import { LiveChefProvider } from "@/context/LiveChefContext";
import { OfflineBanner } from "@/components/offline/OfflineBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			<LiveChefProvider>
				<div className="min-h-screen pb-20">
					<OfflineBanner />
					{children}
					<GlobalVoiceFab />
					<DownNavbar />
				</div>
			</LiveChefProvider>
		</AppGuard>
	);
}
