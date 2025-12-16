# Understanding the codebase, folder structure and files

## @src/shared

- This folder contains shared resources

### @src/shared/models

- This folder contains models that can be reused in other models. Example is the [timestamp.ts](./src/shared/models/timestamp.ts) that contains defined fields that are reused in other model definitions

### @src/shared/index.ts

- This file is where we define all the types for our project

## @src/config

- This folder holds files that allow us to configure our project

### @src/config/schemas

- This folder holds files that define the structure of objects(Schema) to be used throughout the codebase. Example is the [envSchema.ts] file which holds the schema, defined with zod, of expected env variables.

### @src/config/db.ts

- This file hold the initialization of our database, relying on drizzle as the orm to connect to our database

### @src/config/logger.ts

- This file holds the logger function to write logs to a specified file. We can write error logs, general info logs, etc.

### @src/config/settings.ts

- This file is doing three important things:
  1. Centralizes environment variables
  2. Validates them at app startup
  3. Provides type-safe, predictable access across the app
- It uses the envSchema.ts to validate all environment variables before the app runs.

## @src/v1

- This folder holds the files the need to be developed into the business logic. The controllers, routes, services, etc will exist in this folder.

---

## New files added

- [schema.ts](src/v1/schema.ts): This file serves as a central point from where we export all the tables, enums, relations from each domain(example the auth domain)
- As we export the tables from schema.ts, we import them in the db:
  - [importing the schema](src/config/db.ts#L8)
  - [using it in drizzle](src/config/db.ts#L13)
- [userModel.ts](src/v1/auth/models/userModel.ts): This file contains all the tables required to store users(project_owners & companies).

## Dependencies Added for Auth Building

- Install these additional libraries

```bash
$ npm i jsonwebtoken bcrypt lodash dayjs pino pino-pretty
# then add these devdependencies
$ npm i -D @types/body-parser @types/pino @types/bcrypt @types/jsonwebtoken @types/lodash
```

- These are added to .env

```env
 SALTWORKFACTOR=10
 ACCESS_TOKEN_TTL="30m" //expires every 30minutes
 REFRESH_TOKEN_TTL="10days" //expires every 10days
```

- Introduced a logger with pino and pino-pretty. Files affected:
  - [logger.ts](src/config/logger.ts#L21) - In here we define the logger and export it
  - [index.ts](src/index.ts#L29) - We use the exported pino instance to log the server start to stdout.

## Validation

```bash
# to be used for validation of inbound/outbound data
$ npm i drizzle-zod
```

1. Data Validation (Incoming Data)

- To validate data coming into your API or application (e.g., from a form or a request body), you use the Zod Schemas. These schemas act as the "gatekeepers" that check if the input matches your database requirements.

  - For Users: Use createUserSchema or updateUserSchema. These ensure that fields like email , userName, and the plain-text password meet your rules before they ever touch your database.

  - For Company/Project Owners: Use createTypedUserSchema. This is a discriminated union , which is very powerful; it automatically validates the correct nested fields (like legal business name for a "Company" or project_category for a "ProjectOwner") based on the userType provided.

2. Generating Types (App-Wide Objects)

- To define the shape of objects used throughout the application (like a user profile displayed on a dashboard), you use the TypeScript Types inferred from those schemas or the database models.

  - For Database Records: Use UserDB, CompanyDB, and ProjectOwnerDB. These represent the "raw" data exactly as it exists in your tables.

  - For the "Main" User Object: Use TUser. This is likely the most important type in the app. It combines the base user data with the specific details of their role.
    - If userType is "Company", TUser will require the company object.
    - If userType is "ProjectOwner", TUser will require the projectOwner object

## Password Related(Hashing & Comparison)

- [PasswordHasher](src/utils/passwordhash.ts#L4): Utility function to help hash passwords during account creation
- [PasswordComparer](src/utils/passwordhash.ts#L16): Utility function to help compare passwords during login
