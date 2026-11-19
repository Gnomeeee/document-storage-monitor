export default function EmptyState({ title, message }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {message && (
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
}
