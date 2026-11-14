import type { ReactNode } from "react";
import { money, type Account, type Statement } from "./model";
export function AccountDetails({
  account,
  citations,
  statement,
  section,
}: {
  section: "offers" | "facts" | "contacts";
  account: Account;
  citations: (ids: string[]) => ReactNode;
  statement: (s: Statement) => ReactNode;
}) {
  return (
    <>
      {section === "offers" && !!account.offers?.length && (
        <section className="panel update-panel">
          <div className="section-heading">
            <div>
              <h2>Account offers</h2>
            </div>
          </div>
          <p className="muted">
            The export does not link these offers to individual deals. No value
            is counted as booked revenue, and missing currency remains unknown.
          </p>
          {account.offers.map((o, i) => (
            <div className="offer-row" key={i}>
              <div>
                <h3>{o.title}</h3>
                {citations(o.sourceIds)}
              </div>
              <div>
                <span className={`label offer-${o.status}`}>{o.status}</span>
                {citations(o.statusSourceIds)}
              </div>
              <div>
                {money(o.value)}
                {citations(o.value.sourceIds)}
              </div>
            </div>
          ))}
        </section>
      )}
      {section === "facts" && !!account.facts?.length && (
        <details className="panel update-panel">
          <summary>
            Discovery evidence · {account.facts.length} statements
          </summary>
          <p className="muted">
            These are statements discovered during the game. Their original
            claim, told or verified status is preserved.
          </p>
          {account.facts.map((s, i) => (
            <div className="list-item" key={i}>
              {statement(s)}
            </div>
          ))}
        </details>
      )}
      {section === "contacts" && !!account.contacts?.length && (
        <details className="panel update-panel">
          <summary>Known contacts · {account.contacts.length}</summary>
          <p className="muted">
            A relationship or title alone does not establish purchasing
            authority.
          </p>
          {account.contacts.map((p) => (
            <div className="list-item" key={p.id}>
              <h3>{p.name}</h3>
              <p className="muted">
                {p.role} · Discovery relationship: {p.relationship}
              </p>
              {citations(p.sourceIds)}
            </div>
          ))}
        </details>
      )}
    </>
  );
}
