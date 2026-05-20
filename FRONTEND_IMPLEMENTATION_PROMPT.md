# Frontend Implementation Prompt — Crevy dMRV Demo Simulation

## Context
The backend simulation endpoint is now ready at `POST /api/v2/mrv/simulate/:projectId`. This endpoint performs a full dMRV pipeline simulation, inserting records into `mrv_ingestion_event`, `mrv_verification_result`, and `mrv_blockchain_anchor`.

Your task is to implement the frontend logic to trigger this simulation and display the results.

## Requirements

### 1. Project Service Update
Add `simulateMrv` to `src/lib/services/project-service.tsx`:
```typescript
simulateMrv: async (projectId: string) => {
  const response = await axiosClient.post(`/mrv/simulate/${projectId}`)
  return response.data
},
```

### 2. Automatic Simulation on Project Creation
In `src/app/(project)/new-project/page.tsx`, inside the `onSubmit` function:
- After project creation and file uploads, but before redirecting to the project profile.
- Call `ProjectService.simulateMrv(projectId)`.
- Wrap it in a try/catch so failure doesn't block the user. Log a warning on error.

### 3. Manual Simulation Trigger on Project Profile
In `src/app/(dashboard)/project-profile/[id]/page.tsx`:
- In the MRV tab (`<TabsContent value="mrv">`), when there are no verifications (`verifications.length === 0`).
- Show a "Simulate MRV Pipeline" button using a `useMutation` from React Query.
- The button should have a "Zap" icon from `lucide-react` and a loading state ("Simulating pipeline...").
- On success, show a toast notification and invalidate relevant queries: `['project-verifications', id]`, `['project-anchors', id]`, and `['project', id]`.
- Use `framer-motion` for smooth transitions and animations if possible.

### 4. Component UI
- The empty state should be a rounded card with a dashed border (`bg-slate-50 border-dashed border-slate-200`).
- Include explanatory text about awaiting sensor readings in production.
- The "Simulate MRV Pipeline" button should be styled with Crevy's brand colors (e.g., `bg-[#2cc295]`).

## Implementation details
Use the existing UI components (`Button`, `Loader2`, etc.) and libraries (`axios`, `lucide-react`, `sonner`, `react-query`).
