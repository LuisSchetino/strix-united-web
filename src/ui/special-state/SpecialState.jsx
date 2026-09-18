import React, { Component, useEffect } from "react";
import { ClubLogo } from "../ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { deniedPageCopy, locationForPage } from "../../access.js";
import { useReducedMotion } from "../motion/motion.jsx";
import "./special-state.css";

export function goToCentral() {
  const next = locationForPage("central");
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
    window.history.pushState({ page: "central" }, "", next);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  goToCentral();
}

const COPY = {
  offline: {
    kicker: "STRIX UNITED",
    code: "OFFLINE",
    title: "Sem conexão.",
    body: "O site não consegue alcançar a rede agora. Confira o Wi-Fi ou os dados móveis e tente de novo.",
    primary: "Tentar novamente",
    hint: "Verificar conexão",
  },
  "not-found": {
    kicker: "STRIX UNITED",
    code: "404",
    title: "Página não encontrada.",
    body: "Essa rota não existe no FC 27. Volte para a Central ou retorne à tela anterior.",
    primary: "Ir para a Central",
    secondary: "Voltar",
  },
  forbidden: {
    kicker: "ACESSO",
    code: "403",
    title: "Área restrita.",
    body: "Você está autenticado, mas este espaço não entra no seu cargo.",
    primary: "Ir para a Central",
    secondary: "Voltar",
  },
  session: {
    kicker: "STRIX UNITED",
    code: "SESSÃO",
    title: "Sessão expirada.",
    body: "Sua autenticação encerrou. Entre de novo com o Discord para continuar no vestiário.",
    primary: "Entrar novamente",
  },
  unexpected: {
    kicker: "STRIX UNITED",
    code: "500",
    title: "Algo saiu do roteiro.",
    body: "Houve uma falha inesperada. Nada disso é culpa sua — tente de novo ou volte para a Central.",
    primary: "Tentar novamente",
    secondary: "Voltar para a Central",
  },
  unavailable: {
    kicker: "STRIX UNITED",
    code: "503",
    title: "Serviço temporariamente fora.",
    body: "O FC 27 está indisponível neste momento. Não é um erro seu — estamos restabelecendo o acesso.",
    primary: "Tentar novamente",
    secondary: "Voltar",
  },
  restricted: {
    kicker: "ÁREA INTERNA",
    code: "RESTRITO",
    title: "Recurso não público.",
    body: "Este caminho não é uma página do clube. A proteção real continua na rota, no backend e na ACL — não nesta tela.",
    primary: "Ir para a Central",
    secondary: "Voltar",
  },
};

export function SpecialState({
  kind = "unexpected",
  page,
  title,
  body,
  embedded = false,
  onPrimary,
  onSecondary,
  onHint,
  onHome,
  onBack,
  onRetry,
  onLogin,
}) {
  const reduced = useReducedMotion();
  const denied = kind === "forbidden" ? deniedPageCopy(page) : null;
  const copy = COPY[kind] || COPY.unexpected;
  const heading = title || denied?.title || copy.title;
  const text = body || denied?.message || copy.body;

  useEffect(() => {
    const previous = document.title;
    document.title = `${copy.code} · Strix United | FC 27`;
    const robots = document.querySelector('meta[name="robots"]');
    const previousRobots = robots?.getAttribute("content") || "";
    robots?.setAttribute("content", "noindex,nofollow");
    return () => {
      document.title = previous;
      if (robots && previousRobots) robots.setAttribute("content", previousRobots);
    };
  }, [copy.code]);

  const runHome = () => (onHome || goToCentral)();
  const runBack = () => (onBack || goBack)();
  const runRetry = () => (onRetry || onPrimary || (() => window.location.reload()))();
  const primary = () => {
    if (onPrimary) return onPrimary();
    if (kind === "session") return onLogin?.();
    if (kind === "offline" || kind === "unexpected" || kind === "unavailable") return runRetry();
    return runHome();
  };
  const secondary = () => {
    if (onSecondary) return onSecondary();
    if (kind === "unexpected") return runHome();
    return runBack();
  };

  return (
    <main
      className={`special-state${embedded ? " is-embedded" : ""}${reduced ? " is-reduced" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div className="special-state-ambient" aria-hidden="true" />
      <div className="special-state-stripes" aria-hidden="true" />
      <p className="special-state-wordmark" aria-hidden="true">STRIX</p>
      <div className="special-state-vignette" aria-hidden="true" />
      <div className="special-state-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <section className="special-state-panel">
        <span className="special-state-kicker">{copy.kicker}</span>
        <ClubLogo
          name="Strix United"
          url={STRIX_BRAND.logo}
          className="special-state-mark"
          kind="logo"
          decorative
          sizes="72px"
        />
        <small className="special-state-code">{copy.code}</small>
        <h1>{heading}</h1>
        <p>{text}</p>
        <div className="special-state-actions">
          {copy.primary && (
            <button type="button" className="primary" onClick={primary}>
              {copy.primary}
            </button>
          )}
          {copy.secondary && (
            <button type="button" className="secondary" onClick={secondary}>
              {copy.secondary}
            </button>
          )}
        </div>
        {copy.hint && (
          <button
            type="button"
            className="special-state-hint"
            onClick={onHint || runRetry}
          >
            {copy.hint}
          </button>
        )}
      </section>
    </main>
  );
}

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Keep the stack out of the UI. Logging stays in the browser console.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <SpecialState
        kind="unexpected"
        onRetry={() => this.setState({ failed: false })}
        onHome={() => {
          this.setState({ failed: false });
          goToCentral();
        }}
      />
    );
  }
}
