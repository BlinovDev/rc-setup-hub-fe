import type { components } from "../../api/generated/schema";
export const testUser = {
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a46",
  nickname: "Driver",
  email: "driver@example.test",
  avatar_url: null,
  created_at: "2026-09-30T12:00:00Z",
} satisfies components["schemas"]["User"];
export const testSetup = {
  id: "c61393b6-daa0-4eb8-923c-57aedbb46a47",
  owner_id: testUser.id,
  title: "Track setup",
  visibility: "friends",
  notes: "Old note",
  schema_version: 1,
  chassis_model_id: "c61393b6-daa0-4eb8-923c-57aedbb46a48",
  chassis: {
    brand_id: "c61393b6-daa0-4eb8-923c-57aedbb46a49",
    brand_name: "Historical Yokomo",
    model_id: "c61393b6-daa0-4eb8-923c-57aedbb46a48",
    model_name: "RD2.0",
  },
  data: {
    suspension: {
      front: {
        toe_deg: 0,
        camber_deg: -1.5,
        link_lengths: [{ name: "Upper", length_mm: 25 }],
      },
      rear: { caster_deg: 2 },
    },
    shocks: {
      front: {
        manufacturer: "Yokomo",
        model: "Big bore",
        spring: { manufacturer: "MST", color: "Red" },
        oil_cst: 100,
      },
      rear: { model: "Rear shock" },
    },
    electronics: {
      motor: "10.5T",
      esc: "ESC model",
      servo: "Servo",
      gyro: "Gyro",
      radio: "Radio",
    },
  },
  created_at: "2026-09-30T12:00:00Z",
  updated_at: "2026-09-30T12:00:00Z",
} satisfies components["schemas"]["Setup"];
