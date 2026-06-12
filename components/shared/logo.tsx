import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-display font-bold tracking-tight",
        className
      )}
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"
        aria-hidden
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18" />
          <path d="M5 21V9l7-5 7 5v12" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </span>
      <span className={cn("text-lg", inverted ? "text-white" : "text-foreground")}>
        Crest Bank
      </span>
    </Link>
  );
}
