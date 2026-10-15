import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { marketFixture } from "./helpers/market";
import { createCloudRouter } from "../server/cloud";
import { HttpError } from "../server/auth/permissions";
import { initialReadiness } from "../src/features/readiness/model";
import { readinessReport } from "../src/features/readiness/report";
import {
  memberLabel,
  memberName,
  type TeamMember,
} from "../src/shared/team/members";

test("employee labels distinguish duplicate names and unnamed accounts without exposing identifiers", () => {
  const members: TeamMember[] = [
    {
      uid: "private-id-one",
      displayName: "Alex",
      role: "Revenue Manager",
      seat: 2,
    },
    {
      uid: "private-id-two",
      displayName: "Alex",
      role: "Revenue Manager",
      seat: 3,
    },
    {
      uid: "private-id-three",
      displayName: "",
      role: "Read-Only Viewer",
      seat: 4,
    },
  ];
  assert.notEqual(memberLabel(members[0]), memberLabel(members[1]));
  assert.match(memberName(members, "private-id-three"), /Name not set.*Seat 4/);
  assert.equal(
    memberName(members, "removed-account"),
    "Former or unavailable team member",
  );
  assert.equal(memberName(members, ""), "Unassigned");
  assert.equal(
    memberName(members, "private-id-one").includes("private-id-one"),
    false,
  );
  const state = initialReadiness();
  state.tasks = [
    {
      id: "t",
      label: "Review evidence",
      responsibleUid: members[0].uid,
      dueOn: "2026-01-01",
      status: "open",
    },
  ];
  const html = readinessReport(
    [{ id: "u", unitNumber: "101", revision: 1, state }],
    "2026-10-15",
    members[0].uid,
    [{ ...members[0], displayName: '<img src=x onerror="alert(1)">' }],
  );
  assert.ok(html.includes("&lt;img"));
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("private-id-one"), false);
});

test("employee names are company-scoped, GM/MFA controlled, audited and never replace assignment IDs", async () => {
  const f = await marketFixture({ ingest: false });
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCloudRouter(f.pool, async (token) => ({
      uid: token === "stale" ? "gm" : token,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000) - (token === "stale" ? 700 : 0),
      firebase: { sign_in_second_factor: "totp" },
    })),
  );
  app.use((e: any, _q: any, r: any, _n: any) =>
    r
      .status(e instanceof HttpError ? e.status : 500)
      .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/readiness`;
  const call = (path = "", uid = "gm", body?: unknown) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${uid}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const rename = (
    uid = "revenue",
    displayName = "Samira Demo",
    expectedDisplayName = "",
  ) => ({ uid, displayName, expectedDisplayName });
  try {
    let snapshot = await (await call()).json();
    assert.equal(snapshot.members.length, 3);
    assert.equal(
      snapshot.members.some((m: any) => m.uid === "other"),
      false,
    );
    assert.equal(
      snapshot.members.find((m: any) => m.uid === "revenue").displayName,
      "",
    );
    assert.equal((await call("/members/name", "stale", rename())).status, 401);
    assert.equal(
      (await call("/members/name", "revenue", rename())).status,
      403,
    );
    assert.equal(
      (await call("/members/name", "gm", rename("other"))).status,
      404,
    );
    for (const name of [" ", "x".repeat(101), "Bad\u202ename"])
      assert.equal(
        (await call("/members/name", "gm", rename("revenue", name))).status,
        422,
      );
    assert.equal(
      (
        await call("/members/name", "gm", {
          ...rename(),
          role: "General Manager",
        })
      ).status,
      422,
    );
    const saved = await call(
      "/members/name",
      "gm",
      rename("revenue", "  Samira Demo  "),
    );
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).member.displayName, "Samira Demo");
    assert.equal(
      (await call("/members/name", "gm", rename("revenue", "Overwrite")))
        .status,
      409,
    );
    assert.equal(
      (await call("/members/name", "gm", rename("viewer", "Samira Demo")))
        .status,
      200,
    );
    snapshot = await (await call()).json();
    assert.deepEqual(
      snapshot.members.map((m: any) => m.uid),
      ["gm", "revenue", "viewer"],
    );
    assert.equal(
      snapshot.members.find((m: any) => m.uid === "revenue").role,
      "Revenue Manager",
    );
    const before = await f.db.query("SELECT * FROM memberships ORDER BY uid");
    const state = initialReadiness();
    state.tasks = [
      {
        id: "task",
        label: "Follow up on permit",
        responsibleUid: "revenue",
        dueOn: "2026-01-01",
        status: "open",
      },
    ];
    const ops = {
      revision: 0,
      section: "operations",
      data: {
        operations: state.operations,
        commercial: state.commercial,
        tasks: state.tasks,
      },
    };
    assert.equal((await call("/u0", "gm", ops)).status, 200);
    assert.equal(
      (
        await call(
          "/members/name",
          "gm",
          rename("revenue", "Renamed Employee", "Samira Demo"),
        )
      ).status,
      200,
    );
    snapshot = await (await call()).json();
    assert.equal(snapshot.units[0].state.tasks[0].responsibleUid, "revenue");
    assert.equal(
      snapshot.members.find((m: any) => m.uid === "revenue").displayName,
      "Renamed Employee",
    );
    const report = await (await call("/reports", "gm", {})).json();
    assert.ok(report.html.includes("Renamed Employee"));
    assert.equal(report.html.includes(" · revenue</li>"), false);
    assert.deepEqual(
      (await f.db.query("SELECT * FROM memberships ORDER BY uid")).rows,
      before.rows,
    );
    assert.equal(
      (
        await f.db.query(
          "SELECT target,details FROM audit_events WHERE action='member.name'",
        )
      ).rows.length,
      3,
    );
    const foreign = await (await call("", "other")).json();
    assert.equal(JSON.stringify(foreign).includes("Renamed Employee"), false);
    assert.equal(JSON.stringify(foreign).includes("Samira Demo"), false);
    await assert.rejects(
      f.db.query(
        "INSERT INTO member_profiles VALUES('a','other','Foreign','gm',now())",
      ),
    );
    await f.db.query("DELETE FROM memberships WHERE uid='viewer'");
    assert.equal(
      (await f.db.query("SELECT uid FROM member_profiles WHERE uid='viewer'"))
        .rows.length,
      0,
    );
    assert.equal(
      (await call("/members/name", "gm", rename("viewer", "Unavailable")))
        .status,
      404,
    );
    const invalid = {
      ...ops,
      revision: 1,
      data: {
        ...ops.data,
        tasks: [{ ...state.tasks[0], responsibleUid: "Renamed Employee" }],
      },
    };
    assert.equal((await call("/u0", "gm", invalid)).status, 422);
    invalid.data.tasks[0].responsibleUid = "other";
    assert.equal((await call("/u0", "gm", invalid)).status, 422);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await f.db.close();
  }
});
