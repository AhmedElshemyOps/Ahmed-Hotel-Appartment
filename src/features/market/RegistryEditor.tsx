import React, { useState } from "react";
import type { GeoProfile, PricingPolicy, MarketDataset } from "./model";
import { addDays } from "./model";
import { businessDate } from "../guest-service/guestService";
const input =
  "bg-slate-950 border border-slate-600 rounded p-2 w-full text-slate-100";
const button = "px-3 py-2 rounded bg-sky-700 disabled:opacity-40";
export function blankProfile(
  unitId: string,
  unitNumber: string,
  propertyId: string,
): GeoProfile {
  return {
    unitId,
    unitNumber,
    propertyId,
    location: {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      address: null,
      buildingName: null,
      buildingReference: null,
      community: "",
      district: "",
      city: "",
      emirate: null,
      country: "AE",
      postalCode: null,
      status: "unverified",
      provider: null,
      verifiedAt: null,
      evidenceUrl: null,
    },
    characteristics: {
      category: "entire_unit",
      rentalModel: "short_term",
      bedrooms: 0,
      bathrooms: 1,
      capacity: 2,
      areaSqm: null,
      floor: null,
      furnishing: null,
      condition: null,
      view: null,
      reviewScore: null,
      reviewCount: null,
      licenseStatus: null,
      amenities: [],
      accessibility: [],
      attractionDistances: [],
    },
  };
}
export function RegistryEditor({
  dataset,
  propertyId,
  revision,
  units,
  api,
  onSaved,
  run,
  busy,
  selectedUnit,
  point,
}: {
  dataset: MarketDataset;
  propertyId: string;
  revision: number;
  units: { id: string; unitNumber: string; type: string }[];
  api: (path: string, body?: unknown) => Promise<any>;
  onSaved: () => Promise<void>;
  run: any;
  busy: boolean;
  selectedUnit: string;
  point: { latitude: number; longitude: number } | null;
}) {
  const [profile, setProfile] = useState<GeoProfile>(
    () =>
      dataset.profiles.find((p) => p.unitId === selectedUnit) ||
      blankProfile(units[0]?.id || "", units[0]?.unitNumber || "", propertyId),
  );
  const policy = dataset.policies.find((p) => p.unitId === profile.unitId);
  const [policyDraft, setPolicyDraft] = useState<any>(
    policy || {
      unitId: profile.unitId,
      minimumRate: 0,
      maximumRate: 0,
      targetRate: null,
      maxChangePercent: 10,
      minimumStay: 1,
      cleaningFee: 0,
      servicePercent: 0,
      taxPercent: 0,
      commissionPercent: 0,
      operatingCostPerNight: null,
      minimumContribution: null,
      cancellation: "flexible",
      ownerApprovalReference: "",
      weekendPolicy: null,
      seasonalPolicy: null,
      additionalGuestFee: 0,
    },
  );
  const [rate, setRate] = useState({
    from: addDays(businessDate(), 1),
    to: addDays(businessDate(), 7),
    roomRate: 0,
    minimumStay: 1,
    available: true,
    occupancyForecast: "" as string,
    forecastEvidence: "",
  });
  const [notes, setNotes] = useState("");
  const base = "/market/properties/" + propertyId;
  const locationText = (field: keyof GeoProfile["location"], label: string) => (
    <label key={field}>
      {label}
      <input
        className={input}
        value={String(profile.location[field] ?? "")}
        onChange={(e) =>
          setProfile({
            ...profile,
            location: { ...profile.location, [field]: e.target.value || null },
          })
        }
      />
    </label>
  );
  return (
    <div className="space-y-5">
      <section className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
        <h3 className="font-bold">Location and unit registry</h3>
        <p className="text-xs text-slate-400">
          Corrections preserve pricing evidence history. Coordinates entered
          manually are not automatically verified. Use a documented source and
          verify the actual building; illustrative building names are not mapped
          automatically.
        </p>
        <label>
          Registered real unit
          <select
            className={input}
            value={profile.unitId}
            onChange={(e) => {
              const u = units.find((u) => u.id === e.target.value);
              if (u) {
                setProfile(
                  dataset.profiles.find((p) => p.unitId === u.id) ||
                    blankProfile(u.id, u.unitNumber, propertyId),
                );
              }
            }}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber} · {u.type}
              </option>
            ))}
          </select>
        </label>
        <div className="grid md:grid-cols-3 gap-3">
          {(
            [
              ["address", "Street address"],
              ["buildingName", "Building name"],
              ["buildingReference", "Verified building identifier"],
              ["community", "Community"],
              ["district", "District"],
              ["city", "City"],
              ["emirate", "Emirate/state"],
              ["country", "Country code"],
              ["postalCode", "Postal information"],
              ["provider", "Geocoding / verification provider"],
              ["evidenceUrl", "Location evidence URL"],
            ] as const
          ).map(([f, l]) => locationText(f, l))}
          {(["latitude", "longitude", "accuracyMeters"] as const).map((f) => (
            <label key={f}>
              {f === "accuracyMeters" ? "Coordinate accuracy (meters)" : f}
              <input
                className={input}
                type="number"
                step="any"
                value={profile.location[f] ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    location: {
                      ...profile.location,
                      [f]:
                        e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
          <label>
            Verification status
            <select
              className={input}
              value={profile.location.status}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  location: {
                    ...profile.location,
                    status: e.target.value as any,
                  },
                })
              }
            >
              <option value="unverified">Unverified</option>
              <option value="approximate">Approximate</option>
              <option value="verified">GM verified against evidence</option>
            </select>
          </label>
          <label>
            Last verified date
            <input
              className={input}
              type="date"
              value={profile.location.verifiedAt?.slice(0, 10) || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  location: {
                    ...profile.location,
                    verifiedAt: e.target.value
                      ? e.target.value + "T00:00:00Z"
                      : null,
                  },
                })
              }
            />
          </label>
        </div>
        {point && (
          <button
            className={button}
            onClick={() =>
              setProfile({
                ...profile,
                location: {
                  ...profile.location,
                  ...point,
                  status: "unverified",
                  verifiedAt: null,
                },
              })
            }
          >
            Use clicked coordinates ({point.latitude}, {point.longitude}) as
            unverified
          </button>
        )}
        <h4 className="font-semibold">Apartment characteristics</h4>
        <div className="grid md:grid-cols-3 gap-3">
          {(
            [
              "bedrooms",
              "bathrooms",
              "capacity",
              "areaSqm",
              "floor",
              "reviewScore",
              "reviewCount",
            ] as const
          ).map((f) => (
            <label key={f}>
              {
                {
                  bedrooms: "Bedrooms (studio = 0)",
                  bathrooms: "Bathrooms",
                  capacity: "Maximum guests",
                  areaSqm: "Area (m²)",
                  floor: "Floor",
                  reviewScore: "Verified score (0–10)",
                  reviewCount: "Verified review count",
                }[f]
              }
              <input
                className={input}
                type="number"
                step="any"
                value={profile.characteristics[f] ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    characteristics: {
                      ...profile.characteristics,
                      [f]:
                        e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
          {(["furnishing", "condition", "view", "licenseStatus"] as const).map(
            (f) => (
              <label key={f}>
                {f}
                <input
                  className={input}
                  value={profile.characteristics[f] || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      characteristics: {
                        ...profile.characteristics,
                        [f]: e.target.value || null,
                      },
                    })
                  }
                />
              </label>
            ),
          )}
          <label>
            Category
            <select
              className={input}
              value={profile.characteristics.category}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  characteristics: {
                    ...profile.characteristics,
                    category: e.target.value as any,
                  },
                })
              }
            >
              {["entire_unit", "private_room", "hotel_room"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Rental model
            <select
              className={input}
              value={profile.characteristics.rentalModel}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  characteristics: {
                    ...profile.characteristics,
                    rentalModel: e.target.value as any,
                  },
                })
              }
            >
              <option value="short_term">Short term</option>
              <option value="long_term">Long term (pricing unsupported)</option>
            </select>
          </label>
          <label>
            Amenities (comma separated)
            <input
              className={input}
              placeholder="pool, gym, parking, balcony, waterfront"
              value={profile.characteristics.amenities.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  characteristics: {
                    ...profile.characteristics,
                    amenities: e.target.value.split(",").map((s) => s.trim()),
                  },
                })
              }
            />
          </label>
          <label>
            Accessibility features
            <input
              className={input}
              value={profile.characteristics.accessibility.join(", ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  characteristics: {
                    ...profile.characteristics,
                    accessibility: e.target.value
                      .split(",")
                      .map((s) => s.trim()),
                  },
                })
              }
            />
          </label>
        </div>
        <button
          disabled={busy || !profile.unitId}
          className={button}
          onClick={() =>
            run(async () => {
              await api(base + "/profile", {
                revision,
                profile: {
                  ...profile,
                  characteristics: {
                    ...profile.characteristics,
                    amenities:
                      profile.characteristics.amenities.filter(Boolean),
                    accessibility:
                      profile.characteristics.accessibility.filter(Boolean),
                  },
                },
              });
              await onSaved();
            })
          }
        >
          Save location and unit profile
        </button>
      </section>
      <section className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
        <h3 className="font-bold">Owner-approved pricing guardrails</h3>
        <p className="text-xs text-slate-400">
          Select an already registered market unit before saving its policy.
          These limits guide internal proposals and never change live channel
          prices.
        </p>
        <label>
          Policy unit
          <select
            className={input}
            value={policyDraft.unitId}
            onChange={(e) => {
              const existing = dataset.policies.find(
                (p) => p.unitId === e.target.value,
              );
              setPolicyDraft(
                existing || {
                  ...policyDraft,
                  unitId: e.target.value,
                  ownerApprovalReference: "",
                },
              );
            }}
          >
            {dataset.profiles.map((u) => (
              <option key={u.unitId} value={u.unitId}>
                {u.unitNumber}
              </option>
            ))}
          </select>
        </label>
        <div className="grid md:grid-cols-3 gap-3">
          {(
            [
              "minimumRate",
              "maximumRate",
              "targetRate",
              "maxChangePercent",
              "minimumStay",
              "cleaningFee",
              "servicePercent",
              "taxPercent",
              "commissionPercent",
              "operatingCostPerNight",
              "minimumContribution",
              "additionalGuestFee",
            ] as const
          ).map((f) => (
            <label key={f}>
              {f.replace(/([A-Z])/g, " $1")}
              <input
                className={input}
                type="number"
                step="any"
                value={policyDraft[f] ?? ""}
                onChange={(e) =>
                  setPolicyDraft({
                    ...policyDraft,
                    [f]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
          <label>
            Cancellation
            <select
              className={input}
              value={policyDraft.cancellation}
              onChange={(e) =>
                setPolicyDraft({ ...policyDraft, cancellation: e.target.value })
              }
            >
              <option value="flexible">Flexible</option>
              <option value="nonrefundable">Nonrefundable</option>
            </select>
          </label>
          {["ownerApprovalReference", "weekendPolicy", "seasonalPolicy"].map(
            (f) => (
              <label key={f}>
                {f.replace(/([A-Z])/g, " $1")}
                <input
                  className={input}
                  value={policyDraft[f] || ""}
                  onChange={(e) =>
                    setPolicyDraft({
                      ...policyDraft,
                      [f]: e.target.value || null,
                    })
                  }
                />
              </label>
            ),
          )}
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api(base + "/policy", { revision, policy: policyDraft });
              await onSaved();
            })
          }
        >
          Record approved policy version
        </button>
      </section>
      <section className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
        <h3 className="font-bold">Internal asking-rate schedule</h3>
        <p className="text-xs text-slate-400">
          This records a planning baseline. It does not claim that an OTA has
          these rates or publish prices. Fees follow the selected approved
          policy. Up to 120 dates per batch.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <label>
            From
            <input
              className={input}
              type="date"
              value={rate.from}
              onChange={(e) => setRate({ ...rate, from: e.target.value })}
            />
          </label>
          <label>
            Through
            <input
              className={input}
              type="date"
              value={rate.to}
              onChange={(e) => setRate({ ...rate, to: e.target.value })}
            />
          </label>
          <label>
            Room rate (AED)
            <input
              className={input}
              type="number"
              value={rate.roomRate}
              onChange={(e) =>
                setRate({ ...rate, roomRate: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Minimum nights
            <input
              className={input}
              type="number"
              value={rate.minimumStay}
              onChange={(e) =>
                setRate({ ...rate, minimumStay: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Occupancy forecast (0–1 or blank)
            <input
              className={input}
              type="number"
              step=".01"
              value={rate.occupancyForecast}
              onChange={(e) =>
                setRate({ ...rate, occupancyForecast: e.target.value })
              }
            />
          </label>
          <label>
            Forecast evidence URL
            <input
              className={input}
              value={rate.forecastEvidence}
              onChange={(e) =>
                setRate({ ...rate, forecastEvidence: e.target.value })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={rate.available}
              onChange={(e) =>
                setRate({ ...rate, available: e.target.checked })
              }
            />{" "}
            Available for this internal schedule
          </label>
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const n =
                Math.round(
                  (Date.parse(rate.to) - Date.parse(rate.from)) / 86400000,
                ) + 1;
              if (!Number.isInteger(n) || n < 1 || n > 120)
                throw Error("Choose 1–120 valid dates.");
              await api(base + "/rates", {
                revision,
                rates: Array.from({ length: n }, (_, i) => ({
                  unitId: profile.unitId,
                  date: addDays(rate.from, i),
                  roomRate: rate.roomRate,
                  minimumStay: rate.minimumStay,
                  available: rate.available,
                  occupancyForecast:
                    rate.occupancyForecast === ""
                      ? null
                      : Number(rate.occupancyForecast),
                  forecastEvidence: rate.forecastEvidence || null,
                })),
              });
              await onSaved();
            })
          }
        >
          Append internal rate schedule
        </button>
      </section>
      <section className="bg-slate-900 border border-slate-700 rounded p-4 space-y-3">
        <h3 className="font-bold">Restricted building access instructions</h3>
        <p className="text-xs text-slate-400">
          GM-only in this release. Never included in maps, competitor feeds or
          reports.
        </p>
        <textarea
          className={input}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          className={button}
          onClick={() =>
            run(async () => {
              const result = await api(
                base + "/access-notes/" + encodeURIComponent(profile.unitId),
              );
              setNotes(result.instructions || "");
            })
          }
        >
          Load restricted note
        </button>
        <button
          className={button}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api(base + "/access-notes", {
                unitId: profile.unitId,
                instructions: notes,
              });
            })
          }
        >
          Save restricted note
        </button>
      </section>
    </div>
  );
}
