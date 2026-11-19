export default function Navigation({ page, pages }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-5 sm:px-6 md:flex-row md:items-center md:justify-between md:pt-0">
        <a href="#dashboard" className="text-base font-semibold md:py-5">
          Document Storage Monitor
        </a>
        <nav aria-label="Main navigation" className="flex gap-5 overflow-x-auto">
          {Object.entries(pages).map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={page === id ? "page" : undefined}
              className={`border-b-2 py-4 text-sm ${
                page === id
                  ? "border-emerald-700 font-medium text-emerald-800"
                  : "border-transparent text-slate-600 hover:text-slate-950"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
