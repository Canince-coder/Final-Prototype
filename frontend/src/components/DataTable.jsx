import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { EmptyState } from "./States";

/**
 * Sortable, searchable, paginated table that turns into stacked cards on phones.
 * columns: [{ key, label, render?(row), sortValue?(row), num?, mobile? (default true) }]
 */
export default function DataTable({ columns, rows, searchKeys = [], pageSize = 10, initialSort, toolbar, emptyMessage = "No records found.", rowKey = "id" }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort || null); // {key, dir}
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const val = col?.sortValue || ((r) => r[sort.key]);
      out = [...out].sort((a, b) => {
        const x = val(a), y = val(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, query, sort, columns, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key] ?? "—");

  return (
    <div className="table-card">
      {(searchKeys.length > 0 || toolbar) && (
        <div className="row-between" style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
          {searchKeys.length > 0 && (
            <label className="search field" style={{ minWidth: 220, flex: 1, maxWidth: 360 }}>
              <span className="sr-only">Search</span>
              <Search size={15} />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search..." />
            </label>
          )}
          {toolbar}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <div className="table-wrap responsive">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`${c.num ? "num" : ""} ${c.sortable === false ? "" : "sortable"}`}
                      onClick={c.sortable === false ? undefined : () => toggle(c.key)}
                      aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      scope="col"
                    >
                      <span className="th-inner">
                        {c.label}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r[rowKey] ?? i}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.num ? "num" : ""}>{cell(c, r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-cards">
            {visible.map((r, i) => (
              <div className="mobile-card" key={r[rowKey] ?? i}>
                <div className="mc-title">{cell(columns[0], r)}</div>
                {columns.slice(1).filter((c) => c.mobile !== false).map((c) => (
                  <div key={c.key} className="info-item">
                    <span className="label">{c.label}</span>
                    <span className="value">{cell(c, r)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="table-footer">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length}
          </span>
          <div className="row">
            <button className="icon-btn" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span>Page {current + 1} / {pages}</span>
            <button className="icon-btn" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
