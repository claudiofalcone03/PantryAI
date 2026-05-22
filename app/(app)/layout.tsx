import React from "react";
import AppGuard from "./AppGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppGuard>
			{children}
		</AppGuard>
	);
}
