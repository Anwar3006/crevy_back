// src/middleware/validateInboundRequest.middleware.ts
import type zod from "zod";
import * as z from "zod";

/**
 * Validates an inbound request against the provided Zod schema.
 *
 * The schema MUST wrap fields by request location:
 *   z.object({ body: z.object({...}), params: z.object({...}), query: z.object({...}) })
 *
 * On success:  req.body / req.params / req.query are replaced with the
 *              Zod-parsed (and possibly coerced/transformed) values.
 * On failure:  returns 400 with a structured errors object.
 *
 * ─── ZOD v4 NOTES ────────────────────────────────────────────────────────────
 * z.treeifyError(error) returns the error tree DIRECTLY — no `.properties` wrapper.
 * Structure: { _errors: string[], body: { _errors: string[], name: { _errors: [...] } } }
 * We return the tree as-is so clients get a fully nested error map.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const validateInboundRequest = (schema: zod.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse({
      body:   req.body,
      query:  req.query,
      params: req.params,
    }) as any;

    if (!result.success) {
      let errors: unknown;

      try {
        // z.treeifyError is the Zod v4 API — returns nested tree directly
        errors = (z as any).treeifyError(result.error);
      } catch {
        // Fallback: flat array of issue objects — works across all versions
        errors = result.error.issues;
      }

      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors,
      });
    }

    // Replace req objects with Zod-parsed (and coerced/transformed) values.
    // req.query and req.params are read-only getters in Express 5 —
    // use Object.assign to mutate in-place rather than reassigning.
    if (result.data.body)   req.body = result.data.body;
    if (result.data.query)  Object.assign(req.query,  result.data.query);
    if (result.data.params) Object.assign(req.params, result.data.params);

    next();
  };
};

export default validateInboundRequest;
