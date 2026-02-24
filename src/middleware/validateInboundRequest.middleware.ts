import type zod from "zod";
import * as z from "zod";

/**
 * Validates an inbound request based on the provided schema.
 * @param schema The schema to use for validation.
 * @returns A middleware function that will validate the request
 * and pass it to the next function if valid, or return a 400
 * error response with the validation errors if invalid.
 */
const validateInboundRequest = (schema: zod.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as any;

      // Update req objects with parsed/transformed data
      // Note: req.query and req.params are read-only getters in Express 5 /
      // newer router versions — mutate the existing objects instead of replacing them.
      if (result.body) req.body = result.body;
      if (result.query) Object.assign(req.query, result.query);
      if (result.params) Object.assign(req.params, result.params);

      next();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        //@ts-ignore
        const formattedErrors = z.treeifyError(error).properties;
        return res.status(400).json({
          success: false,
          message: "Invalid request data",
          errors: formattedErrors,
        });
      }

      next(error);
    }
  };
};

export default validateInboundRequest;
