/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as authProviders from "../authProviders.js";
import type * as authz from "../authz.js";
import type * as authzOps from "../authzOps.js";
import type * as classes from "../classes.js";
import type * as groups from "../groups.js";
import type * as guardians from "../guardians.js";
import type * as http from "../http.js";
import type * as inviteCodes from "../inviteCodes.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_classAuth from "../lib/classAuth.js";
import type * as lib_classSort from "../lib/classSort.js";
import type * as lib_guardianAuth from "../lib/guardianAuth.js";
import type * as lib_guardianLinks from "../lib/guardianLinks.js";
import type * as lib_joinCodes from "../lib/joinCodes.js";
import type * as lib_languages from "../lib/languages.js";
import type * as lib_soloRoster from "../lib/soloRoster.js";
import type * as lib_studentContentAccess from "../lib/studentContentAccess.js";
import type * as lib_studentNames from "../lib/studentNames.js";
import type * as memberships from "../memberships.js";
import type * as permissions from "../permissions.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as schools from "../schools.js";
import type * as students from "../students.js";
import type * as tenants from "../tenants.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  app: typeof app;
  auth: typeof auth;
  authProviders: typeof authProviders;
  authz: typeof authz;
  authzOps: typeof authzOps;
  classes: typeof classes;
  groups: typeof groups;
  guardians: typeof guardians;
  http: typeof http;
  inviteCodes: typeof inviteCodes;
  "lib/auth": typeof lib_auth;
  "lib/classAuth": typeof lib_classAuth;
  "lib/classSort": typeof lib_classSort;
  "lib/guardianAuth": typeof lib_guardianAuth;
  "lib/guardianLinks": typeof lib_guardianLinks;
  "lib/joinCodes": typeof lib_joinCodes;
  "lib/languages": typeof lib_languages;
  "lib/soloRoster": typeof lib_soloRoster;
  "lib/studentContentAccess": typeof lib_studentContentAccess;
  "lib/studentNames": typeof lib_studentNames;
  memberships: typeof memberships;
  permissions: typeof permissions;
  rateLimiter: typeof rateLimiter;
  schools: typeof schools;
  students: typeof students;
  tenants: typeof tenants;
  userPreferences: typeof userPreferences;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  authz: import("@djpanda/convex-authz/_generated/component.js").ComponentApi<"authz">;
  tenants: import("@djpanda/convex-tenants/_generated/component.js").ComponentApi<"tenants">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
