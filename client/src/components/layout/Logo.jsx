import logo from "../../public/Logo.png";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-[1.35rem] border border-white/80 bg-white/90 p-1.5 shadow-lg ring-1 ring-slate-200/70 backdrop-blur">
        <img
          src={logo}
          alt="Fintrix logo"
          className="h-11 w-11 rounded-[1rem] object-cover"
        />
      </div>
      <div>
        <p className="font-display text-lg font-bold tracking-tight text-ink">Fintrix</p>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Mess Control Center</p>
      </div>
    </div>
  );
}
