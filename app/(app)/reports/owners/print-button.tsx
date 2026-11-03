"use client";

import { Printer } from "lucide-react";

/** Print or save the statement as a PDF to send to the owner. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button className="secondary-action pressable print:hidden" onClick={() => window.print()} type="button">
      <Printer size={16} />
      {label}
    </button>
  );
}
