import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  userEmail
}: {
  eyebrow: string;
  title: string;
  description: string;
  userEmail?: string | null;
}) {
  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <Card className="page-hero">
          <SectionHeader eyebrow={eyebrow} title={title} />
          <p className="page-subtitle mt-3">{description}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link className="primary-action pressable" href="/">
              Dashboard
            </Link>
            <Link className="secondary-action pressable" href="/fleet">
              Fleet
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
