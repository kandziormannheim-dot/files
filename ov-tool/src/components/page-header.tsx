type Props = { title: string; description?: string };

export function PageHeader({ title, description }: Props) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.01em] text-rhoendorf sm:text-3xl">{title}</h1>
      {description ? <p className="mt-1.5 font-serif text-[15px] leading-snug text-rhoendorf/80">{description}</p> : null}
    </div>
  );
}
