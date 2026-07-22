# ClassClarus Roles & Authorization — Implementation Guide

This document tells you **what to build, in what order, and exactly how each piece must behave** — without writing the code for you. Every function is specified by: its Convex function type (query / mutation / action), its inputs, its authorization preconditions, and its step-by-step logic.

Read top-to-bottom before writing code. Implement in **three phases** — do not build everything at once.

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Why these libraries](#2-why-these-libraries)
3. [Domain mapping](#3-domain-mapping)
4. [Guardian model — ReBAC only, no org membership](#4-guardian-model--rebac-only-no-org-membership)
5. [Three layers of roles](#5-three-layers-of-roles-do-not-mix-them)
6. [Current codebase starting point](#6-current-codebase-starting-point)
7. [Phase 1 — Solo teacher (ship first)](#7-phase-1--solo-teacher-ship-first)
8. [Phase 2 — Schools, org students, guardians](#8-phase-2--schools-org-students-guardians)
9. [Phase 3 — District hierarchy](#9-phase-3--district-hierarchy)
10. [Adding new member types — how org roles scale](#10-adding-new-member-types--how-org-roles-scale)
11. [Extending to new features — assignments, grades, points, incidents](#11-extending-to-new-features--assignments-grades-points-incidents)
12. [Convex function type reference](#12-convex-function-type-reference)
13. [File reference](#13-file-reference)
14. [Security audit — issues and required mitigations](#14-security-audit--issues-and-required-mitigations)
15. [Testing checklist](#15-testing-checklist)
16. [Common pitfalls](#16-common-pitfalls)
17. [Glossary](#17-glossary)

---

## 1. Mental model

ClassClarus has **two kinds of "membership"**:

| Kind                                                 | Example                                 | Stored in                                    | In staff directory?                 |
| ---------------------------------------------------- | --------------------------------------- | -------------------------------------------- | ----------------------------------- |
| **Staff** (teachers, principals, team leaders)       | Ms. Smith, 5th-grade team leader        | `convex-tenants` org + team members          | Yes                                 |
| **Everyone else** (students, guardians, co-teachers) | Jamie (student), Jamie's mom (guardian) | authz scoped roles / ReBAC + your own tables | No — they are never tenants members |

**Students are not org members.** A student in Period 1 Math is not staff. They should never appear in the principal's member list or receive staff invitations. Their permissions are class-scoped.

**Guardians are not org members either.** A guardian's relationship is to the **student**, not to the school's staff structure. Their access is derived entirely from a ReBAC relation to the student plus the student's active enrollments (see §4). When a student is enrolled in a new class (including a new academic year's class), guardian access to that class appears automatically — no guardian data changes.

**Academic-year classes.** Every class is created for **one specific academic year** (`year` is required, not optional). A new school year means **new class documents** — even if the name is identical ("Period 1 Math" in 2025 and "Period 1 Math" in 2026 are two different classes with different ids). Students are **never transferred** between classes; staff only **add** enrollments. A student may be actively enrolled in **any number of classes** at once (multiple subjects, multiple years). Past-year classes are archived for roster management, but **active enrollments and student roles on those classes are kept** so students (and guardians) retain read access to prior-year work and grades.

**Solo teachers** use only the class-roster layer: no org, no team, no school record — just classes and authz roles. Guardian linking is a Phase 2 (school) feature.

```
Solo teacher today:
  User ──creates──► Class (classes.userId = owner)
                    └── join codes (unused so far)

Target architecture:
  Solo:
    User ──authz "creator" role──► Class (organizationId = undefined)

  In a school:
    Organization (school or district)
    ├── Org members = STAFF ONLY (owner, principal, teacher)   ← tenants
    ├── Team "5th Grade Math" (team_leader, teachers)          ← tenants, nested teams
    │   └── Class "Period 1" (classes.teamId, classes.year)    ← one row per academic year
    │       └── classEnrollments → orgStudents                 ← many active enrollments per student
    ├── orgStudents (stable roster across grades)              ← your table
    └── Guardians: ReBAC guardian_of → orgStudent              ← authz + guardianLinks table
        (access derived from student's ACTIVE enrollments)
```

---

## 2. Why these libraries

### `@djpanda/convex-authz`

**What it does:** Permission checks with scoped roles. "Can user X do action Y on resource Z?" Plus ReBAC relations ("user A is guardian_of orgStudent B").

**Why you need it:**

- Class roles with inheritance (creator > classTeacher > assistantTeacher > student)
- Guardians need **per-student** access (relationship-based), not class-wide roles
- Permission checks happen on every function server-side — never trust the client
- O(1) permission lookups via pre-computed indexes

**Tradeoff:** Newer library (~2026), installed as a Convex **component**. Pin the version in `package.json`.

**Key API facts you must know (verified against the installed v2.4.1 types):**

- `can`, `hasRole`, `getUserRoles`, `hasRelation` work in **queries, mutations, and actions** (they call component queries under the hood).
- `assignRole`, `revokeRole`, `addRelation`, `removeRelation`, `revokeAllRoles`, `offboardUser` require **mutation or action context** — you cannot assign roles from a query.
- `syncRole` / `syncRoles` (re-materialize permissions after you edit role definitions) require an **action** context and are exposed by `makeTenantsAPI` as public actions. Run after every deploy that changes role definitions, or existing users keep their old materialized permissions.
- `withTenant(id)` returns a new client bound to a different namespace; all options (including `relationPermissions`) carry over.

### `@djpanda/convex-tenants`

**What it does:** Organizations, teams, org members, invitations. **Staff management only** in this app.

**Why you need it:** invite principal/teachers, suspend members, grade/subject teams with `team_leader`, nested teams for districts, plus ready-made permission strings (`members:add`, `teams:create`, …) that plug into the same authz instance.

**What it does NOT do (you build these):** classes, join-by-code, org student roster, guardian linking.

**Why install in Phase 1 even though solo teachers don't use orgs?** Registering the component early avoids a schema/component migration later. Phase 1 only wires it; no org UI ships.

---

## 3. Domain mapping

### Organizations vs teams (critical distinction)

**Teams always live inside an org** (`createTeam` requires `organizationId`). **Orgs do not nest.** There is no `parentOrganizationId`. Model district → school as **org → nested teams**:

```
Springfield District (organization)
├── Org members: district admin, principals
├── Team: "Lincoln Elementary"          metadata.type = "school"
│   ├── Team: "5th Grade Math"          parentTeamId → Lincoln
│   │   └── classes rows (teamId set)
│   └── Team: "3rd Grade ELA"
└── Team: "Washington Middle School"
```

### Concept → data model

| Real world                  | Implementation                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| School or district          | tenants `organization`                                                                                                  |
| Grade/subject teacher group | tenants `team`, optional `parentTeamId`                                                                                 |
| Team leader                 | team member with role string `"team_leader"` (custom, not built-in)                                                     |
| Class                       | your `classes` table — **one document per academic year** (required `year` field), optional `teamId` + `organizationId` |
| Student (in a school)       | `orgStudents` row + one or more **active** `classEnrollments` rows (any number of classes/years)                        |
| Student (solo class)        | authz `student` role scoped to the class — no `orgStudents` row                                                         |
| Guardian                    | ReBAC `guardian_of` → `orgStudent` + `guardianLinks` row (see §4)                                                       |

### Join codes (current schema)

Classes already have `studentCode`, `teacherCode`, `assistantTeacherCode`. There is **no guardian code** — guardians are linked by teachers via an invite flow (§8.5).

| Code                   | Role assigned on redemption                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `studentCode`          | `student` (solo class) / links account to `orgStudent` (org class) |
| `teacherCode`          | `classTeacher`                                                     |
| `assistantTeacherCode` | `assistantTeacher`                                                 |

### Academic year & class lifecycle (required design rule)

**Every class belongs to exactly one academic year.** `createClass` must require `year` (e.g. `2025` for the 2025–26 school year — pick one convention and use it consistently in the UI).

| Rule                                                                                                                                                                                                                                  | Why                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New year → **new class row**, even if name matches last year's                                                                                                                                                                        | Keeps assignments, grades, and rosters isolated per year; avoids overwriting history                                                                                 |
| **No `transferStudent`** (or any "move between classes" mutation)                                                                                                                                                                     | Movement is modeled as **enroll in the new class**; the old enrollment stays unless explicitly unenrolled                                                            |
| A student may have **many active enrollments** at once                                                                                                                                                                                | Same-year multi-subject, plus prior-year classes for historical access                                                                                               |
| End of year: **archive** the class (`archivedTime`), do **not** bulk-withdraw enrollments or revoke student roles on that class                                                                                                       | Students and guardians keep `class:read` / `viewOwnGrades` / `viewChildGrades` on completed years                                                                    |
| **Archived classes are read-only.** Every content-writing mutation (submit work, grade, future assignments/points/incidents, `enrollStudent`, `redeemJoinCode`) loads the class and rejects if `archivedTime` is set. Reads stay open | Retention without tampering — a student keeps the `submit` permission via their role, so the archived guard is the only thing stopping writes into last year's class |
| `**year` is immutable after creation** — `updateClass` must not accept a `year` change                                                                                                                                                | Enrollments, grades, and history are year-bound; re-labeling a class silently corrupts records. Wrong year at creation → delete (if empty) and recreate              |
| Roster UI for the **current** year filters to non-archived classes; gradebook/history UI can include archived classes the user is enrolled in                                                                                         | Staff work in the current year; learners review past years                                                                                                           |

There is no special "promotion" operation — enrolling Jamie in "6th Grade ELA 2026" is the same `enrollStudent` call as adding them to a second subject this semester.

---

## 4. Guardian model — ReBAC only, no org membership

This section answers the design question directly: **guardians do not need org membership.** Access can be made to follow the student automatically, and doing so is simpler and safer.

### The core invariant

> A guardian may see content about student S in class C **iff**:
>
> 1. a ReBAC relation `guardian_of(guardianUser → orgStudent S)` exists, **and**
> 2. S has an **active** `classEnrollments` row for class C.

Both conditions are checked server-side in every guardian-facing query. Because condition 2 is evaluated live against enrollments:

- **New class / new year:** enroll student in class B → guardian instantly gains access to B if the relation exists. **Zero guardian mutations.**
- **Prior-year classes:** enrollment on last year's class stays active (see §3) → guardian **keeps** access to that year's data while also seeing current-year classes.
- **Unenroll / withdrawal:** guardian access to that specific class ends when the enrollment is withdrawn — use only when a student should lose access mid-year, not for year rollover.

Guardians see every class where the student has an **active** enrollment, across years and subjects.

### Why not org membership?

| Concern                               | With org membership                                                                        | ReBAC-only (chosen)                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Staff directory                       | Guardians pollute `listMembers`; every staff query must filter them                        | Not applicable — guardians never appear                                                   |
| Permission risk                       | A guardian org role could accidentally inherit staff permissions via role-definition edits | Guardians hold **no roles at all**; nothing to inherit                                    |
| Enrollment changes                    | Same (relation is the stable link either way)                                              | Same — new enrollments add access; unenroll removes it                                    |
| Cleanup                               | Must remove membership when last child leaves                                              | Remove relation + link row only                                                           |
| "Which schools am I connected to?" UI | From org memberships                                                                       | Derived from `guardianLinks` rows (indexed by guardian)                                   |
| Suspending a guardian                 | tenants `suspendMember`                                                                    | Remove/flag their `guardianLinks` + relations; or add a `status` field on `guardianLinks` |

What you give up: tenants' built-in invitation machinery and member-status plumbing for guardians. You compensate with a small `guardianInvites` table (§8.5) — which you want anyway, because guardian linking needs an **email-verified consent flow**, not an admin "add member" action (see security audit §14, item 4).

### The three data pieces

| Piece                                                                                                                                            | Purpose                                                                                                                   | Source of truth?                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ReBAC tuple `guardian_of` (user → orgStudent), stored in the authz component under the **org's tenant namespace** (`withTenant(organizationId)`) | The parent↔child link used in access checks                                                                               | Yes                                                                     |
| `guardianLinks` table (your schema)                                                                                                              | Denormalized mirror for fast list queries (`listMyChildren`, `listGuardiansForStudent`) without scanning component tables | No — mirror; keep in sync in the same mutations that write the relation |
| `classEnrollments` (active/withdrawn)                                                                                                            | Which classes the access currently applies to                                                                             | Yes (for condition 2)                                                   |

**Do not** use authz `relationPermissions` to gate class-scoped permission checks for guardians. A relation grants permissions on the **object of the relation** (the orgStudent), not on classes. A plain `can(user, "class:viewChildGrades", { type: "class", id })` will not pass via the relation. Instead, every guardian-facing function calls one shared helper that performs the explicit two-step check (relation + active enrollment). This is deliberate: the enrollment condition is what makes access follow the student.

### Solo classes

Defer guardians entirely to Phase 2. Solo classes have no `orgStudents`, so there is nothing stable to attach a relation to. If you ever add solo guardians, that is a separate, simpler design (relation directly to the student's user account) — do not mix it into this one.

---

## 5. Three layers of roles (do not mix them)

Each layer answers a different question. Mixing them is the most common source of bugs.

### Layer 1 — Org roles (school/district STAFF only)

**Question:** "Can this user invite a principal? Create a team? Manage the roster?"

**Stored in:** tenants org membership; permissions enforced by authz.

Extend the tenants defaults (`owner`, `admin`, `member`) with education roles. Define these in `convex/authz.ts` (§7.3):

| Org role                  | organizations | members                       | teams                                                 | students                               | guardians    |
| ------------------------- | ------------- | ----------------------------- | ----------------------------------------------------- | -------------------------------------- | ------------ |
| `owner` (tenants default) | all           | all                           | all                                                   | all                                    | link, unlink |
| `principal`               | read, update  | add, remove, updateRole, list | create, update, delete, addMember, removeMember, list | create, list, enroll, unenroll, update | link, unlink |
| `teacher`                 | read          | —                             | —                                                     | create, list, enroll, unenroll, update | link, unlink |

There is **no `guardian` org role** — guardians are not members (§4). To add more staff-like member types later (counselor, librarian, substitute, registrar…), follow the recipe in §10 — it is four edits, no schema change.

**Structural owner:** every org has an `ownerId` (creator). This is a tenants data-integrity constraint — the owner cannot be removed without `transferOwnership`. It is separate from the `owner` _role_.

### Layer 2 — Team roles (grade/subject groups)

**Question:** "Can this user manage the 5th Grade Math team?"

**Stored in:** tenants team membership with a **free-form role string** — use `"team_leader"` and `"teacher"`. `team_leader` is not built-in; you assign it via `updateTeamMemberRole` and enforce rules like "one leader per team" yourself in the `onBeforeAddTeamMember` hook.

**Important:** team membership alone grants no org-scoped permissions. A team leader must also be an org member (typically org role `teacher`) to pass `students:*` checks.

### Layer 3 — Class roles (roster)

**Question:** "Can this user grade in Period 1? Submit work?"

**Stored in:** authz roles scoped to `{ type: "class", id: classId }` in the global (`"classclarus"`) tenant namespace.

Class permissions to define: `class:read`, `class:manage` (edit settings/archive/delete), `class:manageMembers` (roster + guardian linking), `class:grade`, `class:submit`, `class:viewOwnGrades`, `class:viewChildGrades`.

| Class role         | Inherits         | Adds                        |
| ------------------ | ---------------- | --------------------------- |
| `student`          | —                | read, submit, viewOwnGrades |
| `assistantTeacher` | student          | grade                       |
| `classTeacher`     | assistantTeacher | manageMembers               |
| `creator`          | classTeacher     | manage                      |

Name it `classTeacher`, not `teacher` — the org role `teacher` already exists in the same role catalog and authz role names are global per definition set. Name it `creator`, not `owner` — `owner` is taken by tenants.

**There is no `guardian` class role.** Guardian access is the two-step check from §4.

| Role             | How they get it                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| creator          | assigned inside `createClass`                                                  |
| classTeacher     | `redeemJoinCode` with `teacherCode`                                            |
| assistantTeacher | `redeemJoinCode` with `assistantTeacherCode`                                   |
| student (solo)   | `redeemJoinCode` with `studentCode`                                            |
| student (org)    | `enrollStudent` from roster; join code links a login account to the roster row |

---

## 6. Current codebase starting point

What already exists in **this repo**:

| File                                 | Current behavior                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                       | `@djpanda/convex-authz` (2.4.1) and `@djpanda/convex-tenants` (0.5.0) already installed                                       |
| `convex/schema.ts`                   | `classes` table with `userId` owner, three join codes, `publicDisplayPin`, only a `by_user` index                             |
| `convex/classes.ts`                  | `getOwnedClass` helper checks `classes.userId === currentUser`; `classDoc` return validator **includes all three join codes** |
| `src/lib/auth.ts`                    | `getCurrentUser` / `requireUser` via `@convex-dev/auth` (Google)                                                              |
| `convex/auth.ts`                     | Google OAuth only                                                                                                             |
| `src/routes/_account/c.$classId.tsx` | Class detail page using `api.classes.getClass`                                                                                |

What you will create: `convex/convex.config.ts`, `convex/authz.ts`, `convex/tenants.ts`, `convex/memberships.ts`, `convex/students.ts`, `convex/guardians.ts`, `convex/permissions.ts`, `convex/lib/classAuth.ts`, `convex/lib/guardianAuth.ts`.

**Design decision:** keep `classes.userId` as denormalized creator metadata, but move all **authorization** to authz. Never use `userId` alone as an access check once join codes exist.

**Repo conventions:** Convex files import auth helpers from `#/lib/auth`; all public functions must declare `args` and `returns` validators; never call `Date.now()` in queries (mutations are fine).

---

## 7. Phase 1 — Solo teacher (ship first)

**Goal:** a teacher signs up, creates classes, shares join codes, and manages their class — zero org/team setup.

### Step 1.1 — Verify packages

Both packages are already in `package.json`. Run your package manager's install if `node_modules/@djpanda` is missing. Pin exact versions before shipping.

### Step 1.2 — Create `convex/convex.config.ts`

- Import `defineApp` from `convex/server` and the two components' `convex.config` entry points.
- Create the app, call `app.use(...)` for authz and for tenants, export the app as default.
- Run `npx convex dev` (never `deploy` during development) and leave it running. It regenerates `_generated/` so `components.authz` and `components.tenants` exist. Nothing else compiles until this step succeeds.

### Step 1.3 — Create `convex/authz.ts`

Single source of truth for permissions and roles. Contents, in order:

1. **Permissions:** call `definePermissions` with two arguments — the tenants defaults (`TENANTS_PERMISSIONS` exported by the tenants package) merged with your app resources:

- `class`: read, manage, manageMembers, grade, submit, viewOwnGrades, viewChildGrades
- `students`: create, list, enroll, unenroll, update
- `guardians`: link, unlink, viewLinkedStudents

2. **Roles:** call `defineRoles` with the permissions, the tenants defaults (`TENANTS_ROLES`), and your additions per the tables in §5 (org roles `principal`, `teacher`; class roles `student` → `assistantTeacher` → `classTeacher` → `creator` using the `inherits` field).
3. **Client:** instantiate `Authz` with the component reference, permissions, roles, and `tenantId: "classclarus"`. This global namespace holds solo-class role assignments. Org-scoped calls in Phase 2 go through `withTenant(organizationId)`. Do **not** configure `relationPermissions` for guardians (see §4 — the enrollment condition can't be expressed there).
4. Export the `authz` instance.

**Operational rule:** whenever you later edit role definitions and deploy, run the `syncRoles` action (exposed in Step 2.1 via `makeTenantsAPI`, invokable with `npx convex run tenants:syncRoles`). Without it, users who already hold a role keep the old materialized permission set.

### Step 1.4 — Create `convex/lib/classAuth.ts`

Two plain TypeScript helpers (not Convex functions), so every mutation/query doesn't repeat scope objects and permission strings:

- `requireClassPermission(ctx, userId, classId, permission)` — calls `authz.require` with scope `{ type: "class", id: classId }`. Throws on denial.
- `assignClassCreator(ctx, userId, classId)` — calls `authz.assignRole(userId, "creator", classScope)`. Mutation context only.

Type the `permission` parameter as a **union of your class permission string literals**, not `string` — typos then fail at compile time.

### Step 1.5 — Update `convex/schema.ts`

Edit the existing `classes` table (keep `authTables` spread untouched):

- Add optional fields: `organizationId` (string — tenants org id) and `teamId` (string). `undefined` = solo class. Never use a sentinel string.
- `**year` is required on every class** (see §3). If the schema still has `year` as optional, change it to required when you implement authz — `createClass` must reject missing `year`.
- Add three indexes: `by_studentCode`, `by_teacherCode`, `by_assistantTeacherCode` — without them `redeemJoinCode` is a full table scan.

**Code uniqueness requirement:** `generateJoinCode` currently just produces a random 6-char string. Before inserting a class (and in the regenerate mutation below), check each generated code against all three code indexes and regenerate on collision. This matters because redemption lookups use "exactly one match" semantics — a duplicate code would make redemption throw for both classes.

### Step 1.6 — Update `convex/classes.ts`

**Split the return validator (security-critical — see §14 item 1).** The current `classDoc` validator exposes `studentCode`, `teacherCode`, `assistantTeacherCode` to anyone who can read the class. A student could read `teacherCode` and redeem it to become a co-teacher. Fix:

- Define a `classDocPublic` validator **without** the three code fields (keep `publicDisplayPin` out too unless a feature needs it).
- `getClass`, `listClasses`, and the future `listMyClasses` return `classDocPublic` — strip the code fields from the doc before returning.
- Add a new query `getJoinCodes` — args: classId; precondition: `class:manageMembers`; returns just the three codes. The class settings UI calls this separately.

**Per-function changes:**

- `createClass` (mutation): **require `year` in args**; reject if missing. After the insert (with `organizationId`/`teamId` explicitly `undefined`), call `assignClassCreator`. Keep writing `userId` as metadata. Role assignment and insert are in the same mutation, so they commit atomically — Convex mutations are transactions. Document in the UI that teachers create a **new** class each academic year — there is no "roll forward" that reuses the same class id.
- `getClass` (query): `requireUser`; load the doc; if missing return null; call `authz.can(user, "class:read", classScope)` — if false, return null (indistinguishable from "not found", which avoids leaking class existence). Strip code fields.
- `updateClass` (mutation): replace the `getOwnedClass` check with `requireClassPermission(..., "class:manage")`, then load the doc and proceed. **Do not accept `year` in update args** — year is immutable after creation (§3). Archiving/unarchiving stays here (patching `archivedTime`), and archiving is always allowed regardless of archived state.
- `removeClass` (mutation): same `class:manage` precondition, **plus a data-retention guard**: if any `classEnrollments` rows reference this class (Phase 2+), refuse with "archive instead" — hard-deleting an org class would orphan enrollment/grade history that students and guardians are entitled to keep. Solo classes with no dependent rows may be deleted. Delete `getOwnedClass` once nothing references it.
- `removeClass` residual: role assignments scoped to the deleted class id remain in the authz component (there is no "delete all assignments for a scope" API). They are inert — the class doc is gone — but `listMyClasses` must tolerate them by dropping ids whose `db.get` returns null. Document this; optionally sweep with `revokeAllRoles` per known member if you track members.
- Add `regenerateJoinCode` (mutation): args classId + which code; precondition `class:manage`; generates a fresh unique code (collision-check per Step 1.5) and patches the class. This is your remediation when a code leaks. Regenerating does **not** revoke roles already redeemed — that's `authz.revokeRole` via a separate roster-management mutation if needed.
- `listClasses` (query): keep the `by_user` index for now; superseded by `listMyClasses` below.

### Step 1.7 — Create `convex/memberships.ts`

#### `redeemJoinCode` (mutation)

Args: `code` (string). Returns: classId + granted role name. Logic:

1. `requireUser`.
2. **Rate-limit** (see §14 item 3): track attempts per user (either the `@convex-dev/ratelimiter` component or a small `joinAttempts` table keyed by userId with a windowed counter). Reject with a generic error when over the limit. Without this, 6-char codes (~1 billion combinations) are brute-forceable by a patient scripted client.
3. Normalize: trim + uppercase (codes are generated uppercase).
4. Look up the code against the three indexes in sequence; take the first match. Because Step 1.5 guarantees uniqueness at generation time, a "multiple matches" result is impossible; treat it as an internal error if it ever occurs.
5. No match → throw a **generic** "Invalid join code" (do not reveal which code type was close).
6. **Archived guard:** if the matched class has `archivedTime` set, throw the same generic "Invalid join code" — prior-year classes must not admit new members, and the generic message avoids confirming the code was ever valid.
7. Determine the role from which field matched: `student`, `classTeacher`, or `assistantTeacher`.
8. **Org-class guard:** if the class has `organizationId` set and the matched role is `student`, do not assign a class role directly — hand off to the roster-linking path (`linkStudentUser`, §8.3). In Phase 1 you can simply throw "this class uses a school roster" since org classes don't exist yet.
9. If the user already holds this role on this class, return success idempotently (don't double-assign).
10. `authz.assignRole` with the class scope. Return `{ classId, role }`.

Redeeming a teacher code never removes the creator — roles are additive.

#### `listMyClasses` (query)

Args: optional `includeArchived`. Logic:

1. `requireUser`.
2. `authz.getUserRoles(ctx, userId)` — filter to entries whose scope type is `"class"`.
3. De-duplicate class ids (a user can hold multiple roles on one class).
4. `db.get` each id; **drop nulls** (deleted classes with orphaned assignments — see Step 1.6).
5. Filter archived unless requested. Return `classDocPublic` shapes (codes stripped) — students and co-teachers use this query, so redaction is mandatory here.

Cap the number of ids processed (e.g. first 200) and design the UI to group by `year`. Under the academic-year model roles are **never revoked at rollover**, so a long-tenured student legitimately accumulates classes every year — the cap is a guardrail against pathological accounts, not an expected limit. If a real user ever approaches it, switch this query to pagination over the role list rather than raising the cap.

### Step 1.8 — Create `convex/permissions.ts`

One public query, `checkClassPermission` — args: classId + permission; returns boolean. Logic: `getCurrentUser`; if null return false (never throw — this feeds UI); return `authz.can(user, permission, classScope)`.

**Validator hardening (see §14 item 5):** type the `permission` arg as a `v.union` of `v.literal(...)` for exactly the class permission strings the UI legitimately checks — not `v.string()`. The server-side check makes probing harmless, but a closed set keeps the surface auditable and stops garbage strings reaching the component.

### Step 1.9 — Frontend (minimal)

1. New route `src/routes/_account/join.tsx`: input + submit calling `redeemJoinCode`; on success navigate to `/c/$classId`; on error show the generic message.
2. In `src/routes/_account/c.$classId.tsx`: fetch `checkClassPermission` for `class:manage` and render edit/archive/delete controls only when true. Fetch `getJoinCodes` only inside the manage UI.
3. Point the class list at `listMyClasses` so co-teachers/students see joined classes.
4. Optionally wrap the app in the authz React provider (`AuthzProvider` from `@djpanda/convex-authz/react`) passing your `checkClassPermission` query ref, and use `PermissionGate`/`useCanUser` instead of ad-hoc queries. This is reactive — revoking a role updates the UI live.
5. **No org UI** in Phase 1.

Client-side gating is UX only. Every server function re-checks permissions; assume the client is hostile.

### Phase 1 done when

- [ ] Teacher signs up, creates class; no org exists anywhere
- [ ] Creator can edit/archive; non-member gets null / permission error
- [ ] Second user redeems `teacherCode`, gains edit access; creator unaffected
- [ ] Student redeems `studentCode`, sees the class read-only, **cannot see any join codes**
- [ ] Join-code brute force is rate-limited
- [ ] `npx convex dev` runs clean with both components

---

## 8. Phase 2 — Schools, org students, guardians

**Goal:** teachers join a school, migrate solo classes, manage a cross-grade student roster, enroll students in classes (including new-year classes), and link guardians whose access follows active enrollments.

### Step 2.1 — Create `convex/tenants.ts`

Call `makeTenantsAPI(components.tenants, options)` and re-export the returned functions you need (`createOrganization`, `getOrganization`, `listOrganizations`, `inviteMember`, `acceptInvitation`, `listMembers`, `getMember`, `getCurrentMember`, `addMember`, `removeMember`, team functions, `checkPermission`, `getUserRoles`, `syncRoles`, `syncRole`). Options to set:

- `authz`: your instance from `convex/authz.ts`.
- `creatorRole: "owner"`.
- `auth`: return `getAuthUserId(ctx)` (from `@convex-dev/auth/server`) or null.
- `getUser`: load the user doc and return `{ name, email }` — tenants uses it to enrich member lists.
- `roleHierarchy`: owner 5, admin 3, principal 3, teacher 1, member 0 — only used by `checkMemberPermission(minRole)`; prefer the authz-backed `checkPermission` for anything custom.
- `validRoles`: exactly `["owner", "admin", "principal", "teacher", "member"]`. This is defense-in-depth: any mutation receiving a role string outside the list is rejected at the API boundary, so nobody can invent a role via `addMember`. **No guardian role** — guardians are never members.
- `onInvitationCreated` hook: this runs inside the invite **mutation**, so you cannot call external email APIs here. Schedule an **internal action** via `ctx.scheduler.runAfter(0, internal.emails.sendInvitation, {...})`. The email action lives in its own file with the `"use node"` directive only if your email SDK requires Node APIs. Never schedule public `api.*` functions — internal only.

The exported functions are public Convex queries/mutations (and `syncRoles`/`syncRole` are actions) with tenants' own permission checks wired to your authz instance.

### Step 2.2 — Add tables to `convex/schema.ts`

`**orgStudents`** — the stable per-school student record:

| Field          | Type                 | Notes                              |
| -------------- | -------------------- | ---------------------------------- |
| organizationId | string               | tenants org id                     |
| displayName    | string               | roster name                        |
| userId         | optional id("users") | set when the student links a login |
| externalId     | optional string      | SIS id                             |

Indexes: `by_organization`, `by_user`.

`**classEnrollments**` — links student to class, never deleted:

| Field          | Type              | Notes                                      |
| -------------- | ----------------- | ------------------------------------------ |
| organizationId | string            | denormalized for cheap same-org validation |
| classId        | id("classes")     |                                            |
| orgStudentId   | id("orgStudents") |                                            |
| status         | "active"          | "withdrawn"                                | withdraw, don't delete — audit trail |

Indexes: `by_class`, `by_orgStudent`, `by_class_and_student` (compound).

`**guardianLinks**` — denormalized mirror of the ReBAC relation:

| Field          | Type              | Notes                                          |
| -------------- | ----------------- | ---------------------------------------------- |
| organizationId | string            |                                                |
| guardianUserId | id("users")       |                                                |
| orgStudentId   | id("orgStudents") |                                                |
| linkedByUserId | id("users")       | audit                                          |
| linkedAt       | number            | ms timestamp (written in a mutation — allowed) |

Indexes: `by_guardian` (guardianUserId + organizationId), `by_orgStudent`, `by_guardian_and_student` (compound, used for idempotency).

`**guardianInvites**` — consent flow (see Step 2.5 and §14 item 4):

| Field           | Type              | Notes                |
| --------------- | ----------------- | -------------------- |
| organizationId  | string            |                      |
| orgStudentId    | id("orgStudents") |                      |
| email           | string            | normalized lowercase |
| invitedByUserId | id("users")       |                      |
| status          | "pending"         | "accepted"           | "revoked" | "expired" |     |
| expiresAt       | number            | e.g. 14 days         |

Indexes: `by_email_and_status`, `by_orgStudent`.

**Why `orgStudents` separate from enrollments?** Jamie is one person across years and subjects. One stable `orgStudentId` + **many** enrollment rows (one per class, including multiple active years) preserves history and keeps guardian relations valid without any transfer operation — this mirrors how SIS systems model it.

### Step 2.3 — Create `convex/students.ts`

All are public **mutations** except list queries. Every one starts with `requireUser`.

#### `createOrgStudent`

Args: organizationId, displayName, optional externalId. Precondition: `students:create` checked via `authz.withTenant(organizationId).require(...)` with scope `{ type: "organization", id }`. Insert and return the id. Who passes: org owner, principal, teacher (per §5 role table).

#### `enrollStudent`

Args: classId, orgStudentId.

1. Load class; require `organizationId` set ("not an org class" otherwise). **Reject if `archivedTime` is set** — no new enrollments into completed years (§3).
2. Load orgStudent; require same `organizationId` as the class. **Derive the org from the documents — never accept an orgId arg to authorize against** (§14 item 7).
3. Permission: `students:enroll`, org scope, via `withTenant`.
4. Look up `by_class_and_student` for **this classId**; if an active enrollment exists, throw "already enrolled". If a withdrawn one exists for this same class, patch it back to active instead of inserting a duplicate row. **Do not** withdraw or modify enrollments in any other class — multi-class and multi-year enrollment is normal.
5. Insert (or reactivate) the enrollment for this class only.
6. If `orgStudent.userId` is set, assign the authz `student` role scoped to **this** class (global namespace). Do not revoke roles on other classes the student is already in.

**There is no `transferStudent`.** Starting a new academic year means creating a new class (with the new `year`) and calling `enrollStudent` for each student. Last year's class is archived separately; its enrollments and roles stay in place for historical access.

#### `unenrollStudent`

Args: classId, orgStudentId. Precondition `students:unenroll`, org scope. Patch **this** enrollment to withdrawn; revoke the class-scoped `student` role on **this class only** if `userId` is set. Use for mid-year removal or correcting a mistaken enrollment — **not** for year rollover (archive the class instead; see §3). Guardian access to that class ends automatically via the enrollment condition.

#### `linkStudentUser`

Called when a logged-in student redeems `studentCode` on an org class (the branch from §7.7 step 7). Logic:

1. From the redeemed class, get its organizationId.
2. Find an `orgStudents` row for this org whose `userId` equals the current user; if none, this flow needs teacher intent — either (a) teacher pre-created the roster row and shares a per-student claim mechanism, or (b) minimum viable: create the orgStudent row with the account's display name and let staff merge/rename later. Pick one and document it; (a) is safer against strangers with the code self-adding to a school roster.
3. Set `userId` on the orgStudent if unset. Refuse if it is set to a **different** user (account takeover guard).
4. Ensure an active enrollment for this class exists (create if the roster intended it; otherwise refuse — code alone should not create enrollments if you chose (a)).
5. Assign the class-scoped `student` role.

#### `listOrgStudents` (query)

Args: organizationId + pagination opts. Precondition `students:list` org-scoped. Query `by_organization` with `.paginate` — rosters are unbounded, never `.collect()`.

### Step 2.4 — `assignClassesToTeam` (mutation, in `convex/memberships.ts`)

Brings solo classes into a school. Args: classIds array, organizationId, teamId.

1. `requireUser`; verify caller is an active org member (`getCurrentMember`-equivalent check).
2. Verify the team exists and belongs to the org (tenants `getTeam`).
3. For each class: caller must hold `class:manage` (creator) on it — this is the consent gate; org admins cannot pull in classes they don't own. Each class must currently be solo (`organizationId` undefined) — no cross-org moves.
4. Patch `organizationId` + `teamId` on each class.
5. Nothing else changes: class `_id`, join codes, and existing authz roster roles survive. Students do not re-join. Optionally prompt the teacher to import existing solo students into `orgStudents` (per student: create row, create active enrollment, keep their class role).

### Step 2.5 — Guardians (`convex/guardians.ts` + `convex/lib/guardianAuth.ts`)

**Do not link by user id.** A teacher typing/choosing an arbitrary `userId` and instantly granting that account access to a child's data is an enumeration and mis-linking hazard (§14 item 4). Use an email-verified invite:

#### `inviteGuardian` (mutation)

Args: classId, orgStudentId, guardianEmail.

1. `requireUser` (teacher).
2. Precondition A: `class:manageMembers` on the class (class scope, global namespace).
3. Precondition B: `guardians:link` on the org (org scope via `withTenant`) — belt and suspenders; a co-teacher who isn't org staff can't invite.
4. Load class (must have organizationId) and orgStudent (must match the class's org). Verify an **active** enrollment for (classId, orgStudentId) — teachers may only invite guardians for students currently in their class.
5. Normalize email to lowercase. If a pending, unexpired invite for (email, orgStudentId) exists, resend instead of duplicating. If a `guardianLinks` row already exists for a user with this email, return "already linked".
6. **Anti-spam caps:** rate-limit invites per teacher (e.g. N per hour, same mechanism as `redeemJoinCode`) and cap pending invites per orgStudent (e.g. 5). Teachers can send email to arbitrary addresses through this mutation — without caps it is an email-spam relay.
7. Insert `guardianInvites` with status pending and an expiry (mutations may call `Date.now()`).
8. Schedule an **internal action** to send the email (never send from the mutation). The Convex document id of the invite is unguessable and can serve as the claim reference in the link; do not put student names in the email body.

#### `acceptGuardianInvite` (mutation)

Args: inviteId.

1. `requireUser` (the guardian, now signed in).
2. Load invite; must be status pending and `expiresAt` in the future (compare against `Date.now()` — mutation, allowed).
3. **Email match is mandatory:** the invite's email must equal the authenticated user's verified email (from the user doc populated by `@convex-dev/auth`). Holding the invite id alone is not sufficient — this is what makes the flow consent-based and phishing-resistant.
4. Add the ReBAC relation: `authz.withTenant(organizationId).addRelation(subject {type "user", id guardianUserId}, "guardian_of", object {type "orgStudent", id orgStudentId})`, with `createdBy` = the inviting teacher for audit. Check `hasRelation` first for idempotency.
5. Insert the `guardianLinks` mirror row (skip if the compound index already has it).
6. Mark the invite accepted. All in one mutation — atomic.

#### `unlinkGuardian` (mutation)

Args: orgStudentId, guardianUserId. Preconditions: `class:manageMembers` on a class where the student is actively enrolled **or** `guardians:unlink` org-scoped (principals can unlink without a class). Remove the relation via `removeRelation` (org tenant namespace), delete the `guardianLinks` row, revoke any pending invites for the pair. Guardians should also be able to unlink **themselves** (self-service removal): allow when the caller is the guardianUserId.

#### `requireGuardianAccess` helper (`convex/lib/guardianAuth.ts`, plain function)

The §4 invariant, used by **every** guardian-facing query. Inputs: ctx, guardianUserId, orgStudentId, classId.

1. Load orgStudent → derive organizationId (never from client args).
2. Load enrollment via `by_class_and_student`; must exist with status active — otherwise throw. This is the condition that makes access follow the student.
3. `authz.withTenant(organizationId).hasRelation(user → guardian_of → orgStudent)`; false → throw.

`hasRelation` runs a component query, so this helper works in queries and mutations alike.

#### `listMyChildren` (query)

Args: none (derive everything from the caller). `requireUser`; read `guardianLinks` via `by_guardian` across the caller's orgs (or per-org arg used only as a filter, never for auth); for each link load the orgStudent and its **active** enrollments with class names. This doubles as the guardian's "which schools am I connected to" source — no org membership needed.

#### `listGuardiansForStudent` (query)

Args: classId, orgStudentId. Precondition: `class:manageMembers`. Read `guardianLinks` by `by_orgStudent`, join user name/email for display. Also list pending invites from `guardianInvites`.

#### Invite expiry sweep (optional)

A cron (`convex/crons.ts`) running an **internal mutation** daily that marks expired pending invites as expired — keeps `by_email_and_status` queries clean without ever checking time in a query.

### Step 2.6 — Frontend (Phase 2)

1. Tenants provider + organization switcher (staff only see it; guardians and students never do).
2. Accept-invitation flow for staff; accept-guardian-invite page keyed by invite id (works only when the signed-in email matches).
3. "Bring your classes" UI → `assignClassesToTeam`.
4. Org roster CRUD + enroll UI (add students to classes; bulk enroll into new-year classes).
5. Guardian dashboard driven by `listMyChildren`.
6. Team management (create team, assign `team_leader`).

### Phase 2 done when

- [ ] Principal creates org, invites teacher; teacher accepts and migrates solo classes
- [ ] Owner/principal/teacher can create + enroll org students; others cannot
- [ ] New academic year: staff create new classes with new `year`, enroll students; prior-year classes archived with enrollments still active
- [ ] Student enrolled in class A and class B simultaneously retains access to both; prior-year class still readable after new-year enrollment
- [ ] Guardian accepted invite while student in class A; after enroll in class B sees **both** (and prior years) — with zero guardian writes on enroll
- [ ] Guardian never appears in `listMembers`; holds no roles in authz
- [ ] Guardian invite for a different email cannot be accepted
- [ ] Solo-teacher path unchanged

---

## 9. Phase 3 — District hierarchy

**Goal:** district admins see all schools; nested teams model district → school → grade.

1. Create the district org with `metadata.type = "district"`.
2. Schools are root-level teams with `metadata.type = "school"`.
3. Grade/subject teams set `parentTeamId` to their school team.
4. Add a `district_admin` org role in `authz.ts` with broad read + `students:enroll` / `students:list`. Run `syncRoles` after deploying the role change.
5. Use `listTeamsAsTree` for admin navigation.

**Why not one org per school?** Cross-school reporting within a district needs one org. One org + nested teams keeps `orgStudents` district-wide; enrolling a student in a new school's class for a new year is the same `enrollStudent` flow — no cross-org transfer.

---

## 10. Adding new member types — how org roles scale

You will eventually have many kinds of people attached to an org: counselors, librarians, substitutes, registrars, IT admins, aides. This section explains how the design already handles that, and why students and guardians stay outside it.

### How tenants roles actually work (important mental unlock)

Tenants does **not** have its own role system. An org member's `role` is a **free-form string** stored on the membership row; the _meaning_ of that string comes entirely from your authz role catalog:

1. When a member is added with role `"principal"`, tenants calls `authz.assignRole(userId, "principal", { type: "organization", id: orgId })` under the hood.
2. Every guarded tenants operation checks an authz permission (per its permission map — `members:add`, `teams:create`, …) against that org scope.
3. Your `validRoles` allowlist (§8.1) is the only gate on which strings are accepted.

So "custom roles in tenants" and "custom roles in authz" are the **same thing**: one role catalog in `convex/authz.ts`, referenced by both class scopes and org scopes. There is nothing separate to configure in tenants beyond the allowlist.

### The 4-edit recipe for a new staff-like member type

To add, say, `counselor` (can view incidents and student records, cannot manage teams):

1. `**convex/authz.ts`** — add the role to `defineRoles` with exactly the permission grants it needs (e.g. `organizations: ["read"]`, `students: ["list"]`, `incidents: ["read"]`). Use `inherits`/`includes` to build on existing roles when sensible.
2. `**convex/tenants.ts**` — add `"counselor"` to `validRoles`, and to `roleHierarchy` if staff-UI role comparisons need it (pick a level; unknown roles default to 0).
3. **Deploy, then run `syncRoles`** (`npx convex run tenants:syncRoles`) so any pre-existing assignments re-materialize.
4. `**convex/permissions.ts` / UI** — extend the closed permission unions if the UI needs to check the new permissions.

No schema changes, no new tables. Invitations, suspension, member lists, and org-scoped permission checks all work immediately because the new role flows through the same machinery.

### Why students and guardians are still not member types

The question "students can join orgs, so why not a `student` org role?" conflates two things:

- **Org membership** answers "what can this person do to the _organization_?" (manage members, teams, roster). Students and guardians need **zero** org-level capabilities.
- **Access to class content** is what students/guardians actually need, and it is already fully expressed by class-scoped roles (students) and relation + enrollment (guardians).

Making them org members would buy nothing they need and cost real problems: tenants' default `member` role grants `members:list` / `teams:list` (students could enumerate staff), every staff directory query would need filtering, invitation emails and member caps would apply to children, and `maxMembers` limits would fill with non-staff. A student's org linkage already exists — it is the `orgStudents` row, which is the right shape (no login required, staff-managed, carries SIS ids). **The elegance is the taxonomy itself:** tenants = agents who act _on_ the org; `orgStudents` + enrollments = subjects the org teaches; ReBAC = relatives of subjects. Every future person-type slots into exactly one of these.

### Runtime-defined roles (optional, later)

If schools eventually want to define their **own** roles without you redeploying ("create a 'Vice Principal' role with these checkboxes"), authz has a built-in `customRoles` feature: you configure `customRoles: { enabled: true, grantablePermissions: [...] }` on the `Authz` instance with a whitelist of permission strings school admins may compose, and use `createCustomRole` / `assignCustomRole` (scoped per org via `withTenant`). Custom role assignments cannot exceed the whitelist, so a school can never self-grant permissions you didn't expose. Do not build this until a customer asks — the compile-time catalog is easier to audit — but know the escape hatch exists and requires no data migration.

---

## 11. Extending to new features — assignments, grades, points, incidents

Everything after auth (assignments, tasks, grades, points, behavior incidents, attendance…) follows **one recipe**. If you honor these invariants, every new feature inherits the security properties of the core design.

### The recipe

**1. Schema.** New table(s) always carry `classId`. Rows _about a specific student_ also carry `orgStudentId` (org classes) or `studentUserId` (solo classes) — decide per feature whether solo is supported. Index `by_class`, plus `by_class_and_student` for per-student rows. Unbounded lists get pagination, never `.collect()`.

**2. Permissions.** Add a resource (or actions) in `definePermissions`, grant to roles in `defineRoles`, deploy, run `syncRoles`. Two granularities:

- Piggyback on existing class permissions when the feature maps cleanly: assignments CRUD ≈ `class:manage` or a new `assignments:create`; submitting ≈ `class:submit`; grading ≈ `class:grade`.
- New resource when audiences differ from the existing roles — e.g. `incidents: { create, read, update, resolve }` where `assistantTeacher` may create but only `classTeacher`+ may read others' reports.

**3. Authorization per audience — every public function picks the right check:**

| Caller                                                  | Check                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Staff (creator/classTeacher/assistantTeacher)           | `requireClassPermission(ctx, userId, row.classId, "<permission>")`                                                                                                                                                                                                                                                 |
| Student acting on **own** rows                          | class permission (e.g. `class:submit`, `class:viewOwnGrades`) **AND ownership**: the row's `orgStudentId` resolves to an orgStudent whose `userId` is the caller (or `studentUserId === caller` for solo). Never let a student pass on the class permission alone — that is how student A reads student B's grades |
| Guardian                                                | `requireGuardianAccess(ctx, callerId, row.orgStudentId, row.classId)` — the §4 two-step check. Guardian reads are **per-student**: return only rows for their linked child, never class-wide data                                                                                                                  |
| Org staff dashboards (principal viewing across classes) | org-scoped permission via `withTenant` (e.g. `incidents:read` on the org), deriving the org from the loaded row's class                                                                                                                                                                                            |

**4. The four universal invariants** (same as core, restated for content):

1. **Derive, never trust:** classId/orgId/orgStudentId used in authorization come from the **loaded row**, not from client args. Client args only select which row to load.
2. **Archived = read-only:** every content-_writing_ mutation loads the class and rejects if `archivedTime` is set. Reads stay open — that is the whole point of retention.
3. **Soft-delete anything grade- or incident-bearing:** status fields (`draft`/`published`/`resolved`/`voided`), not row deletion — same rationale as withdrawn enrollments. Points ledgers should be append-only (corrections are new rows with negative/adjusting values).
4. **Closed validators:** args and returns fully validated; permission strings in UI-facing check queries stay closed unions (extend the union when you add permissions).

**5. Sensitive-feature notes.**

- **Grades:** store per (classId, orgStudentId, assignmentId). Students read via ownership check; guardians via `requireGuardianAccess`; a grade-change history (append rows, don't overwrite) gives you an audit trail teachers and parents will eventually demand.
- **Incidents:** often should be visible to staff only, or staff + that student's guardians — put a `visibility` field on the row and enforce it _in addition to_ the audience checks. Never include other students' names in guardian-visible rows.
- **Points:** high write volume; consider an append-only ledger + a denormalized total on a summary row. All writes are mutations (atomic), so totals stay consistent.
- **Notifications/emails** about any of these follow the same rule as invites: schedule internal actions, minimal PII in the payload.

**6. Where code lives.** One file per feature (`convex/assignments.ts`, `convex/grades.ts`, `convex/incidents.ts`, …); shared audience-check helpers stay in `convex/lib/`; wrappers thin, logic in plain functions — same file discipline as the core.

A feature built this way needs **no changes** to the auth core: roles, enrollments, and guardian relations already answer "who is this person to this class/student", and the recipe just asks those questions consistently.

---

## 12. Convex function type reference

| Function                                                                                                                                                                                                                                          | Type                                                                          | Why                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getClass`, `listClasses`, `listMyClasses`, `getJoinCodes`, `checkClassPermission`, `listOrgStudents`, `listMyChildren`, `listGuardiansForStudent`                                                                                                | **query**                                                                     | reads only; authz `can`/`hasRole`/`hasRelation`/`getUserRoles` are query-safe                                                                                        |
| `createClass`, `updateClass`, `removeClass`, `regenerateJoinCode`, `redeemJoinCode`, `assignClassesToTeam`, `createOrgStudent`, `enrollStudent`, `unenrollStudent`, `linkStudentUser`, `inviteGuardian`, `acceptGuardianInvite`, `unlinkGuardian` | **mutation**                                                                  | db writes + authz `assignRole`/`revokeRole`/`addRelation`/`removeRelation` need mutation context; each is atomic                                                     |
| Invitation / guardian-invite email sending                                                                                                                                                                                                        | **internal action** (own file; `"use node"` only if the email SDK needs Node) | external network calls are forbidden in mutations; scheduled from the mutation via `ctx.scheduler.runAfter(0, internal.…)` — never schedule public `api.`* functions |
| `syncRoles`, `syncRole` (from `makeTenantsAPI`)                                                                                                                                                                                                   | **action** (provided)                                                         | pages through users, one mutation per user; run after any role-definition change: `npx convex run tenants:syncRoles`                                                 |
| Invite-expiry sweep                                                                                                                                                                                                                               | **internal mutation** on a cron                                               | time-based status updates belong in mutations, never queries                                                                                                         |
| `requireClassPermission`, `assignClassCreator`, `requireGuardianAccess`, `getCurrentUser`, `requireUser`                                                                                                                                          | plain TypeScript helpers                                                      | shared logic; keep function wrappers thin                                                                                                                            |

No `"use node"` anywhere except (possibly) the email action. Everything else uses the default Convex runtime.

---

## 13. File reference

| File                         | Responsibility                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `convex/convex.config.ts`    | Register authz + tenants components                                              |
| `convex/authz.ts`            | Permission catalog, role catalog, `authz` client export                          |
| `convex/tenants.ts`          | `makeTenantsAPI` re-exports — staff org/team/member/invitation functions         |
| `convex/schema.ts`           | `classes`, `orgStudents`, `classEnrollments`, `guardianLinks`, `guardianInvites` |
| `convex/classes.ts`          | Class CRUD, code redaction, `getJoinCodes`, `regenerateJoinCode`                 |
| `convex/memberships.ts`      | `redeemJoinCode`, `listMyClasses`, `assignClassesToTeam`                         |
| `convex/students.ts`         | Roster: create, enroll, unenroll, link account, list                             |
| `convex/guardians.ts`        | Invite, accept, unlink, list queries                                             |
| `convex/permissions.ts`      | `checkClassPermission` for React hooks                                           |
| `convex/lib/classAuth.ts`    | `requireClassPermission`, `assignClassCreator`                                   |
| `convex/lib/guardianAuth.ts` | `requireGuardianAccess` (relation + active-enrollment check)                     |
| `convex/emails.ts`           | internal action(s) for outbound email                                            |
| `src/lib/auth.ts`            | `requireUser` (unchanged)                                                        |

---

## 14. Security audit — issues and required mitigations

Issues found in earlier drafts and in the current codebase, in priority order. Each mitigation is already woven into the steps above; this is the checklist.

1. **Join-code privilege escalation (current code, critical).** `classDoc` — returned by `getClass`/`listClasses` — includes `studentCode`, `teacherCode`, `assistantTeacherCode`. Once students can read a class, any student can read the teacher code and redeem it for `classTeacher`. **Fix:** redacted public validator everywhere; codes only via `getJoinCodes` gated on `class:manageMembers` (§7.6). Add `regenerateJoinCode` for leak remediation.
2. **Stale roles after unenroll (high).** `unenrollStudent` must revoke the class-scoped `student` role on **that class only** — never revoke roles on other enrollments. Conversely, **do not** revoke prior-year roles when enrolling in a new-year class; historical access depends on keeping them.
3. **Join-code brute force (design gap, medium).** Six chars from a 32-symbol alphabet is fine against casual guessing but not against an unthrottled script. **Fix:** per-user rate limit on `redeemJoinCode`; generic error messages (§7.7).
4. **Guardian linking by user id (previous draft, high).** Letting a teacher attach an arbitrary existing account to a child's records enables mis-linking and account enumeration, with FERPA-adjacent consequences. **Fix:** email invite + signed-in email match on accept (§8.5). The invite id is unguessable but is deliberately **not** sufficient alone.
5. **Open-ended permission strings (previous draft, low).** `checkClassPermission` accepted any string. Server-side checks make probing harmless, but a closed `v.union` of literals keeps the audit surface finite (§7.8).
6. **Join-code collision (previous draft, low but breaks redemption).** Random generation without a uniqueness check can produce duplicate codes across classes; "exactly one match" lookups then throw for both. **Fix:** collision-check at generation (§7.5).
7. **Client-supplied org ids in auth decisions (design rule).** Any function that authorizes against an organization must derive the org id from documents it loads (class, orgStudent), never from a raw arg — otherwise a caller authorized in org A can operate on org B's rows (§8.3, §8.5).
8. **Orphaned authz assignments on class delete (accepted residual).** No scope-wide revoke API exists; assignments to a deleted class id are inert but persistent. Queries must null-filter; optionally sweep (§7.6).
9. **Existence leaks (hardening).** `getClass` returns null for both "not found" and "no access"; `redeemJoinCode` errors are generic. Keep it that way.
10. **Role-definition drift (operational).** Editing `defineRoles` and deploying does **not** update already-assigned users until `syncRoles` runs. Make it a deploy-checklist item (§7.3, §12).
11. **Scheduling discipline (workspace rule).** Only `internal.`* functions may be scheduled — scheduled functions bypass public auth. The email actions and cron sweeps are internal (§8.1, §8.5).
12. **Guardian data minimization.** Guardian-facing queries return only the linked student's data, checked per (student, class) via `requireGuardianAccess` — never "all students in the class". Emails to guardians omit student names.
13. **Archived classes writable (year-model gap, high).** Under the academic-year model, student roles on archived classes are deliberately kept, so the `class:submit` / `class:grade` permissions still pass. Without an explicit archived guard, anyone could keep writing into last year's class — grade tampering after the fact. **Fix:** every content-writing mutation, plus `enrollStudent` and `redeemJoinCode`, rejects archived classes (§3, §7.7, §8.3, §11 invariant 2).
14. **Hard-deleting classes with history (high).** `removeClass` on an org class would orphan enrollments and any grade/content rows, destroying records students and guardians are entitled to retain. **Fix:** refuse deletion when dependent rows exist; archive instead (§7.6). `year` is likewise immutable to prevent re-labeling history (§3, §7.6).
15. **Guardian-invite email relay (medium).** `inviteGuardian` sends email to an arbitrary address supplied by any user holding `class:manageMembers`. **Fix:** rate-limit invites per teacher and cap pending invites per orgStudent (§8.5 step 6).

---

## 15. Testing checklist

### Authorization

- [ ] Unauthenticated user cannot call any mutation
- [ ] Non-member cannot read a class (gets null, not an error revealing existence)
- [ ] Student cannot `class:manage`; assistant can `grade` but not `manageMembers`; creator can delete
- [ ] `checkClassPermission` returns false (not throws) when signed out

### Join codes

- [ ] Invalid code → generic error; repeated failures → rate limited
- [ ] Same code redeemable by many students; redemption idempotent per user
- [ ] Student cannot obtain any join code through any query response
- [ ] Regenerated code invalidates the old string immediately; existing roles unaffected
- [ ] Code on an **archived** class is rejected with the same generic error

### Solo vs org

- [ ] `createClass` leaves `organizationId` undefined
- [ ] Solo class invisible to org admins; `assignClassesToTeam` refuses classes the caller doesn't manage and classes already in an org

### Roster & enrollments

- [ ] `createClass` rejects missing `year`; two classes with the same name but different `year` are distinct ids
- [ ] `updateClass` cannot change `year`
- [ ] Student can be actively enrolled in multiple classes (and multiple years) at once
- [ ] Archiving a prior-year class does not withdraw enrollments or revoke student roles on that class
- [ ] Archived class: reads still work for enrolled students/guardians; `enrollStudent` and content-writing mutations are rejected
- [ ] `removeClass` refuses when enrollments exist; solo class without dependents deletes cleanly
- [ ] `unenrollStudent` withdraws one enrollment and revokes role on that class only
- [ ] Duplicate active enrollment in the **same** class rejected; withdrawn enrollment in that class reactivates instead of duplicating
- [ ] No `transferStudent` (or equivalent) exists in the API surface

### Guardians

- [ ] Invite accepted only by the matching signed-in email; expired invite rejected
- [ ] Guardian sees all classes where the child has active enrollments (current year + prior years)
- [ ] After student enrolled in an additional class, guardian sees the new class with no guardian-side writes
- [ ] Guardian holds zero authz roles and zero tenants memberships; absent from `listMembers`
- [ ] Guardian cannot see other students in the same class
- [ ] Unlink (by staff or self) removes relation + link row; access ends immediately
- [ ] Teacher can only invite guardians for students actively enrolled in a class they manage
- [ ] Guardian invites are rate-limited per teacher; pending invites per student capped

### Extensibility (when features land)

- [ ] Student A cannot read student B's grades/submissions even in the same class (ownership check, not just class permission)
- [ ] Guardian sees only their linked child's rows, never class-wide content
- [ ] Content mutations on archived classes rejected; reads permitted
- [ ] New org role (e.g. counselor) works end-to-end after the 4-edit recipe + `syncRoles`

---

## 16. Common pitfalls

**Using `classes.userId` as authorization.** Co-teacher redeems a code but ownership checks throw. All access goes through authz; `userId` is metadata.

**Putting students or guardians into tenants membership.** Students in the staff directory; invitation emails to 9-year-olds; guardian roles accidentally inheriting staff permissions. Students live in `orgStudents` + class roles; guardians live in ReBAC + `guardianLinks` (§4). `validRoles` enforces this at the boundary.

**Class-scoped guardian roles.** Parent loses access on unenroll or, worse, keeps access incorrectly. Guardian access is _derived_ (relation + active enrollment), never assigned per class.

**Reusing one class across academic years.** Overwrites or commingles grade history; breaks the "retain prior-year access" model. **New year → new class row** with a new `year` (§3).

**Unenrolling or revoking roles for year rollover.** Students lose access to last year's grades. **Archive** the old class; keep enrollments and roles active.

**Relying on `relationPermissions` for guardian checks.** The relation grants permissions on the orgStudent object, not on classes — a class-scoped `can` won't pass through it, and it can't express the active-enrollment condition. Use the explicit helper.

**Forgetting `withTenant(orgId)` for org-scoped calls.** Relations/roles written in the wrong namespace pass locally and fail in production-shaped data. Every school-scoped authz call goes through `withTenant`.

**Implementing `transferStudent`.** Not part of this product model. Enroll in the destination class; leave source enrollments alone unless explicitly unenrolling.

**Deleting enrollments instead of withdrawing.** Lost audit trail. Patch status to `withdrawn`, never delete rows.

**Team leader without org membership.** Team roles grant no org permissions; ensure leaders are org members with role `teacher`.

**Auto-creating an org on signup.** Every solo teacher gets a hidden "My School". Orgs are created only by explicit user action.

**Editing roles without `syncRoles`.** Existing users keep stale materialized permissions (§14 item 10).

**Checking only the class permission for student content access.** `class:viewOwnGrades` says _what kind_ of access; the ownership match (row's student = caller) says _whose rows_. Both are required (§11).

**Forgetting the archived guard on a new feature's mutations.** Roles stay live on archived classes by design, so the guard is the only write barrier (§14 item 13).

**Missing `args`/`returns` validators; `Date.now()` in queries; unindexed `.filter()`; unpaginated `.collect()` on rosters.** All violate workspace rules; the steps above specify the compliant pattern in each case.

---

## 17. Glossary

| Term                    | Meaning                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **authz**               | `@djpanda/convex-authz` — scoped-role + ReBAC permission engine                                                                               |
| **tenants**             | `@djpanda/convex-tenants` — staff org/team/member management                                                                                  |
| **Component**           | Isolated Convex sub-backend with its own tables, registered in `convex.config.ts`                                                             |
| **Scope**               | Resource context for a permission, e.g. `{ type: "class", id }`                                                                               |
| **RBAC / ReBAC**        | Role-based / relationship-based access control                                                                                                |
| **Tenant namespace**    | authz partition; `"classclarus"` global for class roles, `withTenant(orgId)` per school                                                       |
| **orgStudent**          | Stable student record within an organization                                                                                                  |
| **classEnrollment**     | orgStudent ↔ class link, active or withdrawn; a student may have many active rows; drives guardian access                                     |
| **Academic-year class** | Class with required `year`; new year = new class document, not an update to last year's row                                                   |
| **guardian_of**         | ReBAC relation user → orgStudent; the stable parent↔child link                                                                                |
| **guardianLinks**       | Denormalized mirror of guardian_of for fast list queries                                                                                      |
| **guardianInvites**     | Email-verified consent flow for creating guardian links                                                                                       |
| **Solo class**          | `organizationId` undefined — independent of any school                                                                                        |
| **team_leader**         | Custom team-member role string, not a tenants built-in                                                                                        |
| **Structural owner**    | tenants `ownerId` on the org — removable only via ownership transfer                                                                          |
| **Archived guard**      | Rule that content-writing mutations reject classes with `archivedTime` set; the sole write barrier on completed years                         |
| **customRoles (authz)** | Optional runtime feature letting org admins compose roles from a provider-defined permission whitelist; escape hatch for school-defined roles |

---

## Suggested order of work (summary)

```
Phase 1 (solo teacher)
  1. convex.config.ts + npx convex dev
  2. authz.ts (permissions + roles + client)
  3. lib/classAuth.ts
  4. Schema: code indexes, org fields, unique code generation
  5. classes.ts: required year, creator role, authz checks, code redaction, getJoinCodes, regenerate
  6. memberships.ts: redeemJoinCode (rate-limited), listMyClasses
  7. permissions.ts + join route + permission-gated UI

Phase 2 (schools)
  8. tenants.ts (makeTenantsAPI + email internal action)
  9. Schema: orgStudents, classEnrollments, guardianLinks, guardianInvites
  10. students.ts: create, enroll, unenroll, linkStudentUser
  11. lib/guardianAuth.ts + guardians.ts (invite → accept → unlink; list queries)
  12. assignClassesToTeam
  13. Org UI, roster UI, guardian dashboard

Phase 3 (districts)
  14. Nested teams + district_admin role + syncRoles

Features (each follows the §11 recipe)
  15. assignments.ts / grades.ts / points.ts / incidents.ts …
```

Work Phase 1 until solid before starting Phase 2 — the patterns (scoped roles, `require`, `assignRole`, redaction, rate limiting, archived guard) are the foundation for everything else, including every feature you add later.

---

_Last updated: full audit pass. Added §10 (new org member types — tenants roles ARE authz roles; 4-edit recipe; students/guardians stay out; optional runtime customRoles) and §11 (feature-extension recipe with audience checks and invariants). New hardening: archived classes are read-only (guard on all content writes, enroll, and code redemption), `year` immutable, `removeClass` blocked when history exists, guardian-invite rate limits. Security audit items 13–15 added._
