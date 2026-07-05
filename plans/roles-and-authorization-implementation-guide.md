# ClassClarus Roles & Authorization — Implementation Guide

This document is a step-by-step guide for implementing ClassClarus v1 roles and authorization on your own. It explains **what** to build, **why** each piece exists, and **how** the parts fit together.

Read this top-to-bottom before writing code. Implement in **three phases** — do not try to build everything at once.

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Why these libraries](#2-why-these-libraries)
3. [Domain mapping](#3-domain-mapping)
4. [Three layers of roles](#4-three-layers-of-roles-do-not-mix-them)
5. [Current codebase starting point](#5-current-codebase-starting-point)
6. [Phase 1 — Solo teacher (ship first)](#6-phase-1--solo-teacher-ship-first)
7. [Phase 2 — Schools and org students](#7-phase-2--schools-and-org-students)
8. [Phase 3 — District hierarchy](#8-phase-3--district-hierarchy)
9. [File reference](#9-file-reference)
10. [Testing checklist](#10-testing-checklist)
11. [Common pitfalls](#11-common-pitfalls)
12. [Glossary](#12-glossary)

---

## 1. Mental model

ClassClarus has **two different kinds of "membership"**:

| Kind | Example | Stored in |
|------|---------|-----------|
| **Staff** (teachers, principals, team leaders) | Ms. Smith, the 5th-grade team leader | `convex-tenants` (org + team members) |
| **Class roster** (students, guardians, co-teachers) | Jamie (student), Jamie's mom (guardian) | `@djpanda/convex-authz` (scoped roles) + your tables |

**Why split them?** A student in Period 1 Math is not a "member of the school organization" in the same sense as a teacher. Students should not show up in the principal's staff directory. They need class-level permissions (submit work, view grades) that are unrelated to org admin APIs.

**Solo teachers** use only the class roster layer at first. No org, no team, no school record — just classes and authz roles.

```
Solo teacher today:
  User ──creates──► Class (classes.userId = owner)
                    └── join codes (unused so far)

Target architecture:
  Solo:
    User ──authz creator role──► Class (organizationId = null)

  In a school:
    Organization (district or school)
    ├── Org members (owner, principal, teachers)     ← tenants
    ├── Team "5th Grade Math" (team_leader, teachers) ← tenants, nested teams
    │   └── Class "Period 1" (classes.teamId)       ← your table
    │       ├── classEnrollments → orgStudents       ← your tables
    │       └── authz roles (student, guardian…)     ← authz
    └── orgStudents (stable roster across grades)    ← your table
```

---

## 2. Why these libraries

### `@djpanda/convex-authz`

**What it does:** Permission checks with scoped roles. "Can user X do action Y on resource Z?"

**Why you need it:**
- Five class roles with inheritance (creator > teacher > assistantTeacher > student)
- Guardians need **per-student** grade access (relationship-based / ReBAC), not just class-wide read
- Permissions must be checked on every mutation server-side — never trust the client
- O(1) permission lookups via pre-computed indexes (scales as rosters grow)

**Why not a `classMembers` table alone?** A plain table works for simple role checks, but guardian→student links, org-scoped student permissions, and future district inheritance get messy fast. Authz gives you a consistent pattern.

**Tradeoff:** Newer library (~2026), requires a Convex **component** (`convex.config.ts`). Pin the version in `package.json`.

### `@djpanda/convex-tenants`

**What it does:** Organizations, teams, org members, invitations, team members.

**Why you need it:**
- School/district staff management (invite principal, list members, suspend)
- Grade/subject **teams** with **team_leader** role
- Nested teams (`parentTeamId`) for district → school → grade group
- Pairs with authz for org-level permissions (`members:add`, `teams:create`, etc.)

**What it does NOT do:**
- Classes (you keep `classes` table)
- Join-by-code flows (you build `redeemJoinCode`)
- Org student roster (you build `orgStudents` + `classEnrollments`)

**Why install in Phase 1 even if solo teachers don't use orgs yet?** So you don't rewrite auth when schools ship. Phase 1 only *wires* tenants; solo teachers never see org UI.

### What stays in your app

| Feature | Owner |
|---------|-------|
| Class CRUD, join codes, archive | `convex/classes.ts` |
| Join code redemption | `convex/memberships.ts` |
| Org student roster + transfers | `convex/students.ts` |
| Guardian linking | `convex/memberships.ts` + authz ReBAC |
| Permission definitions | `convex/authz.ts` |

---

## 3. Domain mapping

### Organizations vs teams (critical distinction)

**Teams always live inside an org.** `createTeam` requires `organizationId`.

**Orgs do not nest inside orgs.** There is no `parentOrganizationId`. You cannot model:

```
District (org)
  └── Lincoln Elementary (org)   ← NOT supported
```

Instead, model district → school as **org → nested teams**:

```
Springfield District (organization)
├── Org members: district admin, principals
├── Team: "Lincoln Elementary"          metadata.type = "school"
│   ├── Team: "5th Grade Math"          parentTeamId → Lincoln
│   │   └── classes rows (teamId set)
│   └── Team: "3rd Grade ELA"
└── Team: "Washington Middle School"
```

### ClassClarus concept → data model

| Real world | Implementation |
|------------|----------------|
| School or district | `organization` (tenants) |
| Grade/subject teacher group | `team` with optional `parentTeamId` |
| Team leader | Team member `role: "team_leader"` (custom string) |
| Class (Period 1, etc.) | `classes` table with optional `teamId`, `organizationId` |
| Student (in a school) | `orgStudents` row + `classEnrollments` |
| Student (solo class) | authz `student` role only — no `orgStudents` |
| Guardian | authz `guardian` role + ReBAC `guardian_of` → `orgStudent` |

### Join codes (current schema)

Your classes already have:

- `studentCode`
- `teacherCode`
- `assistantTeacherCode`

There is **no guardian code**. Guardians are added by teachers only.

| Code | Role assigned |
|------|---------------|
| `studentCode` | `student` (solo) or links account to `orgStudent` (org class) |
| `teacherCode` | `teacher` |
| `assistantTeacherCode` | `assistantTeacher` |

---

## 4. Three layers of roles (do not mix them)

Mixing these up is the most common source of bugs. Each layer answers a different question.

### Layer 1 — Org roles (school/district staff)

**Question:** "Can this user invite a principal? Create a team? Manage org settings?"

**Stored in:** tenants org membership + authz org-scoped permissions

**Default tenants roles:** `owner`, `admin`, `member` — extend with education roles:

```typescript
// convex/authz.ts — extend TENANTS_ROLES
principal: {
  organizations: ["read", "update"],
  members: ["add", "remove", "updateRole", "list"],
  teams: ["create", "update", "delete", "addMember", "removeMember", "list"],
  students: ["create", "list", "enroll", "unenroll", "transfer", "update"],
},
teacher: {
  organizations: ["read"],
  students: ["create", "list", "enroll", "unenroll", "transfer", "update"],
},
```

**Structural owner:** Every org has an `ownerId` (who created it). This is a data integrity constraint in tenants — the owner cannot be removed without transferring ownership. This is separate from the `owner` *role* in authz.

### Layer 2 — Team roles (grade/subject groups)

**Question:** "Can this user manage the 5th Grade Math team? See classes under this team?"

**Stored in:** tenants team membership (`addTeamMember` with a role string)

```typescript
// Team member role strings (your choice, not an enum in tenants)
"team_leader"  // manages team membership, sees team classes
"teacher"      // collaborator on shared planning
```

**Team leader is NOT a built-in field.** You assign `role: "team_leader"` via `updateTeamMemberRole`. Enforce "one leader per team" yourself in an `onBeforeAddTeamMember` hook if you want that rule.

**Important:** Team leaders must also be **org members** (typically org role `teacher`) to pass authz checks for `students:create`. Team membership alone does not grant org-scoped permissions unless you add custom logic.

### Layer 3 — Class roles (roster)

**Question:** "Can this user grade assignments in Period 1? Submit work as a student?"

**Stored in:** authz scoped to `{ type: "class", id: classId }`

```typescript
const classPermissions = definePermissions({
  class: {
    read: true,
    manage: true,         // edit class settings, archive, delete
    manageMembers: true,  // add/remove roster, link guardians
    grade: true,
    submit: true,
    viewOwnGrades: true,
    viewChildGrades: true, // guardians, via ReBAC to specific student
  },
});

const classRoles = defineRoles(classPermissions, {
  student: { class: ["read", "submit", "viewOwnGrades"] },
  guardian: { class: ["read"] },
  assistantTeacher: { inherits: "student", class: ["read", "grade"] },
  teacher: { inherits: "assistantTeacher", class: ["manageMembers"] },
  creator: { inherits: "teacher", class: ["manage"] },
});
```

**Role inheritance:** `creator` automatically gets everything `teacher` has, plus `manage`. You do not duplicate permission lists.

| Role | How they join |
|------|---------------|
| creator | Assigned in `createClass` mutation |
| teacher | `redeemJoinCode` with `teacherCode` |
| assistantTeacher | `redeemJoinCode` with `assistantTeacherCode` |
| student (solo) | `redeemJoinCode` with `studentCode` |
| student (org) | `enrollStudent` from roster; code optionally links login account |
| guardian | Teacher calls `linkGuardianToStudent` — no code |

---

## 5. Current codebase starting point

Before you start, know what already exists:

| File | Current behavior |
|------|------------------|
| `convex/schema.ts` | `classes` table with `userId` owner, three join codes |
| `convex/classes.ts` | `getOwnedClass` checks `classes.userId === currentUser` |
| `src/lib/auth.ts` | `requireUser()` via `@convex-dev/auth` + Google |
| `convex/auth.ts` | Google OAuth only |

**What does not exist yet:**
- `convex.config.ts` (no components)
- authz / tenants packages
- Join code redemption
- Any membership or student tables
- Permission checks beyond single-owner

**Design decision:** Keep `classes.userId` as a denormalized creator reference for now, but move **authorization** to authz. Eventually `listClasses` should use authz roles, not `by_user` index alone.

---

## 6. Phase 1 — Solo teacher (ship first)

**Goal:** A teacher signs up, creates classes, shares join codes, and manages their class — with zero org/team setup.

### Step 1.1 — Install packages

```bash
npm install @djpanda/convex-authz @djpanda/convex-tenants
```

**Why both now?** Tenants is not used in Phase 1 UI, but registering the component early avoids a painful migration later.

### Step 1.2 — Create `convex/convex.config.ts`

```typescript
import { defineApp } from "convex/server";
import authz from "@djpanda/convex-authz/convex.config";
import tenants from "@djpanda/convex-tenants/convex.config";

const app = defineApp();
app.use(authz);
app.use(tenants);

export default app;
```

**Why a config file?** Convex components are isolated mini-backends with their own tables. Authz stores role assignments and permission caches in component tables, separate from your `classes` table.

Run `npx convex dev` after this. Convex regenerates `_generated/` with `components.authz` and `components.tenants`.

### Step 1.3 — Create `convex/authz.ts`

This is the single source of truth for permissions and roles.

```typescript
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";

// 1. Extend tenants permissions with class + student actions
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  class: {
    read: true,
    manage: true,
    manageMembers: true,
    grade: true,
    submit: true,
    viewOwnGrades: true,
    viewChildGrades: true,
  },
  students: {
    create: true,
    list: true,
    enroll: true,
    unenroll: true,
    transfer: true,
    update: true,
  },
});

// 2. Org/team roles (tenants) + class roles + student grants
const roles = defineRoles(permissions, TENANTS_ROLES, {
  teacher: {
    organizations: ["read"],
    students: ["create", "list", "enroll", "unenroll", "transfer", "update"],
  },
  student: { class: ["read", "submit", "viewOwnGrades"] },
  guardian: { class: ["read"] },
  assistantTeacher: { inherits: "student", class: ["read", "grade"] },
  classTeacher: { inherits: "assistantTeacher", class: ["manageMembers"] },
  creator: { inherits: "classTeacher", class: ["manage"] },
});

// 3. Client — tenantId is your app namespace until you use per-org tenants
export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: "classclarus",
});
```

**Why `tenantId: "classclarus"`?** Authz namespaces all assignments. You can later use `authz.withTenant(orgId)` for per-org isolation. One global namespace is fine for Phase 1.

**Why `creator` not `owner` for classes?** `owner` is overloaded by tenants for org structural ownership. Use `creator` for class scope to avoid confusion.

### Step 1.4 — Create `convex/lib/classAuth.ts` (helper)

Wrap authz checks so you can change implementation later:

```typescript
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authz } from "../authz";

export async function requireClassPermission(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  classId: Id<"classes">,
  permission: string,
) {
  await authz.require(ctx, userId, permission, {
    type: "class",
    id: classId,
  });
}

export async function assignClassCreator(
  ctx: MutationCtx,
  userId: string,
  classId: Id<"classes">,
) {
  await authz.assignRole(ctx, userId, "creator", {
    type: "class",
    id: classId,
  });
}
```

**Why a helper file?** Every mutation would otherwise repeat scope objects and string permission names. One place to update if you rename permissions.

### Step 1.5 — Update `convex/schema.ts`

Add optional org fields (null for solo) and code lookup indexes:

```typescript
classes: defineTable({
  userId: v.id("users"),
  name: v.string(),
  // ... existing optional fields ...
  studentCode: v.string(),
  teacherCode: v.string(),
  assistantTeacherCode: v.string(),
  organizationId: v.optional(v.string()), // tenants org ID; null = solo
  teamId: v.optional(v.string()),           // tenants team ID; null = solo
})
  .index("by_user", ["userId"])
  .index("by_studentCode", ["studentCode"])
  .index("by_teacherCode", ["teacherCode"])
  .index("by_assistantTeacherCode", ["assistantTeacherCode"]),
```

**Why indexes on codes?** Without them, `redeemJoinCode` scans the whole `classes` table. Fine for dev; unacceptable at scale.

**Why optional org fields?** Solo classes explicitly have `undefined` — not a sentinel string. Queries can filter `organizationId === undefined` for "my solo classes."

### Step 1.6 — Update `convex/classes.ts`

**`createClass`** — after insert, assign creator role:

```typescript
const classId = await ctx.db.insert("classes", { /* ... */, organizationId: undefined, teamId: undefined });
await assignClassCreator(ctx, user._id, classId);
return classId;
```

**Why assign role on create?** `classes.userId` alone is not enough once co-teachers exist. Authz is the authority for "who can edit this class."

**`getClass` / `updateClass` / `removeClass`** — replace `getOwnedClass` with:

```typescript
await requireClassPermission(ctx, user._id, args.classId, "class:read");   // get
await requireClassPermission(ctx, user._id, args.classId, "class:manage"); // update/delete
```

**`listClasses`** — Phase 1 shortcut: keep `by_user` for creators AND add authz query later. Full solution:

```typescript
// Use authz.getUserRoles(ctx, userId) and filter scopes where type === "class"
// Then batch ctx.db.get for each classId
```

**Why not only `by_user`?** After join codes work, a co-teacher has access but a different `userId`. Listing must use authz roles.

### Step 1.7 — Create `convex/memberships.ts`

#### `redeemJoinCode`

```typescript
export const redeemJoinCode = mutation({
  args: { code: v.string() },
  returns: v.object({ classId: v.id("classes"), role: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const code = args.code.trim().toUpperCase();

    // Try each index (order matters if codes could collide — they shouldn't)
    const match =
      (await ctx.db.query("classes").withIndex("by_studentCode", q => q.eq("studentCode", code)).unique()) ??
      (await ctx.db.query("classes").withIndex("by_teacherCode", q => q.eq("teacherCode", code)).unique()) ??
      (await ctx.db.query("classes").withIndex("by_assistantTeacherCode", q => q.eq("assistantTeacherCode", code)).unique());

    if (!match) throw new Error("Invalid join code");

    const role =
      match.studentCode === code ? "student" :
      match.teacherCode === code ? "classTeacher" :
      "assistantTeacher";

    await authz.assignRole(ctx, user._id, role, { type: "class", id: match._id });
    return { classId: match._id, role };
  },
});
```

**Why uppercase trim?** User-friendly; codes are generated uppercase in `generateJoinCode`.

**Why `classTeacher` not `teacher`?** Avoids collision with org role name `teacher` in authz role definitions.

#### `listMyClasses`

Query all class-scoped roles for the user, return class docs. This is how co-teachers and students see their classes too.

### Step 1.8 — Create `convex/permissions.ts` (for React)

Authz React hooks need Convex queries to call:

```typescript
export const checkClassPermission = query({
  args: {
    classId: v.id("classes"),
    permission: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    return authz.can(ctx, user._id, args.permission, {
      type: "class",
      id: args.classId,
    });
  },
});
```

**Why expose this?** `@djpanda/convex-authz/react` `PermissionGate` and `useCanUser` call your queries reactively. Permission changes update UI automatically.

### Step 1.9 — Frontend (minimal)

1. **Join code page** — input + `redeemJoinCode` mutation
2. **Hide edit/delete** unless `checkClassPermission("class:manage")` returns true
3. **Do not add org UI** — solo teachers never see TenantsProvider yet

**Why PermissionGate?** Prevents showing buttons that will throw on click. Better UX than error toasts.

### Phase 1 done when

- [ ] Teacher signs up, creates class, no org created
- [ ] Creator can edit/archive; non-member cannot
- [ ] Another user redeems `teacherCode`, gains edit access
- [ ] Student redeems `studentCode`, sees class but cannot edit
- [ ] `npx convex dev` runs without component errors

---

## 7. Phase 2 — Schools and org students

**Goal:** Teachers can join a school, bring solo classes, and schools manage a student roster across classes/grades.

### Step 2.1 — Create `convex/tenants.ts`

```typescript
import { makeTenantsAPI, TENANTS_PERMISSIONS } from "@djpanda/convex-tenants";
import { getAuthUserId } from "@convex-dev/auth/server";
import { components } from "./_generated/api";
import { authz } from "./authz";

export const {
  listOrganizations,
  getOrganization,
  createOrganization,
  inviteMember,
  acceptInvitation,
  listTeams,
  listTeamsAsTree,
  createTeam,
  addTeamMember,
  updateTeamMemberRole,
  listTeamMembers,
  // ... export everything you need
} = makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: "owner",
  auth: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ?? null;
  },
  getUser: async (ctx, userId) => {
    const user = await ctx.db.get(userId);
    return user ? { name: user.name, email: user.email } : null;
  },
  roleHierarchy: {
    owner: 5,
    admin: 3,
    principal: 3,
    teacher: 1,
    member: 0,
  },
});
```

**Why `getUser`?** Tenants enriches member lists with names/emails for UI.

**Why `roleHierarchy`?** Only needed if you use `checkMemberPermission({ minRole: "admin" })`. Prefer `checkPermission` (authz-based) for custom roles.

### Step 2.2 — Add student tables to schema

```typescript
orgStudents: defineTable({
  organizationId: v.string(),
  displayName: v.string(),
  userId: v.optional(v.id("users")),
  externalId: v.optional(v.string()),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"]),

classEnrollments: defineTable({
  organizationId: v.string(),
  classId: v.id("classes"),
  orgStudentId: v.id("orgStudents"),
  status: v.union(v.literal("active"), v.literal("withdrawn")),
})
  .index("by_class", ["classId"])
  .index("by_orgStudent", ["orgStudentId"])
  .index("by_class_and_student", ["classId", "orgStudentId"]),
```

**Why `orgStudents` separate from `classEnrollments`?**

Jamie is one person across 4th and 5th grade. If you create a new student row per class, transfers lose history and guardian links break. One `orgStudentId` + many enrollments mirrors how SIS systems work.

**Why denormalize `organizationId` on enrollments?** Fast validation in `transferStudent` — both classes must share the same org without extra joins.

### Step 2.3 — Create `convex/students.ts`

#### `createOrgStudent`

```typescript
// Preconditions:
//   authz.require(ctx, userId, "students:create", { type: "organization", id: organizationId })
// Also verify caller is org member (tenants getCurrentMember)
```

**Who can call this?** Org owner, org role `teacher`, and team_leader (if also org member as `teacher`).

#### `enrollStudent`

1. Verify `orgStudent` belongs to same org as class (`class.organizationId`)
2. Insert `classEnrollments` with `status: "active"`
3. If `orgStudent.userId` exists, `authz.assignRole(..., "student", { type: "class", id })`

**Why assign authz only when `userId` linked?** Young students may not have accounts. Roster exists; login comes later via join code.

#### `transferStudent`

```
Args: { orgStudentId, fromClassId, toClassId }

1. Verify both classes have same organizationId
2. authz.require(..., "students:transfer", { type: "organization", id })
3. Patch old enrollment → status: "withdrawn"
4. Insert new enrollment → status: "active"
5. Do NOT touch orgStudent row or guardian relations
```

**Why withdraw instead of delete?** Audit trail — "Jamie was in 4A Q1, moved to 5B Q2."

#### `linkStudentUser`

When a student redeems `studentCode` on an org class:

1. Find or create `orgStudent` for that org
2. Set `orgStudent.userId = currentUser._id`
3. Ensure active `classEnrollments` exists
4. Assign authz `student` role

### Step 2.4 — `assignClassesToTeam` (bring solo classes to school)

```typescript
export const assignClassesToTeam = mutation({
  args: {
    classIds: v.array(v.id("classes")),
    organizationId: v.string(),
    teamId: v.string(),
  },
  returns: v.object({ updated: v.array(v.id("classes")) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // 1. Caller is org member
    // 2. Each class: caller has creator role via authz
    // 3. teamId belongs to organizationId (getTeam)
    // 4. Patch { organizationId, teamId } on each class
    // Optional: prompt to import solo students into orgStudents
  },
});
```

**Why explicit migration?** Solo classes are invisible to org admins by design. Teacher chooses which classes to attach — side projects stay private.

**What stays the same after migration:** Class `_id`, join codes, authz roster roles. Students do not need to re-join.

### Step 2.5 — Guardian linking (ReBAC)

```typescript
// convex/memberships.ts — linkGuardianToStudent
await authz.assignRole(ctx, guardianUserId, "guardian", { type: "class", id: classId });
await authz.addRelation(ctx,
  { type: "user", id: guardianUserId },
  "guardian_of",
  { type: "orgStudent", id: orgStudentId },
);
```

Configure in `authz.ts`:

```typescript
relationPermissions: defineRelationPermissions({
  "orgStudent:guardian_of": ["class:viewChildGrades"],
}),
```

**Why link to `orgStudent` not `user`?** Student may not have a login yet. Guardian access follows the roster record through class transfers.

**Guardian class-wide read** comes from the `guardian` class role. **Per-student grades** come from the ReBAC relation.

### Step 2.6 — Frontend (Phase 2)

1. `TenantsProvider` + `OrganizationSwitcher`
2. Accept invitation flow
3. "Bring your classes" UI → `assignClassesToTeam`
4. Org student roster CRUD + transfer between classes
5. Team management (create grade/subject team, assign team_leader)

### Phase 2 done when

- [ ] Principal creates org, invites teacher
- [ ] Teacher accepts, migrates solo classes to a team
- [ ] Owner/team_leader/teacher can create org student
- [ ] Student enrolled in Class A, transferred to Class B, history preserved
- [ ] Guardian linked to orgStudent sees grades in both classes
- [ ] Solo teacher path still works unchanged

---

## 8. Phase 3 — District hierarchy

**Goal:** District admin sees all schools; nested teams reflect district → school → grade.

### Recommended structure

```
Organization: "Springfield District"
├── Team: "Lincoln Elementary"     (metadata: { type: "school" })
│   └── Team: "5th Grade Math"
│       └── classes…
└── Team: "Washington Middle"
```

### Steps

1. Create district org with `metadata.type = "district"`
2. Schools are root-level teams with `metadata.type = "school"`
3. Grade/subject teams use `parentTeamId: schoolTeamId`
4. Grant `district_admin` org role broader read permissions
5. Use `listTeamsAsTree` for admin navigation

**Why not separate org per school?** Cross-school district reporting requires custom linking. Single org + nested teams is simpler for district-wide student transfers.

---

## 9. File reference

| File | Responsibility |
|------|----------------|
| `convex/convex.config.ts` | Register authz + tenants components |
| `convex/authz.ts` | Permission definitions, role definitions, `authz` client export |
| `convex/tenants.ts` | `makeTenantsAPI` — org/team/member/invitation functions |
| `convex/schema.ts` | `classes`, `orgStudents`, `classEnrollments` |
| `convex/classes.ts` | Class CRUD; calls authz for access |
| `convex/memberships.ts` | `redeemJoinCode`, `listMyClasses`, `assignClassesToTeam`, guardian linking |
| `convex/students.ts` | Org roster: create, enroll, transfer, unenroll |
| `convex/permissions.ts` | Queries for React authz hooks |
| `convex/lib/classAuth.ts` | `requireClassPermission`, `assignClassCreator` helpers |
| `src/lib/auth.ts` | `requireUser` (unchanged) |

---

## 10. Testing checklist

### Authorization

- [ ] Unauthenticated user cannot call mutations
- [ ] User without role cannot read class they do not belong to
- [ ] Student cannot `class:manage`
- [ ] Assistant teacher can `class:grade` but not `class:manageMembers`
- [ ] Creator can delete class

### Join codes

- [ ] Invalid code throws clear error
- [ ] Same code works for multiple users (many students)
- [ ] Redeeming teacher code does not remove creator

### Solo vs org

- [ ] `createClass` with no org leaves `organizationId` undefined
- [ ] Org class requires `organizationId` set (after migration or direct create)
- [ ] Solo class invisible in `listOrgClasses` for principal

### Org students

- [ ] `transferStudent` rejects cross-org transfer
- [ ] Withdrawn enrollment not shown in active roster
- [ ] Guardian relation survives transfer

### Edge cases

- [ ] Teacher leaves org — classes retain orgId unless migrated back
- [ ] Duplicate enrollment same student+class rejected
- [ ] Suspended org member cannot mutate (tenants enforces)

---

## 11. Common pitfalls

### Pitfall: Using `classes.userId` as sole authorization

**Symptom:** Co-teacher redeems code but `getOwnedClass` throws.

**Fix:** All access checks go through authz. `userId` is metadata only.

### Pitfall: Putting students in tenants org membership

**Symptom:** Students appear in staff directory; invitation emails sent to 9-year-olds.

**Fix:** Students live in `orgStudents` + authz class roles only.

### Pitfall: Team leader without org membership

**Symptom:** Team leader cannot `createOrgStudent`.

**Fix:** When assigning `team_leader`, ensure user is org member with role `teacher`.

### Pitfall: Deleting enrollments on transfer

**Symptom:** Lost audit trail; guardian links break.

**Fix:** Mark `withdrawn`, insert new active enrollment.

### Pitfall: Guardian linked to class enrollment

**Symptom:** Guardian loses access when student changes class.

**Fix:** Link `guardian_of` → `orgStudent`, not class.

### Pitfall: Auto-creating org on signup

**Symptom:** Every solo teacher has a hidden "My School" org.

**Fix:** Orgs only created when user explicitly joins or creates a school.

### Pitfall: Forgetting `returns` validators

**Symptom:** ESLint / Convex best-practice warnings; weaker type safety.

**Fix:** Add `args` and `returns` to every public function (your workspace rules require this).

### Pitfall: Using `Date.now()` in queries

**Symptom:** Broken reactivity, cache misses.

**Fix:** Pass time as argument from client, or use status fields updated by cron/mutation.

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **authz** | `@djpanda/convex-authz` — permission engine with scoped roles |
| **tenants** | `@djpanda/convex-tenants` — org/team/member management |
| **Component** | Isolated Convex sub-backend with own tables (`convex.config.ts`) |
| **Scope** | Resource context for a permission, e.g. `{ type: "class", id: "..." }` |
| **RBAC** | Role-Based Access Control — permissions via roles |
| **ReBAC** | Relationship-Based Access Control — permissions via relations (guardian_of) |
| **orgStudent** | Stable student record within an organization |
| **classEnrollment** | Links orgStudent to a specific class (active or withdrawn) |
| **Solo class** | `organizationId` is undefined — independent of any school |
| **team_leader** | Custom team member role string, not a built-in tenants field |
| **Structural owner** | tenants `ownerId` on org — cannot be removed without transfer |

---

## Suggested order of work (summary)

```
Phase 1 (solo teacher)
  1. Install packages + convex.config.ts
  2. convex/authz.ts + convex/lib/classAuth.ts
  3. Schema indexes + optional org fields
  4. Update classes.ts (creator role, authz checks)
  5. memberships.ts (redeemJoinCode, listMyClasses)
  6. permissions.ts + minimal frontend gates

Phase 2 (schools)
  7. convex/tenants.ts
  8. orgStudents + classEnrollments schema
  9. students.ts (create, enroll, transfer)
  10. assignClassesToTeam + guardian ReBAC
  11. Org UI (invitations, roster, migration)

Phase 3 (districts)
  12. Nested teams + district_admin role
```

Work through Phase 1 until it feels solid before starting Phase 2. The authz patterns you learn in Phase 1 (scoped roles, `require`, `assignRole`) are the foundation for everything else.

---

*Last updated: aligned with ClassClarus v4 v1 roles plan — creator, teacher, assistantTeacher, student, guardian; join codes: student, teacher, assistantTeacher; solo-teacher-first; org student roster with cross-grade transfer.*
