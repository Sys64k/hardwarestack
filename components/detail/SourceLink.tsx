// Link to a review that CPU or GPU gaming figures come from.
export function SourceLink({ source }: { source: { publisher: string; url: string } }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
      {source.publisher}
    </a>
  );
}
