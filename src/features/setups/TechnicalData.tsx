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
    ([, value, , showMissing]) =>
      showMissing || (value !== undefined && value !== null),
  );
  if (!present.length) return null;
  return (
    <section className="rounded border p-4">
      <h3 className="font-semibold">{title}</h3>
      <dl className="technical-values">
        {present.map(([label, value], index) => (
          <div key={index}>
            <dt>{label}:</dt>
            <dd className="whitespace-pre-wrap">{value ?? "Not specified"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function TechnicalData(props: TechnicalProps) {
  const sections = technicalSections(props);
  const hasData = sections.some((section) =>
    section.values.some(
      ([, value, , showMissing, key]) => value != null || (showMissing && !key),
    ),
  );
  return (
    <>
      {!hasData && <p>No technical setup data yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Values key={section.title} {...section} />
        ))}
      </div>
    </>
  );
}
