---
name: djpanda-convex-tenants
description: A multi-tenant organization and team management component for Convex with built-in authorization via @djpanda/convex-authz Use this skill whenever working with convex-tenants or related Convex component functionality.
version: 0.5.0
---

> Agents: read this skill fully before writing code that uses convex-tenants. Follow the installation and configuration steps exactly.

# convex-tenants

## Instructions

A multi-tenant component that adds organization, team, and member management to Convex applications with built-in authorization via @djpanda/convex-authz. Provides complete CRUD operations for organizations with unique slugs and status management, role-based member management, team creation and membership, and a flexible invitation system. Includes React hooks, UI components, and an organization store for client-side state management.

### Installation

```bash
npm install @djpanda/convex-tenants
```

Current npm version: `@djpanda/convex-tenants@0.5.0`

## Use cases

- **Building SaaS applications** where users need to create and manage organizations with different permission levels for team members
- **Enterprise applications** requiring team-based access control with custom roles and hierarchical permissions within organizations
- **Collaborative platforms** where users can be members of multiple organizations and switch between different organizational contexts
- **B2B applications** needing invitation workflows to onboard new team members with specific roles and team assignments
- **Multi-tenant apps** requiring organization suspension and archival capabilities for administrative control

## How it works

The component integrates with your Convex app by registering `tenants` and `authz` in `convex.config.ts`, then defining permissions and roles in `authz.ts` using the provided `TENANTS_PERMISSIONS` and `TENANTS_ROLES` constants. You create a `convex/tenants.ts` file that calls `makeTenantsAPI()` with your auth configuration, which generates a complete set of queries and mutations for organization, member, team, and invitation management.

Authorization is handled through `@djpanda/convex-authz` with a customizable permission map that defines which permissions are required for each operation. Organizations can have statuses (active, suspended, archived) that automatically block mutations when not active. The invitation system supports flexible identifiers beyond email, with customizable validation callbacks.

On the client side, React applications can use the `TenantsProvider` and included hooks like `useQuery(api.tenants.listOrganizations)` to interact with the backend. The component provides pre-built UI components including an organization switcher and management dialogs, plus an organization store that maintains active organization state with configurable storage keys.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by convex-tenants is not needed

## Resources

- [npm package](https://www.npmjs.com/package/%40djpanda%2Fconvex-tenants)
- [GitHub repository](https://github.com/dbjpanda/convex-tenants)
- [Live demo](https://github.com/dbjpanda/convex-tenants/tree/main/example)
- [Convex Components Directory](https://www.convex.dev/components/djpanda/convex-tenants)
- [Convex documentation](https://docs.convex.dev)
