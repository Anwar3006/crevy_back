import { db } from "@/config/db"
import AppError from "@/shared/errors/AppError"
import { permission, role, rolePermission } from "../models/rbac.model"
import { and, eq } from "drizzle-orm"
import { user } from "@/v2/parent-model"
// import { user } from "@/v1/schema"

type TRBACService_CreateRole_Input = {
    name: string,
    description: string
}
type TRBACService_CreateRole_Output = {
    id: number,
    name: string,
    description: string | null,
    createdAt: Date,
}

type TRBACService_CreatePermission_Input = {
    resource: string,
    action: string,
    description: string | null
}

type TRBACService_CreatePermission_Output = {
    id: number,
    resource: string,
    action: string,
    description: string | null,
    createdAt: Date,
}

type TRBACService_AssignPermissionToRole_Input = {
    roleId: number,
    permissionId: number,
    grantedBy: string
}

type TRBACService_AssignPermissionToRole_Output = {
    roleId: number,
    permissionId: number,
    grantedBy: string | null,
    grantedAt: Date,
}

type TRBACService = {
    createRole: (payload: TRBACService_CreateRole_Input) => Promise<TRBACService_CreateRole_Output>,
    getRoles: () => Promise<Array<TRBACService_CreateRole_Output>>,
    createPermission: (payload: TRBACService_CreatePermission_Input) => Promise<TRBACService_CreatePermission_Output>,
    getPermissions: () => Promise<Array<TRBACService_CreatePermission_Output>>,

    assignPermissionToRole: (payload: TRBACService_AssignPermissionToRole_Input) => Promise<TRBACService_AssignPermissionToRole_Output>,
    getPermissionsAssignedToRole: (payload: {roleId: number}) => Promise<Array<TRBACService_CreatePermission_Output>>,
    assignRoleToUser: (payload: {roleId: number, userId: string, assignedBy: string}) => Promise<typeof user.$inferSelect>,
    unassignPermissionFromRole: (roleId: number, permissionId: number) => Promise<void>,
    removeRoleFromUser: (userId: string) => Promise<typeof user.$inferSelect>,

    // helpers
    hasPermission: (userId: string, resource: string, action: string) => Promise<boolean>,
    getUserRole: (userId: string) => Promise<string | null>,
    checkDuplicateRole: (name: string) => Promise<boolean>;
    checkDuplicatePermission: (resource: string, action: string) => Promise<boolean>;
        
}

const RBACService: TRBACService = {

    createRole: async (payload: TRBACService_CreateRole_Input): Promise<TRBACService_CreateRole_Output> => {
        // check duplicate role
        const duplicateRole = await RBACService.checkDuplicateRole(payload.name);
        if(duplicateRole){
            throw new AppError('Role with this name already exists', 409);
        }

        // create role
        const [newRole] = await db.insert(role).values(payload).returning()
        return newRole;
    },

    getRoles: async () => {
        const allRoles = await db.select().from(role);
        return allRoles;
    },

    createPermission: async (payload: TRBACService_CreatePermission_Input): Promise<TRBACService_CreatePermission_Output> => {
        // check duplicate permission
        const duplicatePermission = await RBACService.checkDuplicatePermission(payload.resource, payload.action);
        if(duplicatePermission){
            throw new AppError('Permission with this resource and action already exists', 409);
        }

        // create permission
        const [newPermission] = await db.insert(permission).values(payload).returning()
        return newPermission;
    },

    getPermissions: async () => {
        const allPermissions = await db.select().from(permission);
        return allPermissions;
    },

    assignPermissionToRole: async (payload: TRBACService_AssignPermissionToRole_Input): Promise<TRBACService_AssignPermissionToRole_Output> => {
        const [existing] = await db.select().from(rolePermission).where(and(eq(rolePermission.roleId, payload.roleId), eq(rolePermission.permissionId, payload.permissionId)))
        
        if(existing){
            throw new AppError('Permission already assigned to this role', 409);
        }

        const [assignedPermission] = await db.insert(rolePermission).values(payload).returning();
        return assignedPermission;
    },

    getPermissionsAssignedToRole: async (payload: {roleId: number}): Promise<Array<TRBACService_CreatePermission_Output>> => {
        const results = await db.select({
            id: permission.id,
            resource: permission.resource,
            action: permission.action,
            description: permission.description,
            createdAt: permission.createdAt
        }).from(rolePermission).innerJoin(permission, eq(rolePermission.permissionId, permission.id)).where(eq(rolePermission.roleId, payload.roleId));
        return results;
    },

    assignRoleToUser: async (payload: {roleId: number, userId: string, assignedBy: string}) => {
        const {roleId, userId, assignedBy} = payload;
        const [result] = await db.update(user).set({ roleId, assignedBy: assignedBy, updatedAt: new Date() }).where(eq(user.id, userId)).returning()
        return result
    },

    unassignPermissionFromRole: async (roleId: number, permissionId: number) => {
        await db.delete(rolePermission).where(and(eq(rolePermission.roleId, roleId), eq(rolePermission.permissionId, permissionId)));
    },

    removeRoleFromUser: async (userId: string) => {
        const [result] = await db.update(user).set({ roleId: null, updatedAt: new Date() }).where(eq(user.id, userId)).returning()
        return result
    },


    /**
   * Permission check: does this user have permission to perform `action` on `resource`?
   * Called by the requirePermission middleware.
   */
   hasPermission: async (userId: string, resource: string, action: string): Promise<boolean> => {
    const [result] = await db
      .select({ id: permission.id })
      .from(user)
      .innerJoin(role, eq(role.id, user.roleId))
      .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
      .innerJoin(permission, eq(permission.id, rolePermission.permissionId))
      .where(
        and(
          eq(user.id, userId), 
          eq(permission.resource, resource), 
          eq(permission.action, action)
        )
      );
    
    return !!result;
   },

   getUserRole: async (userId: string): Promise<string | null> => {
    const [result] = await db
      .select({ roleName: role.name })
      .from(user)
      .innerJoin(role, eq(role.id, user.roleId))
      .where(eq(user.id, userId));
    
    return result?.roleName || null;
   },

    checkDuplicateRole: async (name: string): Promise<boolean> => {
        const [id] = await db.select({id: role.id}).from(role).where(eq(role.name, name));
        return id != null ;
    },

    checkDuplicatePermission: async (resource: string, action: string): Promise<boolean> => {
        const [id] = await db.select({id: permission.id}).from(permission).where(and(eq(permission.resource, resource), eq(permission.action, action)));
        return id != null ;
    }
};

export default RBACService;