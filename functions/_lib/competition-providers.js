import { parseCompetitionHtml, validateCompetitionUrl, validateProviderPageUrl } from "../../shared/competition-providers.js";
import { assembleCompetitionBundle } from "../../shared/competition-bundle.js";

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 2;
const TIMEOUT_MS = 9000;

async function readLimitedText(response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error("provider_response_too_large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error("provider_response_too_large");
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("provider_response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/**
 * Opens one provider page with every guard on: the address is validated (and
 * validated again on each redirect), the wait is bounded and only HTML is
 * accepted. Returns the open response and the address it finally came from.
 */
export async function openProviderPage(rawUrl, fetchImpl = fetch, validate = validateProviderPageUrl) {
  let target = validate(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("provider_timeout"), TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(target, {
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9",
          "user-agent": "StrixFC27CompetitionProvider/1.0",
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) throw new Error("provider_timeout");
      throw new Error("provider_unavailable");
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) throw new Error("provider_redirect_limit");
      const location = response.headers.get("location");
      if (!location) throw new Error("provider_invalid_redirect");
      target = validate(new URL(location, target).toString());
      continue;
    }
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("provider_invalid_content_type");
    if (Number(response.headers.get("content-length") || 0) > MAX_RESPONSE_BYTES) throw new Error("provider_response_too_large");
    return { response, url: target, redirects: redirect };
  }
  throw new Error("provider_redirect_limit");
}

export async function fetchCompetitionPreview(rawUrl, fetchImpl = fetch) {
  const page = await openProviderPage(rawUrl, fetchImpl, (url) => validateCompetitionUrl(url).url);
  const parsed = parseCompetitionHtml(await readLimitedText(page.response), page.url);
  return { ...parsed, security: { redirects: page.redirects, maxBytes: MAX_RESPONSE_BYTES, fetchedUrl: page.url } };
}

export async function fetchCompetitionBundle(rawUrl, fetchImpl = fetch) {
  return assembleCompetitionBundle(rawUrl, (url) => fetchCompetitionPreview(url, fetchImpl));
}
