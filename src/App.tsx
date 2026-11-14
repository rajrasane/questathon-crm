import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { money, type Statement, type WorkspaceResponse } from "./model";
import { StatementView } from "./StatementView";
import { Deals } from "./Deals";
import { AccountDetails } from "./AccountUpdates";

type View = "overview" | "deals" | "people" | "evidence";
const views: View[] = ["overview", "deals", "people", "evidence"];
const labels: Record<View, string> = {
  overview: "Overview",
  deals: "Deals",
  people: "People",
  evidence: "Evidence",
};
const roleNames = {
  decides: "Decision",
  pays: "Budget",
  uses: "Operations",
  blocks: "Dependencies",
};
const dateLabel = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const stamp = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
export function App() {
  const [response, setResponse] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [allAccounts, setAllAccounts] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [activeSource, setActiveSource] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const r = await fetch("/api/workspace", { signal: controller.signal });
        if (!r.ok) throw Error();
        const data: WorkspaceResponse = await r.json();
        if (!controller.signal.aborted) setResponse(data);
      } catch {
        if (!controller.signal.aborted)
          setResponse((previous) => ({
            ...previous,
            state: "error",
            snapshot: previous?.snapshot || null,
            message:
              "Could not refresh the workspace. Showing the last loaded records, if available.",
            loadedAt: previous?.loadedAt || null,
          }));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void load(), 15_000);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [retry]);
  useEffect(() => {
    if (sourceIds.length) dialog.current?.showModal();
    else dialog.current?.close();
  }, [sourceIds]);
  const accounts = response?.snapshot?.accounts || [];
  const account = accounts.find((a) => a.key === selected) || accounts[0];
  const sources = response?.snapshot?.sources;
  const sourceMap = useMemo(
    () => new Map((sources || []).map((s) => [s.id, s])),
    [sources],
  );
  const accountSources = (sources || []).filter(
    (s) => !s.account || s.account === account?.key,
  );
  const filteredSources = (allAccounts ? sources || [] : accountSources).filter(
    (s) =>
      `${s.title} ${s.excerpt} ${s.locator}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const source = sourceMap.get(activeSource);
  function openSources(ids: string[]) {
    const found = [...new Set(ids)].filter((id) => sourceMap.has(id));
    if (found.length) {
      setSourceIds(found);
      setActiveSource(found[0]);
    }
  }
  function citations(ids: string[]) {
    const count = new Set(ids).size;
    return count ? (
      <button
        type="button"
        className="source-link"
        onClick={() => openSources(ids)}
        aria-label={`Open ${count} ${count === 1 ? "source" : "sources"}`}
      >
        Evidence <span>{count}</span>
      </button>
    ) : null;
  }
  function statement(s: Statement) {
    return <StatementView value={s} citations={citations} />;
  }
  function selectAccount(key: string) {
    setSelected(key);
    setView("overview");
    setQuery("");
    setAllAccounts(false);
  }
  const status =
    loading && !response
      ? "Loading"
      : (
          {
            unconfigured: "Awaiting records",
            ready: "Evidence loaded",
            partial: "Evidence gaps",
            stale: "Review freshness",
            error: "Refresh unavailable",
          } as const
        )[response?.state || "unconfigured"];
  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        Skip to account
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Account Brief home">
          <span className="brand-mark">ab</span>
          <span>
            Account Brief<small>Questathon workspace</small>
          </span>
        </a>
        <div className="nav-caption">
          Accounts <span>{accounts.length}</span>
        </div>
        <nav aria-label="Accounts">
          {accounts.map((a) => (
            <button
              key={a.key}
              className={`account-button ${account?.key === a.key ? "active" : ""}`}
              aria-current={account?.key === a.key ? "page" : undefined}
              onClick={() => selectAccount(a.key)}
            >
              <span className="account-mark" aria-hidden="true">
                {a.name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </span>
              <span>
                {a.name}
                <small>{a.deals?.length ?? "—"} opportunities</small>
              </span>
            </button>
          ))}
          {!accounts.length && (
            <p className="sidebar-empty">
              Accounts appear after the first fetch.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="connection-dot" />{" "}
          {response?.ingestion?.mode === "live"
            ? "Signal checks enabled"
            : "Cached workspace"}
          <small>Evidence-led account decisions</small>
        </div>
      </aside>
      <main id="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="crumb">/ {labels[view]}</span>
          </span>
          <div className="topbar-actions">
            <span
              className={`status state-${response?.state || "unconfigured"}`}
            >
              {status}
            </span>
            <button
              className="button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setRetry((v) => v + 1);
              }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>{account?.name || "Your account workspace"}</h1>
              <p>
                {account
                  ? "A clear view of the next decision."
                  : "Connect the source records to begin."}
              </p>
            </div>
            <details className="sync-details">
              <summary>Data status</summary>
              <div className="sync-popover">
                <strong>{response?.message || "Reading the workspace."}</strong>
                <dl>
                  <dt>Cache updated</dt>
                  <dd>{stamp(response?.snapshot?.generatedAt)}</dd>
                  <dt>Scenario date</dt>
                  <dd>
                    {response?.snapshot?.scenarioAsOf
                      ? dateLabel(response.snapshot.scenarioAsOf)
                      : "Not supplied"}
                  </dd>
                  <dt>Last successful signal check</dt>
                  <dd>{stamp(response?.ingestion?.lastCheckedAt)}</dd>
                  <dt>Mode</dt>
                  <dd>
                    {response?.ingestion?.mode === "live"
                      ? "Server polling configured"
                      : "Cached records; live ingestion disabled"}
                  </dd>
                </dl>
                <p>Refresh reads the cache. It does not make an MCP request.</p>
              </div>
            </details>
          </div>
          {(response?.state === "error" ||
            response?.state === "stale" ||
            response?.ingestion?.error) && (
            <div className="notice" role="status">
              {response?.ingestion?.error || response?.message}
            </div>
          )}
          {!account ? (
            <section className="empty-state">
              <span className="empty-mark">ab</span>
              <h2>
                {loading
                  ? "Loading your workspace"
                  : "Waiting for account records"}
              </h2>
              <p>{response?.message || "Reading the server cache."}</p>
              <p>
                Configure the token on the selected server and keep it running.
                Fetched accounts will appear here automatically.
              </p>
            </section>
          ) : (
            <>
              <div className="tabs" role="tablist" aria-label="Account views">
                {views.map((tab, i) => (
                  <button
                    key={tab}
                    role="tab"
                    id={`tab-${tab}`}
                    aria-selected={view === tab}
                    aria-controls={`panel-${tab}`}
                    tabIndex={view === tab ? 0 : -1}
                    onClick={() => setView(tab)}
                    onKeyDown={(e) => {
                      const next =
                        e.key === "ArrowRight"
                          ? (i + 1) % views.length
                          : e.key === "ArrowLeft"
                            ? (i + views.length - 1) % views.length
                            : e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? views.length - 1
                                : -1;
                      if (next >= 0) {
                        e.preventDefault();
                        setView(views[next]);
                        document.getElementById(`tab-${views[next]}`)?.focus();
                      }
                    }}
                  >
                    {labels[tab]}
                    {tab === "deals" && account.deals && (
                      <span>{account.deals.length}</span>
                    )}
                    {tab === "people" && (
                      <span>{account.contacts?.length || 0}</span>
                    )}
                    {tab === "evidence" && <span>{accountSources.length}</span>}
                  </button>
                ))}
              </div>
              <div
                key={`${account.key}:${view}`}
                role="tabpanel"
                id={`panel-${view}`}
                aria-labelledby={`tab-${view}`}
                tabIndex={0}
              >
                {view === "overview" && (
                  <>
                    <div className="metrics">
                      <Metric
                        label="Existing annual contract"
                        value={
                          account.existingContract
                            ? money(account.existingContract)
                            : "Unknown"
                        }
                        detail="Existing business, separate from new deals"
                        evidence={citations(
                          account.existingContract?.sourceIds || [],
                        )}
                      />
                      <Metric
                        label="Opportunity value"
                        value={money(account.dealValue)}
                        detail={account.stage.text}
                        evidence={citations([
                          ...account.dealValue.sourceIds,
                          ...account.stage.sourceIds,
                        ])}
                      />
                      <Metric
                        label="New booked value"
                        value={money(account.bookValue)}
                        detail="Unknown amounts are not zero"
                        evidence={citations(account.bookValue.sourceIds)}
                      />
                    </div>
                    <div className="overview-grid">
                      <section className="priorities">
                        <SectionTitle title="Next actions" aside="Proposed" />
                        <p className="section-note">
                          Ranked by the current evidence. Owners and dates are
                          proposals.
                        </p>
                        <div className="action-list">
                          {account.actions.length ? (
                            account.actions.map((action, i) => (
                              <details
                                className="action"
                                key={`${action.title}:${i}`}
                              >
                                <summary>
                                  <span className="rank">{i + 1}</span>
                                  <span className="action-summary">
                                    <strong>{action.title}</strong>
                                    <span className="action-meta">
                                      <span>
                                        {action.owner || "Owner to agree"}
                                      </span>
                                      <span>
                                        {action.date
                                          ? dateLabel(action.date)
                                          : "Date to agree"}
                                      </span>
                                    </span>
                                  </span>
                                  <span
                                    className="expand-icon"
                                    aria-hidden="true"
                                  >
                                    +
                                  </span>
                                </summary>
                                <div className="action-body">
                                  <h3>Why this action</h3>
                                  <p>{action.reason}</p>
                                  <h3>Intended outcome</h3>
                                  <p>{action.outcome}</p>
                                  {citations(action.sourceIds)}
                                </div>
                              </details>
                            ))
                          ) : (
                            <p className="muted">
                              No proposed actions are available yet.
                            </p>
                          )}
                        </div>
                        <details className="disclosure situation">
                          <summary>
                            Read the account assessment{" "}
                            <span className="expand-icon" aria-hidden="true">
                              +
                            </span>
                          </summary>
                          <div className="disclosure-body">
                            {statement(account.summary)}
                          </div>
                        </details>
                      </section>
                      <section className="updates">
                        <SectionTitle
                          title="Latest changes"
                          aside={`${account.signals?.length || 0} signals`}
                        />
                        {account.signals?.length ? (
                          <div className="timeline">
                            {[...account.signals]
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((s) => (
                                <details className="signal" key={s.id}>
                                  <summary>
                                    <time dateTime={s.date}>
                                      {dateLabel(s.date)}
                                    </time>
                                    <strong>{s.title}</strong>
                                    <span className="read-label">
                                      View report
                                    </span>
                                  </summary>
                                  <div className="signal-body">
                                    {statement(s.summary)}
                                  </div>
                                </details>
                              ))}
                          </div>
                        ) : (
                          <p className="muted">
                            No signals are recorded. That does not establish
                            that nothing has changed.
                          </p>
                        )}
                      </section>
                    </div>
                    <section className="review-section">
                      <SectionTitle
                        title="Before the next conversation"
                        aside="Check the gaps"
                      />
                      <details className="disclosure">
                        <summary>
                          <span>
                            Risks & deadlines{" "}
                            <span className="count">
                              {account.risks.length}
                            </span>
                          </span>
                          <span className="expand-icon" aria-hidden="true">
                            +
                          </span>
                        </summary>
                        <div className="disclosure-body">
                          {account.risks.length ? (
                            account.risks.map((r, i) => (
                              <div className="list-item" key={i}>
                                {statement(r.statement)}
                                <p className="deadline">
                                  Deadline: {r.deadline || "Not confirmed"}
                                </p>
                                {citations(r.deadlineSourceIds)}
                              </div>
                            ))
                          ) : (
                            <p>
                              No sourced risks recorded. Confirm constraints
                              with the customer.
                            </p>
                          )}
                        </div>
                      </details>
                      <details className="disclosure">
                        <summary>
                          <span>
                            Open questions{" "}
                            <span className="count">
                              {account.unknowns.length}
                            </span>
                          </span>
                          <span className="expand-icon" aria-hidden="true">
                            +
                          </span>
                        </summary>
                        <div className="disclosure-body">
                          {account.unknowns.map((u, i) => (
                            <div className="list-item" key={i}>
                              <h3>{u.question}</h3>
                              <p>{u.resolveBy}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                      <details
                        className={`disclosure ${account.contradictions.length ? "has-conflict" : ""}`}
                      >
                        <summary>
                          <span>
                            Conflicting evidence{" "}
                            <span className="count">
                              {account.contradictions.length}
                            </span>
                          </span>
                          <span className="expand-icon" aria-hidden="true">
                            +
                          </span>
                        </summary>
                        <div className="disclosure-body">
                          {account.contradictions.length ? (
                            account.contradictions.map((c, i) => (
                              <article key={i} className="contradiction">
                                <h3>{c.topic}</h3>
                                <div className="comparison">
                                  <div>{statement(c.left)}</div>
                                  <div>{statement(c.right)}</div>
                                </div>
                                <p>
                                  <strong>Resolve:</strong> {c.resolution}
                                </p>
                              </article>
                            ))
                          ) : (
                            <p>
                              No contradictions identified by the current
                              analysis. This does not prove all sources agree.
                            </p>
                          )}
                        </div>
                      </details>
                      <details className="disclosure">
                        <summary>
                          <span>
                            Operational usage{" "}
                            <span className="count">
                              {account.usageInsights?.length || 0}
                            </span>
                          </span>
                          <span className="expand-icon" aria-hidden="true">
                            +
                          </span>
                        </summary>
                        <div className="disclosure-body">
                          {account.usageInsights?.length ? (
                            account.usageInsights.map((s, i) => (
                              <div className="list-item" key={i}>
                                {statement(s)}
                              </div>
                            ))
                          ) : (
                            <p>No validated usage analysis is available.</p>
                          )}
                        </div>
                      </details>
                    </section>
                  </>
                )}
                {view === "deals" && (
                  <>
                    <Deals
                      deals={account.deals}
                      citations={citations}
                      statement={statement}
                    />
                    <AccountDetails
                      account={account}
                      citations={citations}
                      statement={statement}
                      section="offers"
                    />
                  </>
                )}
                {view === "people" && (
                  <section>
                    <SectionTitle
                      title="Who shapes the decision"
                      aside="Authority & alignment"
                    />
                    <p className="section-note">
                      Recorded roles and relationships do not establish buying
                      authority. Open each assessment for the evidence and
                      current uncertainties.
                    </p>
                    <div className="people-grid">
                      {(["decides", "pays", "uses", "blocks"] as const).map(
                        (role) => (
                          <section className="role" key={role}>
                            <h3 className="role-name">
                              {roleNames[role]}
                              <span>{role}</span>
                            </h3>
                            {account.stakeholders
                              .filter((s) => s.role === role)
                              .map((person, i) => (
                                <details className="person" key={i}>
                                  <summary>
                                    <strong>{person.name}</strong>
                                    <span className="read-label">
                                      {person.stance.kind === "unknown"
                                        ? "Not established"
                                        : "Read assessment"}
                                    </span>
                                  </summary>
                                  <div className="disclosure-body">
                                    {citations(person.nameSourceIds)}
                                    {statement(person.stance)}
                                  </div>
                                </details>
                              ))}
                            {!account.stakeholders.some(
                              (s) => s.role === role,
                            ) && (
                              <p className="muted">
                                Not established. Confirm the person and their
                                authority.
                              </p>
                            )}
                          </section>
                        ),
                      )}
                    </div>
                    <AccountDetails
                      account={account}
                      citations={citations}
                      statement={statement}
                      section="contacts"
                    />
                  </section>
                )}
                {view === "evidence" && (
                  <section className="evidence-panel">
                    <SectionTitle
                      title="Evidence library"
                      aside={`${filteredSources.length} records`}
                    />
                    <div className="search-tools">
                      <label className="search-label">
                        <span className="sr-only">Search evidence</span>
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search records, claims or documents…"
                          type="search"
                        />
                      </label>
                      <label className="scope-toggle">
                        <input
                          type="checkbox"
                          checked={allAccounts}
                          onChange={(e) => setAllAccounts(e.target.checked)}
                        />{" "}
                        All accounts
                      </label>
                    </div>
                    <div className="evidence-list">
                      {filteredSources.map((s) => (
                        <button
                          className="evidence-row"
                          key={s.id}
                          onClick={() => openSources([s.id])}
                        >
                          <span className="document-icon" aria-hidden="true">
                            ▤
                          </span>
                          <span>
                            <strong>{s.title}</strong>
                            <small>
                              {s.origin || "Source record"}
                              {s.eventDate
                                ? ` / ${dateLabel(s.eventDate)}`
                                : ""}
                            </small>
                          </span>
                          <span className="read-label">Open</span>
                        </button>
                      ))}
                      {!filteredSources.length && (
                        <p className="empty-results">
                          No matching evidence. Try another search or include
                          all accounts.
                        </p>
                      )}
                    </div>
                    <AccountDetails
                      account={account}
                      citations={citations}
                      statement={statement}
                      section="facts"
                    />
                  </section>
                )}
              </div>
            </>
          )}
          <footer>
            <span>Account Brief</span>
            <span>
              {response?.snapshot?.scenarioAsOf
                ? `Scenario as of ${dateLabel(response.snapshot.scenarioAsOf)}`
                : "Awaiting source records"}
            </span>
          </footer>
        </div>
      </main>
      <dialog
        ref={dialog}
        className="source-drawer"
        aria-labelledby="source-heading"
        onCancel={() => setSourceIds([])}
        onClose={() => setSourceIds([])}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSourceIds([]);
        }}
      >
        <div className="drawer-header">
          <span>Source evidence</span>
          <button
            className="button"
            onClick={() => setSourceIds([])}
            aria-label="Close evidence"
          >
            Close ×
          </button>
        </div>
        {source && (
          <>
            <h2 id="source-heading">{source.title}</h2>
            {sourceIds.length > 1 && (
              <nav className="source-picker" aria-label="Related evidence">
                {sourceIds.map((id) => (
                  <button
                    key={id}
                    className={id === activeSource ? "selected" : ""}
                    aria-pressed={id === activeSource}
                    onClick={() => setActiveSource(id)}
                  >
                    {sourceMap.get(id)?.title || id}
                  </button>
                ))}
              </nav>
            )}
            <span className="label">{source.origin || "Record"}</span>
            <blockquote>{source.excerpt}</blockquote>
            <details className="disclosure">
              <summary>
                Record details <span aria-hidden="true">+</span>
              </summary>
              <dl className="disclosure-body">
                <dt>Locator</dt>
                <dd>{source.locator}</dd>
                <dt>Source ID</dt>
                <dd>{source.id}</dd>
                <dt>Retrieved</dt>
                <dd>
                  {source.retrievedAt
                    ? stamp(source.retrievedAt)
                    : "Original retrieval time not supplied"}
                </dd>
                <dt>Cache import</dt>
                <dd>{stamp(source.importedAt)}</dd>
                <dt>Scenario date</dt>
                <dd>{source.eventDate || "See original record"}</dd>
              </dl>
            </details>
          </>
        )}
      </dialog>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  evidence,
}: {
  label: string;
  value: string;
  detail: string;
  evidence: ReactNode;
}) {
  return (
    <section className="metric">
      <h2>{label}</h2>
      <strong className="metric-value">{value}</strong>
      <p>{detail}</p>
      {evidence}
    </section>
  );
}
function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {aside && <span>{aside}</span>}
    </div>
  );
}
