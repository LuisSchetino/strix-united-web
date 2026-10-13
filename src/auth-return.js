// When Discord or the sign-in service refuses a login, the browser comes back to the site with
// the reason in the address (`?error=…&error_description=…`, or after `#`). It used to be
// dropped: the person just saw the sign-in screen again and nobody knew why. This reads it and
// says it in the club's words.

const text = (value) => String(value || "").replace(/\+/g, " ").trim();

/** `{ code, message }` for a refused sign-in found in the address, or null when there is none. */
export function readSignInRefusal(location = {}) {
  const params = new URLSearchParams(String(location.search || "").replace(/^\?/, ""));
  const hash = new URLSearchParams(String(location.hash || "").replace(/^#\/?/, ""));
  const pick = (name) => text(params.get(name) || hash.get(name));
  const error = pick("error");
  const code = pick("error_code");
  const description = pick("error_description");
  if (!error && !code && !description) return null;
  const all = `${error} ${code} ${description}`.toLowerCase();
  let message;
  if (/unverified email|email.*not.*verified|provider_email_needs_verification|confirmation email/.test(all)) {
    message = "Seu Discord está com o e-mail sem verificar. Verifique o e-mail na sua conta do Discord (Configurações › Minha conta) e entre de novo.";
  } else if (/error getting user email|email.*(missing|required|not found)/.test(all)) {
    message = "Sua conta do Discord não tem e-mail cadastrado. Cadastre e verifique um e-mail no Discord (Configurações › Minha conta) e entre de novo.";
  } else if (/access_denied|user denied|cancel/.test(all)) {
    message = "A entrada foi cancelada no Discord. Toque em Entrar e autorize o acesso para continuar.";
  } else if (/banned/.test(all)) {
    message = "Esta conta está bloqueada no site. Fale com a diretoria.";
  } else {
    message = `O Discord não concluiu a entrada${description ? ` (${description})` : ""}. Tente de novo; se continuar, mande esta mensagem para a diretoria.`;
  }
  return { code: code || error || "sign_in_refused", message };
}

/** The address without the refusal, so a reload does not show an old error. */
export function withoutSignInRefusal(location = {}) {
  const params = new URLSearchParams(String(location.search || "").replace(/^\?/, ""));
  for (const name of ["error", "error_code", "error_description"]) params.delete(name);
  const hash = /error(_code|_description)?=/.test(String(location.hash || "")) ? "" : String(location.hash || "");
  const query = params.toString();
  return `${location.pathname || "/"}${query ? `?${query}` : ""}${hash}`;
}
