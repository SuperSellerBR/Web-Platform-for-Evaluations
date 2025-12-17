type LoadingDotsProps = {
  label: string;
};

export function LoadingDots({ label }: LoadingDotsProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}
