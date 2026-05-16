

import { z } from 'zod'

/*
 * Zod schema for creating a role
 * Structure
 * {
    "name": "Admin",
    "description": "Can perform all operations"
}
 */
export const createRoleSchema = z.object({
  body: z.object({
    name:        z.string().min(2).max(50),
    description: z.string().max(255).optional(),
  })
})


/**
 * Zod schema for creating a permission
 * Structure
 * { resource: 'Admin', action: 'create', description: 'Admin role' }
 */
export const createPermissionSchema = z.object({
  body: z.object({
    resource:    z.string().min(2).max(100),
    action:      z.string().min(2).max(100),
    description: z.string().max(255).optional(),
  })
})

/**
 * Zod schema for assigning a permission to a role
 * Structure
 * { roleId: 1, permissionId: [1,2,3,4] }
 */
export const assignPermissionToRoleSchema = z.object({
  params: z.object({ roleId: z.string().regex(/^\d+$/) }),
  body:   z.object({ permissionId: z.array(z.number().int().positive()).nonempty() }) //Array should not be empty and should contain one or more permission ids
})

/**
 * Zod schema for assigning a role to a user
 * Structure
 * { userId: 1, roleId: 1 }
 */
export const assignRoleToUserSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    roleId: z.number().int().positive(),
  })
})