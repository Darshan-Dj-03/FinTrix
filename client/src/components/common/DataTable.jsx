import { formatDate } from "../../utils/formatters";

export function DataTable({ columns, rows, emptyMessage = "No records found." }) {
  if (!rows?.length) {
    return (
      <div className="panel-soft flex min-h-40 items-center justify-center p-8 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] divide-y divide-slate-200 text-sm md:min-w-full">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:px-5 md:py-4 md:text-xs"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={row.id || row._id || rowIndex} className="hover:bg-slate-50/70">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-600 md:px-5 md:py-4">
                    {column.render
                      ? column.render(row)
                      : column.type === "date"
                        ? formatDate(row[column.key])
                        : row[column.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
