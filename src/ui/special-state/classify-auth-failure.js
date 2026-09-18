export function classifyAuthFailure(error, { hadSession = false, status = 0 } = {}) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");
  const code = Number(status || error?.status || 0);
  if (code === 503 || /supabase_not_configured|backend_configuration|service unavailable|server_auth_not_configured/i.test(message)) {
    return "unavailable";
  }
  const aborted = name === "AbortError" || /aborted|timed out|timeout/i.test(message);
  if (
    hadSession
    && (code === 401 || aborted || /jwt expired|invalid jwt|invalid_session|session_expired|token.*(expired|invalid)|not authenticated/i.test(message))
    && !/not_in_team_server|discord_role_unmapped|insufficient_permission/i.test(message)
  ) {
    return "session";
  }
  return "";
}
