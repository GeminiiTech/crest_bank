import type { Card as CardType } from "@/lib/data/cards";
import { cn } from "@/lib/utils";

const MONTHS = (m: number) => String(m).padStart(2, "0");

export function CardVisual({ card }: { card: CardType }) {
  const frozen = card.status !== "active";
  return (
    <div
      className={cn(
        "relative aspect-[1.6] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-navy-900 p-5 text-white shadow-card",
        frozen && "opacity-60 grayscale"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/70">
          {card.is_virtual ? "Virtual" : "Crest"} {card.type}
        </span>
        <span className="text-sm font-semibold">{card.brand}</span>
      </div>
      <p className="mt-8 font-mono text-lg tracking-widest">•••• •••• •••• {card.last4}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-white/80">
        <span>EXP {MONTHS(card.exp_month)}/{String(card.exp_year).slice(-2)}</span>
        <span className="uppercase">{card.status}</span>
      </div>
    </div>
  );
}
