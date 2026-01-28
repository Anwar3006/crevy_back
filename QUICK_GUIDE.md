# Quick Reference - Project API

## 🚀 Quick Start

### 1. Register Routes (in your main app)

```typescript
import { projectRoutes } from "@/v1/projects";
app.use("/api/v1/projects", projectRoutes);
```

### 2. Test Authentication

- `8081` is the port number I am running the server on, change it to your port number when you copy it

```bash
# Register new user with, fill out this info to register a new user:
curl http://localhost:8081/api/auth/sign-up/email \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "name": "First User",
  "firstName": "First",
  "lastName": "User",
  "userName": "user#1",
  "userType": "ProjectOwner",
  "email": "user_1@gmail.com",
  "password": "mypassword",
  "image": "",
  "callbackURL": "",
  "rememberMe": true
}'

# we already used the above to create a user, you can login with the below
curl -X POST http://localhost:8081/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user_1@gmail.com", "password": "mypassword"}' \
  -c cookies.txt
```

### 3. Create a Project

- The payload required for complete project creation is found [here](./src/v1/projects/schema/projectSchema.schema.ts)

```bash
curl -X POST http://localhost:8081/api/v1/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Project",
    "location": "Kenya",
    "startDate": "2024-01-01T00:00:00.000Z",
    "durationMonths": 12,
    "practices": []
  }'
```

## 📁 File Structure

```
/src
  /middleware
    auth.middleware.ts          ← Authenticates users, attaches req.user
    validation.middleware.ts    ← Validates requests with Zod schemas

  /v1
    /projects
      index.ts                  ← Exports module
      project.routes.ts         ← Defines 5 endpoints
      project.controller.ts     ← Handles HTTP logic
      project.service.ts        ← Business logic + DB operations

    /auth/schema
      projectSchema.ts          ← Zod validation schemas
```

## 🔄 Request Flow

```
HTTP Request
    ↓
requireAuth → Validates session → Attaches req.user
    ↓
validateInboundRequest → Validates data → Returns 400 if invalid
    ↓
Controller → Extracts data → Calls service
    ↓
Service → Transaction → DB operations → Calculates impact
    ↓
HTTP Response
```

## 🛣️ API Endpoints

| Method | Endpoint               | Description      | Auth | Validation           |
| ------ | ---------------------- | ---------------- | ---- | -------------------- |
| POST   | `/api/v1/projects`     | Create project   | ✅   | createProjectSchema  |
| GET    | `/api/v1/projects`     | Get all projects | ✅   | getAllProjectsSchema |
| GET    | `/api/v1/projects/:id` | Get one project  | ✅   | projectParamsSchema  |
| PUT    | `/api/v1/projects/:id` | Update project   | ✅   | updateProjectSchema  |
| DELETE | `/api/v1/projects/:id` | Delete project   | ✅   | projectParamsSchema  |

## 📊 Response Codes

| Code | Meaning      | When                           |
| ---- | ------------ | ------------------------------ |
| 200  | Success      | GET, PUT, DELETE successful    |
| 201  | Created      | POST successful                |
| 400  | Bad Request  | Validation failed              |
| 401  | Unauthorized | Not authenticated              |
| 404  | Not Found    | Project not found or no access |
| 500  | Server Error | Database/server error          |

## 🔐 Authentication

**Method:** Session-based (better-auth)

**Token Location:**

- Cookie: `better-auth.session_token`
- OR Header: `Authorization: Bearer <token>`

**User Object:**

```typescript
req.user = {
  id: string,
  email: string,
  name: string,
  // ... other user fields
};
```

## ✅ Validation Schemas

### Create Project (Required Fields)

```typescript
{
  name: string,              // min 1, max 255
  location: string,          // min 1, max 255
  startDate: string,         // ISO 8601 datetime
  durationMonths: number,    // positive integer
}
```

### Optional Fields

```typescript
{
  projectType: enum,         // default: "regenerative_agriculture"
  status: enum,              // default: "draft"
  totalAreaHectares: number,
  practices: Array<{
    practiceId: string,      // UUID
    areaHectare: number,     // positive
    intensity: string        // min 1
  }>
}
```

### Query Params (GET /projects)

```typescript
{
  page?: number,             // default: 1
  limit?: number,            // default: 10, max: 100
  status?: enum,
  projectType?: enum
}
```

## 🎯 Key Features

✅ **Authentication** - Session-based with better-auth  
✅ **Validation** - Zod schemas for all inputs  
✅ **Authorization** - Ownership verification  
✅ **Carbon Calculation** - Automatic impact calculation  
✅ **Practice Snapshots** - Impact factors frozen at creation  
✅ **Transactions** - Atomic database operations  
✅ **Pagination** - Page and limit support  
✅ **Filtering** - By status and project type  
✅ **Cascading Deletes** - Clean up related data

## 💾 Database Tables

```sql
user (id, email, name, ...)
project (id, user_id, name, estimated_total_tco2e, ...)
project_practices (id, project_id, practice_id, impact_factor_at_signing, ...)
regenerative_practices (id, name, impact_factor_tco2e_per_ha_per_year, ...)
```

## 🐛 Common Errors

**"Authentication required. No token provided."**
→ Include session cookie or Authorization header

**"Invalid request data"**
→ Check schema requirements, date format, UUIDs

**"Project not found or you do not have permission"**
→ Verify project ID and ownership

**"Practice with ID <uuid> not found"**
→ Ensure practice exists in regenerative_practices table

## 📝 Example Request Bodies

### Minimal Project

```json
{
  "name": "My Farm",
  "location": "Kenya",
  "startDate": "2024-01-01T00:00:00.000Z",
  "durationMonths": 12
}
```

### Full Project with Practices

```json
{
  "name": "Regenerative Farm",
  "location": "Kenya, Nairobi",
  "startDate": "2024-01-01T00:00:00.000Z",
  "durationMonths": 36,
  "projectType": "regenerative_agriculture",
  "status": "draft",
  "totalAreaHectares": 100,
  "practices": [
    {
      "practiceId": "uuid-here",
      "areaHectare": 50,
      "intensity": "high"
    }
  ]
}
```

### Update Project

```json
{
  "name": "Updated Name",
  "status": "submitted"
}
```

## 🧪 Testing Checklist

- [ ] User can authenticate
- [ ] Session token is valid
- [ ] Can create project without practices
- [ ] Can create project with practices
- [ ] Carbon impact calculated correctly
- [ ] Can retrieve all projects
- [ ] Pagination works
- [ ] Filtering works
- [ ] Can retrieve single project
- [ ] Can update project
- [ ] Can delete project
- [ ] Validation errors return 400
- [ ] Unauthorized returns 401
- [ ] Not found returns 404

## 📚 Documentation

- `PROJECT_FLOW_TESTING.md` - Testing guide with cURL examples
- `IMPLEMENTATION_GUIDE.md` - Detailed integration steps
- `SUMMARY.md` - Complete implementation summary

## 🎓 Architecture Patterns

**Pattern:** MVC (Model-View-Controller)

- **Routes** - Define endpoints and middleware chain
- **Controller** - Handle HTTP request/response
- **Service** - Business logic and data access
- **Middleware** - Cross-cutting concerns (auth, validation)

**Database:** Drizzle ORM with PostgreSQL
**Authentication:** better-auth with session tokens
**Validation:** Zod schemas
**Error Handling:** Try-catch with proper status codes
