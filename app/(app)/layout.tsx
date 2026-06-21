import React from "react";
import AppGuard from "./AppGuard";
import { DownNavbar } from "@/components/DownNavbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			<div className="min-h-screen pb-20">
				{children}
				<DownNavbar />
			</div>
		</AppGuard>
	);
}
