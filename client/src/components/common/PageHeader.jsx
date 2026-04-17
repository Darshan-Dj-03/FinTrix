export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="w-full xl:w-auto xl:min-w-[24rem] xl:max-w-4xl">{action}</div> : null}
    </div>
  );
}
