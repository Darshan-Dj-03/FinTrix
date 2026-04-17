import clsx from "clsx";

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  ...props
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-2xl font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60",
        {
          "bg-ink text-white hover:bg-slate-800": variant === "primary",
          "bg-brand-50 text-brand-700 hover:bg-brand-100": variant === "secondary",
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50": variant === "ghost",
          "bg-accent-coral text-white hover:brightness-95": variant === "danger",
          "h-11 px-5 text-sm": size === "md",
          "h-10 px-4 text-sm": size === "sm",
          "h-12 px-6 text-base": size === "lg",
        },
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? "Working..." : children}
    </button>
  );
}
