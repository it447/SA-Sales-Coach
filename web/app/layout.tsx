import "./globals.css";

export const metadata = {
  title: "Deal Assistant",
  description: "Internal sales-call coaching backend.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
