import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthValue, CURRENT_MONTH, MONTH_LABELS, MONTH_OPTIONS, parseMonthValue } from "../../utils/constants";

const getSafeMonth = (value) => (MONTH_OPTIONS.includes(value) ? value : CURRENT_MONTH);

export function MonthPicker({ label = "Month", value, onChange, className }) {
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const safeValue = getSafeMonth(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parseMonthValue(safeValue).year);
  const [popupStyle, setPopupStyle] = useState(null);

  useEffect(() => {
    setViewYear(parseMonthValue(safeValue).year);
  }, [safeValue]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current?.contains(event.target) || popupRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const maxWidth = Math.min(320, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.right - maxWidth), window.innerWidth - maxWidth - 12);

      setPopupStyle({
        position: "fixed",
        top: Math.min(rect.bottom + 12, window.innerHeight - 24),
        left,
        width: maxWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const years = useMemo(
    () => [...new Set(MONTH_OPTIONS.map((option) => parseMonthValue(option).year))].sort((a, b) => b - a),
    []
  );
  const currentIndex = MONTH_OPTIONS.indexOf(safeValue);
  const previousMonth = currentIndex < MONTH_OPTIONS.length - 1 ? MONTH_OPTIONS[currentIndex + 1] : null;
  const nextMonth = currentIndex > 0 ? MONTH_OPTIONS[currentIndex - 1] : null;
  const visibleMonths = MONTH_LABELS.map((labelText, monthIndex) => {
    const monthValue = buildMonthValue(monthIndex, viewYear);
    return {
      label: labelText,
      value: monthValue,
      disabled: !MONTH_OPTIONS.includes(monthValue),
    };
  });

  return (
    <div ref={wrapperRef} className={clsx("relative", className)}>
      <label className="field-label">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => previousMonth && onChange(previousMonth)}
          disabled={!previousMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          ref={triggerRef}
          className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition hover:border-brand-300 hover:ring-4 hover:ring-brand-100 sm:min-w-[190px] sm:px-4"
          onClick={() => setOpen((currentOpen) => !currentOpen)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="truncate">{safeValue}</span>
          </span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 sm:inline">
            Browse
          </span>
        </button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => nextMonth && onChange(nextMonth)}
          disabled={!nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {open && popupStyle
        ? createPortal(
        <div
          ref={popupRef}
          style={popupStyle}
          className="z-[120] rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              onClick={() => {
                const currentYearIndex = years.indexOf(viewYear);
                setViewYear(years[Math.min(years.length - 1, currentYearIndex + 1)]);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-ink">{viewYear}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              onClick={() => {
                const currentYearIndex = years.indexOf(viewYear);
                setViewYear(years[Math.max(0, currentYearIndex - 1)]);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {visibleMonths.map((month) => (
              <button
                key={month.value}
                type="button"
                disabled={month.disabled}
                onClick={() => {
                  onChange(month.value);
                  setOpen(false);
                }}
                className={clsx(
                  "rounded-2xl px-3 py-2 text-sm transition",
                  month.disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700",
                  month.value === safeValue && "border-brand-500 bg-brand-50 text-brand-700"
                )}
              >
                {month.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            onClick={() => {
              onChange(CURRENT_MONTH);
              setOpen(false);
            }}
          >
            Jump to current month
          </button>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
