

import { z } from "zod";

/**
 * Zod schema for user registration
 * Structure
 * { name: 'John Doe', email: [EMAIL_ADDRESS]', password: 'password', userType: 'business' }
 */
export const registerSchema = z.object({
  body: z.object({
    firstName:        z.string().min(2).max(100),
    lastName:         z.string().min(2).max(100),
    email:            z.email(),
    password:         z.string().min(6).max(255),
    contactNumber:    z.string().min(10).max(15).optional(),
    countryOfOperation: z.string().min(2).max(100),
    defaultCurrencyId: z.number().int().positive().optional(),  //optional, we can get it from the countryOfOperation
    roleId: z.number().int().positive(),
    
  })
})

/**
 * Zod schema for user login
 * Structure
 * { email: [EMAIL_ADDRESS]', password: 'password' }
 */
export const loginSchema = z.object({
  body: z.object({
    email:       z.string().email(),
    password:    z.string().min(6).max(255),
  })
})