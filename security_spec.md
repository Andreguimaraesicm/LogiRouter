# Security Specification - Multi-Tenant Route Optimization

## Data Invariants
1. A **User** must belong to exactly one `Company`.
2. **Vehicles** and **Routes** must always have a `companyId` that matches the creator's `companyId`.
3. A **Driver** can only see routes where `driverId == request.auth.uid`.
4. A **Company Admin** can only manage users, vehicles, and routes within their own company (`companyId` match).
5. **Route Events** can only be created if the route exists and is in a tracking-ready state (`dispatching` or `in_transit`).
6. A **Collaborator** has permissions defined in their `permissions` array (e.g., `manage_vehicles`, `manage_routes`).

## The Dirty Dozen Payloads (Attack Vectors)
1. **Identity Spoofing**: Admin of Company A tries to create a vehicle for Company B.
2. **Privilege Escalation**: Collaborator tries to update their own `role` to `admin`.
3. **Cross-Tenant Read**: Driver of Company A tries to list routes from Company B.
4. **ID Poisoning**: Injecting 2MB string as `companyId`.
5. **Ghost Field Update**: Updating a route with `isApproved: true` when no such field exists in schema.
6. **Timeline Forgery**: Driver tries to log a `departure` event before an `arrival` event (logical flow, though Firestore rules might only check types, we enforce `request.time`).
7. **Orphaned Route**: Creating a route with a `vehicleId` that doesn't exist or belongs to another company.
8. **PII Leak**: Non-admin trying to read the full user registry.
9. **Status Shortcutting**: Attempting to move a route from `planned` directly to `completed` without `in_transit`.
10. **Resource Exhaustion**: Sending 1000 items in the `permissions` array.
11. **Email Spoofing**: Registering with someone else's email but `email_verified` is false (if enabled).
12. **Self-Termination**: A user disabling their own status to bypass accountability (or an admin disabling themselves if they are the only admin).

## Security Rules Implementation Strategy
- **Master Gate**: Access to all sub-resources (Routes, Events, Vehicles) is gated by verifying the user's `companyId`.
- **Validation Helpers**: `isValidCompany`, `isValidUser`, `isValidVehicle`, `isValidRoute`, `isValidEvent`.
- **Relational Sync**: Events must match the parent Route's `companyId`.
