import type { BookingTemplate } from "@/lib/booking-site";

/**
 * A small drawing of each template's layout (Settings > Booking page), in the business's own colour: enough to tell
 * them apart at a glance. The Preview link beside it opens the real page.
 */
export function TemplateThumb({ template, colour }: { template: BookingTemplate; colour: string }) {
  const bar = "rounded-[2px] bg-[#d5dbdd]";
  const card = (key: number, tall = true) => (
    <div className="overflow-hidden rounded-[4px] bg-white shadow-[0_0_0_1px_#e3e7e8]" key={key}>
      <div className={tall ? "h-5 bg-[#e8ecee]" : "h-3 bg-[#e8ecee]"} />
      <div className="space-y-1 p-1">
        <div className={`h-1 w-3/4 ${bar}`} />
        <div className="h-1.5 w-full rounded-full" style={{ background: colour }} />
      </div>
    </div>
  );
  return (
    <div aria-hidden="true" className="h-[118px] w-full overflow-hidden rounded-xl bg-[#f3f5f6] shadow-[inset_0_0_0_1px_#e3e7e8]">
      {template === "standard" ? (
        <div className="space-y-1.5 p-2">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-[3px]" style={{ background: colour }} />
            <div className={`h-1.5 w-12 ${bar}`} />
          </div>
          <div className="h-6 rounded-[4px] bg-white shadow-[0_0_0_1px_#e3e7e8]" />
          <div className="grid grid-cols-3 gap-1">{[1, 2, 3].map((key) => card(key))}</div>
        </div>
      ) : template === "photo" ? (
        <div>
          <div className="relative h-14 bg-gradient-to-br from-[#7b8e96] to-[#3d4d55]">
            <div className="absolute bottom-1.5 left-2 space-y-1">
              <div className="h-2 w-20 rounded-[2px] bg-white" />
              <div className="h-2.5 w-9 rounded-full bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2">{[1, 2, 3].map((key) => card(key))}</div>
        </div>
      ) : template === "compact" ? (
        <div>
          <div className="h-1.5 bg-white" />
          <div className="space-y-1 px-2 py-1.5" style={{ background: colour }}>
            <div className="h-1.5 w-16 rounded-[2px] bg-white/90" />
            <div className="h-1 w-10 rounded-[2px] bg-white/60" />
          </div>
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((key) => (
              <div className="flex items-center gap-1.5 rounded-[3px] bg-white p-0.5 shadow-[0_0_0_1px_#e3e7e8]" key={key}>
                <div className="h-3.5 w-5 rounded-[2px] bg-[#e8ecee]" />
                <div className={`h-1 flex-1 ${bar}`} />
                <div className="h-2 w-5 rounded-full" style={{ background: colour }} />
              </div>
            ))}
          </div>
        </div>
      ) : template === "monthly" ? (
        <div className="grid grid-cols-[1.1fr_1fr] gap-2 bg-white p-2">
          <div className="space-y-1 pt-1">
            <div className="h-1 w-8 rounded-[2px]" style={{ background: colour }} />
            <div className="h-4 w-16 rounded-[3px] bg-[#2b3036]" />
            <div className={`h-1 w-14 ${bar}`} />
            {[1, 2, 3].map((key) => (
              <div className="flex items-center gap-1" key={key}>
                <div className="h-1.5 w-1.5 rounded-full border" style={{ borderColor: colour }} />
                <div className={`h-1 w-10 ${bar}`} />
              </div>
            ))}
          </div>
          <div className="h-[64px] rounded-[6px] bg-gradient-to-br from-[#9aa9ae] to-[#5b6b72]" />
          <div className="col-span-2 grid grid-cols-3 gap-1">{[1, 2, 3].map((key) => card(key, false))}</div>
        </div>
      ) : (
        <div className="h-full" style={{ background: colour }}>
          <div className="space-y-1 p-2">
            <div className="h-3.5 w-20 rounded-[2px] bg-white" />
            <div className="h-3.5 w-14 rounded-[2px] bg-white" />
            <div className="h-2.5 w-10 rounded-full bg-white/80" />
          </div>
          <div className="grid h-full grid-cols-2 gap-1 rounded-t-[8px] bg-[#f3f5f6] p-2">{[1, 2].map((key) => card(key))}</div>
        </div>
      )}
    </div>
  );
}
