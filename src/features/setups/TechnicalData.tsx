import {
  technicalSections,
  type TechnicalValue,
  type TechnicalProps,
} from "./technicalSections";
function Values({
  title,
  values,
}: {
  title: string;
  values: TechnicalValue[];
}) {
  const present = values.filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (!present.length) return null;
  return (
    <section className="rounded border p-4">
      <h3 className="font-semibold">{title}</h3>
      <dl className="technical-values">
        {present.map(([label, value], index) => (
          <div key={index}>
            <dt>{label}:</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function TechnicalData(props: TechnicalProps) {
  const sections = technicalSections(props);
  if (
    !sections.some((section) =>
      section.values.some(([, value]) => value !== undefined && value !== null),
    )
  )
    return <p>No technical setup data yet.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <Values key={section.title} {...section} />
      ))}
    </div>
  );
}
