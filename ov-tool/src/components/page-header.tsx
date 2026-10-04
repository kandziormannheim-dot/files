type Props = { title: string; description?: string };

export function PageHeader({ title, description }: Props) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description ? <p className="mt-1 text-neutral-600">{description}</p> : null}
    </div>
  );
}
