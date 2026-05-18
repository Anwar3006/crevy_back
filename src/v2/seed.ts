
import { db } from "../config/db";
import { role, permission, rolePermission, currency, partner } from "./parent-model";
import { eq } from "drizzle-orm";

const PERMISSIONS = [
  // Projects
  { resource: "project", action: "view", description: "View project details" },
  { resource: "project", action: "create", description: "Create new projects" },
  { resource: "project", action: "edit", description: "Edit existing projects" },
  { resource: "project", action: "delete", description: "Delete projects" },
  { resource: "project", action: "approve", description: "Approve project registration" },
  // Project Owners (referred to as farmers in some contexts)
  { resource: "project_owner", action: "view", description: "View project owners" },
  { resource: "project_owner", action: "create", description: "Register new project owners" },
  { resource: "project_owner", action: "edit", description: "Edit project owner details" },
  { resource: "project_owner", action: "delete", description: "Delete project owners" },
  { resource: "project_owner", action: "approve", description: "Approve project owner (KYC verification)" },
  { resource: "project_owner", action: "manage", description: "Manage project owner assignments and plots" },
  // Credits
  { resource: "credit", action: "view", description: "View carbon credits" },
  { resource: "credit", action: "create", description: "Issue/Mint carbon credits (admin/MRV only)" },
  { resource: "credit", action: "purchase", description: "Purchase carbon credits" },
  { resource: "credit", action: "retire", description: "Retire carbon credits" },
  // MRV
  { resource: "mrv", action: "view", description: "View MRV data" },
  { resource: "mrv", action: "manage", description: "Manage MRV ingestions, webhooks, and verifications" },
  // Financials
  { resource: "financial", action: "view", description: "View financial records and payouts" },
  { resource: "financial", action: "manage", description: "Manage payout disbursement and contracts" },
  // Users
  { resource: "user", action: "view", description: "View system users" },
  { resource: "user", action: "edit", description: "Edit user details" },
  { resource: "user", action: "delete", description: "Delete users" },
  // Partners
  { resource: "partner", action: "view", description: "View partner details" },
  { resource: "partner", action: "manage", description: "Manage partner registrations" },
  // RBAC
  { resource: "rbac", action: "manage", description: "Assign roles and grant permissions" },
];

const ROLES = [
  { name: "super_admin", description: "Platform owner with unrestricted access" },
  { name: "financial_admin", description: "Admin responsible for financials, payouts, and contracts" },
  { name: "mrv_admin", description: "Admin responsible for MRV data and credit issuance" },
  { name: "project_manager", description: "Manager responsible for projects and project owners" },
  { name: "project_owner", description: "Owner of carbon projects and land assets" },
];

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "GHS", name: "Ghana Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "EUR", name: "Euro" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "ZAR", name: "South African Rand" },
];

async function seed() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Currencies
  console.log("Inserting currencies...");
  await db.insert(currency).values(CURRENCIES).onConflictDoNothing();

  // 2. Seed Permissions
  console.log("Inserting permissions...");
  await db.insert(permission).values(PERMISSIONS).onConflictDoNothing();

  // 3. Seed Roles
  console.log("Inserting roles...");
  await db.insert(role).values(ROLES).onConflictDoNothing();

  // Fetch all seeded permissions and roles to map IDs
  const allPermissions = await db.select().from(permission);
  const allRoles = await db.select().from(role);

  const permMap = new Map(allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]));
  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));

  // 4. Map Permissions to Roles
  const rolePermissionAssignments: { roleId: number; permissionId: number }[] = [];

  const getPermId = (resource: string, action: string) => {
    const id = permMap.get(`${resource}:${action}`);
    if (!id) throw new Error(`Permission not found: ${resource}:${action}`);
    return id;
  };

  // Super Admin: All permissions
  const superAdminId = roleMap.get("super_admin");
  if (superAdminId) {
    for (const p of allPermissions) {
      rolePermissionAssignments.push({ roleId: superAdminId, permissionId: p.id });
    }
  }

  // Financial Admin
  const financialAdminId = roleMap.get("financial_admin");
  if (financialAdminId) {
    [
      ["financial", "view"],
      ["financial", "manage"],
      ["project", "view"],
      ["credit", "view"],
    ].forEach(([res, act]) => {
      rolePermissionAssignments.push({ roleId: financialAdminId, permissionId: getPermId(res, act) });
    });
  }

  // MRV Admin
  const mrvAdminId = roleMap.get("mrv_admin");
  if (mrvAdminId) {
    [
      ["mrv", "view"],
      ["mrv", "manage"],
      ["project", "view"],
      ["credit", "view"],
      ["credit", "create"],
    ].forEach(([res, act]) => {
      rolePermissionAssignments.push({ roleId: mrvAdminId, permissionId: getPermId(res, act) });
    });
  }

  // Project Manager
  const projectManagerId = roleMap.get("project_manager");
  if (projectManagerId) {
    [
      ["project", "view"],
      ["project", "create"],
      ["project", "edit"],
      ["project", "approve"],
      ["project_owner", "view"],
      ["project_owner", "create"],
      ["project_owner", "edit"],
      ["project_owner", "approve"],
      ["project_owner", "manage"],
    ].forEach(([res, act]) => {
      rolePermissionAssignments.push({ roleId: projectManagerId, permissionId: getPermId(res, act) });
    });
  }

  console.log("Assigning permissions to roles...");
  if (rolePermissionAssignments.length > 0) {
    await db.insert(rolePermission).values(rolePermissionAssignments).onConflictDoNothing();
  }

  // 5. Seed CraftedClimate as the first partner
  console.log("Inserting CraftedClimate as first partner...");
  const [usdCurrency] = await db.select().from(currency).where(eq(currency.code, "USD")).limit(1);
  if (usdCurrency) {
    await db.insert(partner).values({
      name: "CraftedClimate",
      partnerType: "dMRV_provider",
      contactPerson: "Admin",
      contactEmail: "admin@craftedclimate.com",
      status: "approved",
      defaultCurrencyId: usdCurrency.id,
      hasDataSharingAgreement: true,
    }).onConflictDoNothing();
  }

  console.log("✅ Seeding completed successfully.");
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
