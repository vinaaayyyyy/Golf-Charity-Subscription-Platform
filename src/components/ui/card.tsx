import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-panel ambient-border rounded-[2rem] p-6 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(51,43,31,0.16)] sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
