import type { components } from "../../api/generated/schema";
function Values({
  title,
  values,
}: {
  title: string;
  values: [string, string | number | null | undefined][];
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
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function TechnicalData({
  data,
}: {
  data: components["schemas"]["SetupDataV1"];
}) {
  const sections: {
    title: string;
    values: [string, string | number | null | undefined][];
  }[] = [];
  for (const axle of ["front", "rear"] as const) {
    const suspension = data.suspension?.[axle];
    const shock = data.shocks?.[axle];
    const label = axle === "front" ? "Front" : "Rear";
    sections.push({
      title: `${label} suspension`,
      values: [
        ["Camber (deg)", suspension?.camber_deg],
        ["Caster (deg)", suspension?.caster_deg],
        ["Toe (deg)", suspension?.toe_deg],
        ...(suspension?.link_lengths?.map(
          (link) => [link.name, `${link.length_mm} mm`] as [string, string],
        ) ?? []),
      ],
    });
    sections.push({
      title: `${label} shocks`,
      values: [
        ["Manufacturer", shock?.manufacturer],
        ["Model", shock?.model],
        ["Spring manufacturer", shock?.spring?.manufacturer],
        ["Spring color", shock?.spring?.color],
        ["Oil (cSt)", shock?.oil_cst],
      ],
    });
  }
  sections.push({
    title: "Electronics",
    values: (["motor", "esc", "servo", "gyro", "radio"] as const).map((key) => [
      key === "esc" ? "ESC" : key.charAt(0).toUpperCase() + key.slice(1),
      data.electronics?.[key],
    ]),
  });
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
