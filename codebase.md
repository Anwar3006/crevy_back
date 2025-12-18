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

## Installing better-auth

```bash
# First uninstall drizzle-kit and drizzle-orm as there is conflicting peer dependency between the one we manually installed and the one required by the current version of better-auth
$ npm uninstall drizzle-kit drizzle-orm
$ npm i better-auth
```

## Revised Codebase

### AuthFlow for User Registration with Credentials + Required Data

```bash
User → /api/v1/auth/register → Manual Transaction → ✅ Complete Profile
     (all data)                 (user + account + company/PO)
```

### AuthFlow for User Registration with OAuth Providers like Google

```bash
User → Click "Sign in with Google"
    ↓
BetterAuth OAuth Flow
    ↓
User Created (email, name, image only)
    ↓
Session Created
    ↓
Redirect to App
    ↓
Check profileCompleted = false
    ↓
Redirect to /complete-profile -> Frontend page that displays the remaining data
    ↓
User fills form (userName, userType, company/PO data)
    ↓
POST /api/v1/auth/complete-profile → Manual Transaction
                                    (update user + create company/PO)
    ↓
✅ Complete Profile
```

### Files To Look at

#### [models](src/v1/auth/models)

- Redefined the models to serve the [auth-model](src/v1/auth/models/auth-model.ts#L16) and the [auth-extension-model](src/v1/auth/models/auth-extension-model.ts). A clear separation of concerns, one for Auth(auth-model) and one for Business Requirement(auth-extension-model)

#### [schema](src/v1/auth/schema)

- Redefined the [authSchema](src/v1/auth/schema/authSchema.ts) to make it easier to read and understand.

#### Validator Middleware, Works with the Zod Schema we defined in [authSchema.ts](src/v1/auth/schema/authSchema.ts)

- This [middleware](src/middleware/validateInboundRequest.middleware.ts) helps us to type the incoming data from the request to make sure the datatypes of the fields are what we are expecting. It takes in a zodSchema as an argument. We can use it for body, query or params. If there is a violation, we immediately return. This serves as the first gate that data has to pass through before even reaching our controllers. So we use it in our route handlers, inbetween the route path and the controller, as seen:

```ts
authRouter.post(
  "/register",
  validateInboundRequest(signUpSchema),
  AuthController.registerUser
);
```

#### Global Error Handler and a custom Error class that extends Error

- [AppError](src/shared/errors/AppError.ts) is a class that extends the Error class. It helps us differentiate expected errors from bugs. With this the app wont crash on user input mistakes as they will be handled leaving other errors that occur to be flagged as developer errors so we can fix them. Using the isOperational we can differentiate between operational error or programmer errors.
- [globalErrorHandler & friends](src/shared/errors/errorHandler.ts): Seems like alot of functions? they are just helper that allow us to handle error more efficiently.

  - The [Not Found handler](src/shared/errors/errorHandler.ts#L7) is triggered when users visit endpoints that we havent configured, here you how we use AppError to manage expected errors.
  - The twins: [sendErrorDev & sendErrorProd](src/shared/errors/errorHandler.ts#L15) - these help use send different types of error messages based on the environment we are running in. For the developer the more verbose the error message the better so you can debug and find fixes. For the end user, they don't need to know much information about our internal workings.
  - Their parent: [globalErrorHandler](src/shared/errors/errorHandler.ts#L40) - This simply selects which function based on the `NODE_ENV`
  - This [wrapper function](src/shared/errors/errorHandler.ts#L56) takes a function as argument.

  ```ts
  //Basically instead of
  export const someControllerFucntion = async (req, res, next) => {
    try {
      //logic
    } catch (error) {
      next(error);
    }
  };

  // we simply use:
  export const someControllerFunctionOptimized = catchAsync(
    async (req, res, next) => {
      // logic
    }
  );
  // so catchAsync takes the content of whatever function to pass to it and runs it inside a tryCatch block and calls next with the error, the error is later handled by the globalErrorHandler
  ```

  - We use the error handlers in the [index.ts](src/index.ts#L38). Note that `NotFound` has to come before `globalErrorHandler`.

#### BetterAuth setup

- We setup BetterAuth [here](src/shared/utils/auth.ts). The Documentation requires that we set it within a folder called `lib/` or `utils` and this folder has to be in the root direction not nested in directories like we have but our project directories is special so it's okay. For the cli to find the `auth.ts` file, you have to use:

```bash
$ npx @better-auth/cli generate --config src/shared/utils/auth.ts
# where src/shared/utils/auth.ts is the path to the auth.ts file
# when you run this, it will generate the models into a file called auth-schema.ts in the root directory. You can move this file anywhere you like and rename it if you want. You can then extend and modify the fields in the table but you will have to tell betterAuth that you have added fields to the table. this is done through the additionalFields in the auth.ts
```

#### [auth.controller.ts](src/v1/auth/services/auth.service.ts)

- Relies on the functions in the AuthService. The sole responsibility of this controller is to receive HTTP Requests from the Router and pass them to the Service layer.

#### [auth.service.ts](src/v1/auth/services/auth.service.ts)

- [Here](src/v1/auth/services/auth.service.ts#L12) we use a transaction to insert data into 3 tables. We use a Transaction for Atomicity, meaning all tha tables should be inserted or none should be inserted. We do not want Orphaned data in our tables. Having a user data in the user table without a corresponding data in either the company table or the projectOwner table violates our business constraint.

- The [userExists](src/v1/auth/services/auth.service.ts#L) is used to check if a user with the same email already exists in our database. It returns a boolean.
