// 1. Project Creation & Management
POST /api/projects - Create new project
GET /api/projects - List user's projects
GET /api/projects/:id - Get project details
PUT /api/projects/:id - Update project
POST /api/projects/:id/submit - Submit for review
DELETE /api/projects/:id - Delete project

// 2. Project Steps/Forms
GET /api/projects/:id/step/:step - Get step data
POST /api/projects/:id/step/:step - Save step data

// Steps: 'basics', 'land-use', 'soil-biomass', 'inputs', 'community', 'documents'

// 3. Carbon Calculation
POST /api/projects/:id/calculate-carbon - Calculate carbon footprint
GET /api/projects/:id/carbon-results - Get calculation results

// 4. Documents
POST /api/projects/:id/documents - Upload documents
GET /api/projects/:id/documents - List documents
DELETE /api/projects/:id/documents/:docId - Delete document

// 5. Practices
GET /api/practices - List all regenerative practices
