import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="it">
			<body className="min-h-full">
				{children}
			</body>
		</html>
	);
}
