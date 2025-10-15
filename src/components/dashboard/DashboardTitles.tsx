interface ChildComponentProps {
  title: string;
  subtitle?: string;
}

export default function DashboardTitles({ title, subtitle }: ChildComponentProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">{title}</h2>
      <p className="mb-8">{subtitle}</p>
    </div>
  );
}
