import type { ReactNode } from "react";
import { money, type Deal, type Statement } from "./model";
export function Deals({
  deals,
  citations,
  statement,
}: {
  deals: Deal[] | null;
  citations: (ids: string[]) => ReactNode;
  statement: (value: Statement) => ReactNode;
}) {
  return (
    <section className="deals">
      <div className="section-heading">
        <h2>Opportunities</h2>
        <span>Each deal, separately</span>
      </div>
      <p className="section-note">
        Opportunity value is potential. Won offers do not automatically become
        booked value.
      </p>
      {deals === null ? (
        <p className="empty-results">
          Deal records are pending. Values and counts are not established.
        </p>
      ) : deals.length === 0 ? (
        <p className="empty-results">
          No deals are listed. This does not establish zero revenue.
        </p>
      ) : (
        deals.map((deal) => (
          <details className="deal-card" key={deal.key}>
            <summary>
              <span>
                <strong>{deal.title}</strong>
                <span className="deal-stage">{deal.stage.text}</span>
              </span>
              <span className="deal-amount">
                <small>Worth up to</small>
                {money(deal.worthUpTo)}
              </span>
              <span className="expand-icon" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="disclosure-body">
              {citations(deal.sourceIds)}
              <div className="deal-details">
                <div>
                  <h3>Stage</h3>
                  {statement(deal.stage)}
                </div>
                <div>
                  <h3>Blockers</h3>
                  {deal.blockers ? (
                    statement(deal.blockers)
                  ) : (
                    <p>Unknown — confirm blockers.</p>
                  )}
                </div>
                <div>
                  <h3>Deadline</h3>
                  <p>{deal.deadline || "Unknown — confirm timing."}</p>
                  {citations(deal.deadlineSourceIds)}
                </div>
                <div>
                  <h3>Value basis</h3>
                  <p>{deal.worthUpTo.basis}</p>
                  {citations(deal.worthUpTo.sourceIds)}
                </div>
              </div>
              <h3>Linked offers</h3>
              {deal.offers === null ? (
                <p className="muted">
                  No offer-to-deal link is supplied. See account-level offers
                  below.
                </p>
              ) : deal.offers.length === 0 ? (
                <p className="muted">No offers listed for this deal.</p>
              ) : (
                deal.offers.map((offer, index) => (
                  <div className="offer-row" key={index}>
                    <div>
                      <strong>{offer.title}</strong>
                      {citations(offer.sourceIds)}
                    </div>
                    <div>
                      <span className={`label offer-${offer.status}`}>
                        {offer.status}
                      </span>
                      {citations(offer.statusSourceIds)}
                    </div>
                    <div>
                      {money(offer.value)}
                      {citations(offer.value.sourceIds)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        ))
      )}
    </section>
  );
}
