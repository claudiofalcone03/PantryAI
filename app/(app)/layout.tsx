import React from "react";
import AppGuard from "./AppGuard";
import { LiveChefProvider } from "@/context/LiveChefContext";
import { AssistantProvider } from "@/context/AssistantContext";
import { AppLayoutShell } from "./AppLayoutShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			<LiveChefProvider>
				<AssistantProvider>
					<AppLayoutShell>
						{children}
					</AppLayoutShell>
				</AssistantProvider>
			</LiveChefProvider>
		</AppGuard>
	);
}
