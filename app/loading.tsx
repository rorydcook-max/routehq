import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <AppShell>
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="spinner text-[#0f766e]" />
          <div className="h-4 w-40 rounded bg-[#d6e5e2]" />
        </div>
        <div className="mt-2 h-8 w-80 rounded bg-[#d6e5e2]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item}>
            <div className="h-5 w-32 rounded bg-[#e6f2ef]" />
            <div className="mt-3 h-8 w-28 rounded bg-[#d6e5e2]" />
            <div className="mt-3 h-4 w-44 rounded bg-[#e6f2ef]" />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
