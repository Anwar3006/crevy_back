// src/shared/utils/id.ts
import { uuidv7 } from 'uuidv7'

/** Use this for all UUID primary keys across v2 Drizzle models */
export const uuidv7PK = () => uuidv7()