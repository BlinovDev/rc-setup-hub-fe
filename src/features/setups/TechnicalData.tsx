import {
  technicalSections,
  type TechnicalValue,
  type TechnicalProps,
} from "./technicalSections";
import { WeightDistributionView } from "./WeightDistributionView";
import { calculateWeightDistribution } from "./weightDistribution";
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
    <section className="technical-panel">
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
  const hasData =
    Boolean(calculateWeightDistribution(props.data.weight_distribution)) ||
    sections.some((section) =>
      section.values.some(
        ([, value, , showMissing, key]) =>
          value != null || (showMissing && !key),
      ),
    );
  return (
    <>
      {!hasData && <p>No technical setup data yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <WeightDistributionView
          value={props.data.weight_distribution ?? null}
        />
        {sections.map((section) => (
          <Values key={section.title} {...section} />
        ))}
      </div>
    </>
  );
}
