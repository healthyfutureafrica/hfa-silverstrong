// Validates part of the request with a zod schema and stores the cleaned result on req.valid.
// Invalid input throws a ZodError, which the error handler returns as a 400 response.
//   router.post('/x', validate(bodySchema), handler)          -> req.valid.body
//   router.get('/x', validate(querySchema, 'query'), handler) -> req.valid.query
function validate(schema, source = 'body') {
  return (req, res, next) => {
    req.valid = req.valid || {};
    req.valid[source] = schema.parse(req[source] ?? {});
    next();
  };
}

module.exports = { validate };
