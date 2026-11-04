/** True when PostgREST or Postgres says the table or column is not there yet. */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01"
    || error.code === "42703"
    || error.code === "PGRST204"
    || error.code === "PGRST205"
    || /does not exist|schema cache|Could not find the/i.test(message);
}

export const SCHEMA_PENDING_MESSAGE = "Cette fonction attend l’application de sa migration. Le reste de l’application continue de fonctionner.";
