import { Search } from "lucide-react";

import { Input } from "../ui/Input";

export function SearchField({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <Input className="pl-11" value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
