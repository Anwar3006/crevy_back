# crevy-backend

The backend service for the Crevy platform

## Requirements

The package manager used during project creation is npm version v10.9.2.

The following minimum requirements are needed to successfully run the project:

- [Node.JS v20.\*](https://nodejs.org/en/download)
- NPM v10.8.2

## Installtion

- Clone the repository
- Create your `.env` file with valid values in the project's root directory (same location as `.env.example`) using `.env.example` as reference.
- Install dependencies if your project does not contain the `package-lock.json` file. Otherwise starting the development containers (in the next few steps) will install the dependencies needed.
- Set up lefthook:

```bash
npx lefthook install
```

- Start development containers and watch for changes:

```bash
docker compose up --build --watch
```

- Visit http://localhost:8080/api/v1/health in your browser, Postman or any api client (`curl`), to view the running api.

## Tools & Technologies

### Stack for development

- [Express.JS v5.1.0](https://expressjs.com/)
- [Zod](https://zod.dev/) is used for schema validation

### Tooling

- [BiomeJS](https://biomejs.dev/) is used for code formatting and linting
- [LeftHook](https://lefthook.dev/) is used to manage pre-commit hooks ensuring all staged files are formatted properly before commited. Committing code changes will reveal the following (supposing a single file is staged for changes and it contains some formatting issues):

```ts
// Problem 1: Use of single quotes instead of double quotes
// Problem 2: No semicolon
import bodyParser from "body-parser";
```

```bash
git add .
git commit -m "import bodyParser"
```

Will produce:

```bash
🥊 lefthook v2.0.4  hook: pre-commit │
╰──────────────────────────────────────╯
┃  check ❯

Checked 1 file in 12ms. Fixed 1 file.


  ────────────────────────────────────
summary: (done in 1.98 seconds)
✔️ check (1.97 seconds)
```

**Note**: If the above information is not shown when you commit changes, kindly run the command below to set up `lefthook`:

```bash
npx lefthook install
```

---

**Note: If your development environment is WSL running in Windows (via VS Code), I strongly advice you commit changes using the VS Code integrated terminal due to `UNC` path issues with Windows and WSL. This will break the effect of the pre-commit hook.**

```bash
# The following error is produced when you commit using the VS Code Source Control panel

│ 🥊 lefthook v2.0.11  hook: pre-commit │
╰───────────────────────────────────────╯
┃  check ❯

bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)
'\\wsl.localhost\Ubuntu-24.04\home\martyofmca\work\foovante-global\crevy-frontend'
CMD.EXE was started with the above path as the current directory.
UNC paths are not supported.  Defaulting to Windows directory.
C:\Windows\src\app\page.tsx internalError/io  INTERNAL  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × The system cannot find the path specified. (os error 3)

  ! This diagnostic was derived from an internal Biome error. Potential bug, please reChecked 0 files in 14ms. No fixes applied.port it if necessary.




  ────────────────────────────────────
summary: (done in 2.86 seconds)
✔️ check (2.86 seconds)
```

---

## Working With DB Migrations

Migration names should use the Pascal casing with the name clearly defining the intent of the migration. Here are some example:

```txt
- AddAuthModel # This can be used when creating the authentical model
- AddEmailFieldToAuthModel # This can be used when migration is adding an email field to Auth model

```

- To create a new DB migration, you can invoke the `db:generate` script

```bash
# Filaing to provide `-- --name=` followed by the desired name will end up creating DB migrations with random name.
npm run db:generate -- --name=MigrationName
```

## Important Project Rules

- When importing in a module, kindly use the path aliases defined in the `tsconfig.json` like so:

```ts
import settings from "../../config/settings"; ❌
import settings from "@config/settings"; ✅
```

- You are free to define as many path aliases you need to make the codebase readable.
- Avoid undescriptive packed strings. Use structured data instead

```ts
// Avoid this ❌
const someUserDetails =
  "firstName=Jake&lastName=Savage&avatar=https://linktoavatar.com&role=admin";
// This is fine ✅
const user = {
  firstName: "Jake",
  lastName: "Savage",
  avatar: "https://linktoavatar.com",
  role: "admin",
};
// This is also fine ✅
const firstName = "Jake";
const lastName = "Savage";
const avatar: "https://linktoavatar.com";
const role = "admin";
```

- Project structure follows this pattern:

```bash
# Each feature or module has its directory in the appropriate API version
v1/
├─ auth/
└─ user/

# With the following sub-directories
auth/
├─ controllers/ # Process requests coming from routes
├─ middlewares/ # Custom middlewares for endpoints
├─ models/ # Database models
├─ repositories/ # Database access & queries
├─ routes/ # Route definitions
├─ schemas/ # Zod schemas (request/response validation)
├─ services/ # Business logic
└─ types.ts # Shared TypeScript type definitions

# Example
src/
├── config/
│   └── db.ts # Drizzle-ORM config
├── v1
│   └── user/
│       ├── controllers/
│       │   ├── accountController.ts # Handle HTTP requests from routes defined in `account.ts`
│       │   └── preferencesController.ts # Handle HTTP requests from the routes defined in `preferences.ts`
        ├── middlewares/
│       │   └── accountMiddleware.ts # Define the custom middlewares for the account route handler
│       ├── models/
│       │   └── userModel.ts # Define the user model mapped as a DB table
│       ├── repositories/
│       │   ├── accountRepository.ts # Define CRUD functions for manipulating account operations
│       │   └── preferencesRepository.ts # Define CRUS functions for manipulating user preferences
│       ├── routes/
│       │   ├── account.ts # Routes to handle user account management (edit profile .etc)
│       │   └── preferences.ts # Routes to handle user preferences or settings
│       ├── schemas/
│       │   ├── request.ts # Define the schema for validating request payload
│       │   └── response.ts # Define the schema for validating response payload (if need be)
│       └── services/
│           └── accountService.ts # Handle specific business logics needed for user account operations
└── shared/
    └── constants.ts

```

## Help

Kindly refer to the [Engineering Guide](./ENGINEERING_GUIDE.md) on the best practices to follow for this project.

Thank you and have a great time solving problems!
