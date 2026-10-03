import React from "react";

/**
 * One page heading for every route: title, one line of context, and the page's
 * actions. The route name already lives in the topbar breadcrumb, so there is no
 * eyebrow label above the title.
 */
export function PageHeader({ title, description, actions = null, aside = null, className = "" }) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header-text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {(aside || actions) && <div className="page-header-side">{aside}{actions}</div>}
    </header>
  );
}
