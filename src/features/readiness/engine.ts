import {
  type ReadinessState,
  type Listing,
  operationLabels,
  commercialLabels,
} from "./model";
export function listingIssues(s: ReadinessState, l: Listing) {
  const issues: string[] = [];
  if (l.title.trim().length < 10)
    issues.push("Listing title needs at least 10 characters");
  if (l.description.trim().length < 80)
    issues.push("Description needs at least 80 characters");
  if (!l.houseRules.trim() || !l.cancellation.trim())
    issues.push("House rules and cancellation terms are missing");
  for (const a of l.amenities)
    if (!s.verifiedAmenities.includes(a))
      issues.push("Unverified amenity: " + a);
  for (const category of l.requiredPhotos)
    if (
      !s.media.some(
        (m) =>
          m.kind === "photo" &&
          m.category === category &&
          m.approved &&
          m.width >= l.minimumWidth,
      )
    )
      issues.push(
        "Approved photo missing or below configured width: " + category,
      );
  if (l.acceptsVideo && !l.videoRuleSource)
    issues.push("Video compatibility needs a channel source reference");
  return issues;
}
export function assess(s: ReadinessState, today: string) {
  const legal: string[] = [],
    operational: string[] = [],
    commercial: string[] = [];
  if (!s.rulesReviewed || !s.requirements.some((r) => r.mandatory))
    legal.push(
      "Jurisdiction-specific mandatory requirements must be reviewed and configured",
    );
  if (s.restriction.trim())
    legal.push("Unresolved restriction: " + s.restriction);
  for (const r of s.requirements) {
    if (!r.mandatory) continue;
    if (r.reviewedOn > today || r.validUntil < today)
      legal.push("Requirement review expired or future-dated: " + r.label);
    if (
      !s.documents.some(
        (d) =>
          d.requirementId === r.id &&
          d.status === "verified" &&
          d.verifiedBy &&
          d.verifiedAt &&
          d.issuedOn <= today &&
          d.expiresOn >= today,
      )
    )
      legal.push("Missing, unverified or expired evidence: " + r.label);
  }
  for (const [labels, checks, out] of [
    [operationLabels, s.operations, operational],
    [commercialLabels, s.commercial, commercial],
  ] as const)
    for (const label of labels)
      if (
        !checks.some(
          (c) =>
            c.label === label &&
            c.passed &&
            c.evidenceUrl &&
            c.checkedBy &&
            c.checkedAt,
        )
      )
        out.push(label + " is not evidenced and passed");
  if (!s.listings.length)
    commercial.push("At least one channel checklist is required");
  for (const l of s.listings) {
    const gaps = listingIssues(s, l);
    if (
      gaps.length ||
      !["Ready for Submission", "Submitted", "Published"].includes(l.status) ||
      !l.reviewedBy
    )
      commercial.push(
        l.channel + ": " + (gaps.join("; ") || "content review required"),
      );
  }
  const alerts = s.documents.flatMap((d) => {
    const days = Math.round(
      (Date.parse(d.expiresOn) - Date.parse(today)) / 86400000,
    );
    const threshold = s.reminderDays
      .filter((n) => days <= n)
      .sort((a, b) => a - b)[0];
    return days < 0 || d.renewalOn <= today || threshold !== undefined
      ? [
          {
            documentId: d.id,
            reference: d.reference,
            responsibleUid: d.responsibleUid,
            daysRemaining: days,
            threshold: threshold ?? 0,
            reason:
              days < 0
                ? "Expired"
                : d.renewalOn <= today
                  ? "Renewal due"
                  : "Upcoming expiry",
          },
        ]
      : [];
  });
  return {
    legal,
    operational,
    commercial,
    canActivate: legal.length + operational.length + commercial.length === 0,
    effectiveStatus:
      s.status === "Active / Rentable" &&
      legal.length + operational.length + commercial.length > 0
        ? "Suspended"
        : s.status,
    alerts,
    overdueTasks: s.tasks.filter((t) => t.status === "open" && t.dueOn < today),
    completeness: {
      verifiedRequirements: s.requirements.filter((r) =>
        s.documents.some(
          (d) =>
            d.requirementId === r.id &&
            d.status === "verified" &&
            d.expiresOn >= today,
        ),
      ).length,
      totalRequirements: s.requirements.length,
    },
    limitations: [
      "Internal readiness review is not government approval.",
      "Content readiness is not OTA publication.",
      "No financial loss is inferred from a blocked apartment.",
    ],
  };
}
