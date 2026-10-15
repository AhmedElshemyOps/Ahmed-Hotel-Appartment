import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoProfile, Match } from "./model";
import { mapRepresentatives } from "./engine";
export function MarketMap({
  profiles,
  selected,
  matches,
  radius,
  onPoint,
}: {
  profiles: GeoProfile[];
  selected: GeoProfile;
  matches: Match[];
  radius: number;
  onPoint?: (latitude: number, longitude: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !ref.current ||
      selected.location.latitude === null ||
      selected.location.longitude === null
    )
      return;
    const map = L.map(ref.current, {
      center: [selected.location.latitude, selected.location.longitude],
      zoom: 14,
      minZoom: 2,
      maxZoom: 20,
      attributionControl: true,
    });
    map.attributionControl.addAttribution(
      "Coordinate map · no external basemap or boundary claims",
    );
    const label = (s: string) => {
      const el = document.createElement("span");
      el.textContent = s;
      return el;
    };
    for (const p of profiles)
      if (p.location.latitude !== null && p.location.longitude !== null)
        L.circleMarker([p.location.latitude, p.location.longitude], {
          radius: p.unitId === selected.unitId ? 9 : 5,
          color: "#38bdf8",
          fillOpacity: 0.8,
        })
          .addTo(map)
          .bindTooltip(
            label("Managed " + p.unitNumber + " · " + p.location.status),
          );
    L.circle([selected.location.latitude, selected.location.longitude], {
      radius,
      color: "#38bdf8",
      fillOpacity: 0.03,
    }).addTo(map);
    for (const { match: m, sourceListings } of mapRepresentatives(matches))
      if (
        m.competitor.location.latitude !== null &&
        m.competitor.location.longitude !== null
      ) {
        const c = m.competitor;
        L.circleMarker([c.location.latitude!, c.location.longitude!], {
          radius: 6,
          color: m.included ? "#34d399" : "#f59e0b",
          fillOpacity: 0.8,
        })
          .addTo(map)
          .bindTooltip(
            label(
              c.title +
                " · " +
                sourceListings +
                " linked source listings · " +
                (m.included
                  ? "Comparable"
                  : "Excluded: " + m.reasons.join("; ")),
            ),
          );
        if ((c.location.accuracyMeters || 0) > 50)
          L.circle([c.location.latitude!, c.location.longitude!], {
            radius: c.location.accuracyMeters!,
            color: "#f59e0b",
            weight: 1,
            fillOpacity: 0.04,
          }).addTo(map);
      }
    if (onPoint)
      map.on("click", (e) =>
        onPoint(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ),
      );
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, [profiles, selected, matches, radius, onPoint]);
  return (
    <div>
      <div
        ref={ref}
        role="region"
        aria-label="Interactive geographic market map"
        className="h-96 rounded-xl border border-slate-700 bg-slate-800 z-0"
      />
      <p className="text-xs text-slate-400 mt-2">
        Blue: managed units · Green: eligible observations · Amber:
        excluded/approximate. Documented physical units share a marker; the
        freshest eligible observation takes priority. Zoom and pan to inspect.
        Circles show radius/coordinate uncertainty, not community boundaries. No
        external basemap is loaded.
        {onPoint
          ? " Click to copy a coordinate into the location editor; verification is still required."
          : ""}
      </p>
    </div>
  );
}
