import { AppShell } from "@/components/app-shell";
import { RfqSheet } from "@/features/rfq/rfq-sheet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <RfqSheet />
    </AppShell>
  );
}
