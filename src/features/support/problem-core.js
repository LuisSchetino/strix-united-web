// "Reportar problema": what a member writes, plus what the site already knows about the moment
// (the page, the device, the last errors it met). Pure rules here; the dialog is
// ReportProblem.jsx and the Desenvolvedor tab lists the reports.

export const PROBLEM_BUCKET = "fc27-problem-reports";
export const PROBLEM_STATUS = Object.freeze({ open: "Aberto", seeing: "Vendo", resolved: "Resolvido" });
export const PROBLEM_MESSAGE_MIN = 3;
export const PROBLEM_MESSAGE_MAX = 2000;
const ERRORS_KEPT = 12;
const TEXT_MAX = 300;

const clip = (value, max = TEXT_MAX) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A small ring of the last errors the site met: thrown, rejected, or shown to the member. */
export function createErrorLog(max = ERRORS_KEPT, clock = () => new Date()) {
  const entries = [];
  return {
    remember(kind, message, source = "") {
      const text = clip(message);
      if (!text) return;
      const last = entries.at(-1);
      // the same error firing in a loop counts once
      if (last && last.kind === kind && last.message === text) { last.times = (last.times || 1) + 1; return; }
      entries.push({ kind, message: text, source: clip(source, 160), at: clock().toISOString() });
      while (entries.length > max) entries.shift();
    },
    list: () => entries.map((entry) => ({ ...entry })),
  };
}

export const problemErrors = createErrorLog();

/** Listens for the page's uncaught errors and rejected promises (once per window). */
export function installProblemCapture(target = typeof window === "undefined" ? null : window) {
  if (!target || target.__strixProblemCapture) return;
  target.__strixProblemCapture = true;
  target.addEventListener("error", (event) => {
    const where = event.filename ? `${String(event.filename).split("/").pop()}:${event.lineno || 0}` : "";
    problemErrors.remember("erro", event.message || event.error?.message || "Erro sem mensagem", where);
  });
  target.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    problemErrors.remember("falha", reason?.message || (typeof reason === "string" ? reason : "Promessa recusada"), reason?.code ? `código ${reason.code}` : "");
  });
  // what the member was told went wrong (the site's own error toasts)
  target.addEventListener("strix-toast", (event) => {
    if (event.detail?.tone === "error") problemErrors.remember("aviso", event.detail.message);
  });
}

/** The device as the dev needs it to reproduce: system, browser, screen, installed or not. */
export function deviceInfo(win = typeof window === "undefined" ? null : window) {
  if (!win) return {};
  const nav = win.navigator || {};
  const agent = String(nav.userAgent || "");
  return {
    system: /Android/i.test(agent) ? "Android" : /iPhone|iPad|iPod/i.test(agent) ? "iOS" : /Windows/i.test(agent) ? "Windows" : /Mac OS X/i.test(agent) ? "macOS" : /Linux/i.test(agent) ? "Linux" : "Outro",
    browser: /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /SamsungBrowser/.test(agent) ? "Samsung Internet" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Outro",
    mobile: /Mobi|Android|iPhone|iPad/i.test(agent),
    viewport: `${win.innerWidth || 0}×${win.innerHeight || 0}`,
    pixelRatio: Number(win.devicePixelRatio) || 1,
    installed: Boolean(win.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone),
    online: nav.onLine !== false,
    language: clip(nav.language, 20),
    agent: clip(agent, 300),
  };
}

/** "Android · Chrome · 390×844 · app instalado": one line for the list. */
export function describeDevice(device = {}) {
  return [device.system, device.browser, device.viewport, device.installed ? "app instalado" : "", device.online === false ? "sem internet" : ""]
    .filter(Boolean).join(" · ");
}

/** The row to insert, or an Error whose message the dialog shows. */
export function buildProblemRow({ message, profile, page = "", device = {}, errors = [], screenshotPath = null }) {
  const text = String(message || "").trim();
  if (text.length < PROBLEM_MESSAGE_MIN) throw new Error("Conte em poucas palavras o que aconteceu.");
  if (text.length > PROBLEM_MESSAGE_MAX) throw new Error(`Use até ${PROBLEM_MESSAGE_MAX} caracteres.`);
  if (!profile?.user_id) throw new Error("Entre na sua conta para reportar.");
  return {
    reporter_user_id: profile.user_id,
    reporter_name: clip(profile.display_name, 120),
    message: text,
    page: clip(page, 400),
    device,
    errors: (Array.isArray(errors) ? errors : []).slice(-ERRORS_KEPT),
    screenshot_path: screenshotPath,
  };
}

/** Where the picture goes: the member's own folder in the private bucket. */
export function problemPicturePath(userId, file, stamp = Date.now(), random = Math.random) {
  const extension = /webp/i.test(file?.type || "") ? "webp" : /png/i.test(file?.type || "") ? "png" : "jpg";
  return `${userId}/${stamp}-${random().toString(36).slice(2, 8)}.${extension}`;
}

const HOUR = 3_600_000;
const excerpt = (value) => { const text = clip(value, 90); return text.length >= 90 ? `${text.slice(0, 87)}…` : text; };

/**
 * The bell's part: for dev, every report still open from someone else; for the member, their
 * report when it moves to "vendo" or "resolvido" (for two weeks).
 */
export function problemNotices({ reports = [], profile = null, now = new Date() } = {}) {
  const out = [];
  const me = profile?.user_id;
  const dev = profile?.access_tier === "dev";
  for (const row of Array.isArray(reports) ? reports : []) {
    const report = { ...row, status: row.status || "open" };
    if (dev && report.status === "open" && report.reporter_user_id !== me) {
      out.push({ key: `problem:new:${report.id}`, kind: "problem", title: `Problema reportado por ${report.reporter_name || "um membro"}`, text: excerpt(report.message), at: report.created_at, target: { page: "desenvolvedor", remember: ["developer-tab", "problems"] } });
    }
    if (report.reporter_user_id !== me || report.status === "open") continue;
    const at = report.status === "resolved" ? report.resolved_at || report.updated_at : report.updated_at;
    if (now.getTime() - new Date(at).getTime() > 14 * 24 * HOUR) continue;
    out.push(report.status === "resolved"
      ? { key: `problem:resolved:${report.id}`, kind: "problem", title: "Seu problema foi resolvido", text: report.resolution_note ? excerpt(report.resolution_note) : excerpt(report.message), at, target: { page: "central" } }
      : { key: `problem:seeing:${report.id}`, kind: "problem", title: "Estão vendo o problema que você reportou", text: excerpt(report.message), at, target: { page: "central" } });
  }
  return out;
}
