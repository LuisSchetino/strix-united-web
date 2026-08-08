import { parseCompetitionHtml, validateCompetitionUrl } from "../../shared/competition-providers.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
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

export async function fetchCompetitionPreview(rawUrl, fetchImpl = fetch) {
  let target = validateCompetitionUrl(rawUrl).url;
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
      target = validateCompetitionUrl(new URL(location, target).toString()).url;
      continue;
    }
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("provider_invalid_content_type");
    const parsed = parseCompetitionHtml(await readLimitedText(response), target);
    return { ...parsed, security: { redirects: redirect, maxBytes: MAX_RESPONSE_BYTES, fetchedUrl: target } };
  }
  throw new Error("provider_redirect_limit");
}

export async function fetchCompetitionBundle(rawUrl, fetchImpl = fetch) {
  const primary = await fetchCompetitionPreview(rawUrl, fetchImpl);
  const related = await Promise.all((primary.relatedSourceUrls || []).map(async (url) => {
    try { return await fetchCompetitionPreview(url, fetchImpl); } catch { return null; }
  }));
  const relatedPreviews = related
    .filter(Boolean)
    .filter((preview) => preview.externalCompetitionId === primary.externalCompetitionId)
    .filter((preview) => preview.sourceKind !== primary.sourceKind)
    .filter((preview) => preview.sourceKind !== "knockout" || preview.knockout?.hasStrix)
    .filter((preview, index, all) => all.findIndex((item) => item.sourceKind === preview.sourceKind) === index);
  return { ...primary, relatedPreviews };
}
