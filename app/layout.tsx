import type { ReactNode } from "react";

export const metadata = {
  title: "Moonmoon Archive",
  description: "Private streaming archive"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
