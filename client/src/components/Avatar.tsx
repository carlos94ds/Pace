const SIZES = { sm: 'size-8 text-xs', md: 'size-12 text-base', lg: 'size-24 text-2xl' } as const;

export function Avatar({
  url,
  name,
  size = 'sm',
}: {
  url: string | null;
  name: string;
  size?: keyof typeof SIZES;
}) {
  if (url)
    return <img src={url} alt="" className={`${SIZES[size]} shrink-0 rounded-full object-cover`} />;
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
