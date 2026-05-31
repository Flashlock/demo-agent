import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PantheonBootstrap {
  instanceId: string;
  hubBaseUrl?: string;
  hubPort: number;
  proxyBasePath?: string;
  mfeSession?: string;
  spokeToken?: string;
  hitl?: {
    focusedBreakpointId?: string | null;
    queueLength?: number;
  };
}

interface AgentStatus {
  instanceId: string;
  greeting: string;
  tasksProcessed: number;
  queuePressure: number;
  port: number;
}

interface HitlBreakpoint {
  breakpointId: string;
  instanceId: string;
  urgency: string;
  headline: string;
  summary: string;
  payloadContext: Record<string, unknown>;
  interactiveFormSchema: {
    fields?: Array<{
      id: string;
      type: string;
      label: string;
      options?: string[];
      default?: string;
    }>;
  };
  status: string;
}

interface HitlQueueResponse {
  currentBreakpointId?: string | null;
  queueLength: number;
  items: HitlBreakpoint[];
}

declare global {
  interface Window {
    __PANTHEON__?: PantheonBootstrap;
  }
}

function readBootstrap(): PantheonBootstrap | null {
  const bootstrap = window.__PANTHEON__;
  if (!bootstrap?.instanceId || !bootstrap?.hubPort) {
    return null;
  }
  if (!bootstrap.mfeSession && !bootstrap.spokeToken) {
    return null;
  }
  return bootstrap;
}

function fieldDefault(field: NonNullable<HitlBreakpoint["interactiveFormSchema"]["fields"]>[number]) {
  return field.default ?? field.options?.[0] ?? "";
}

function statusEqual(a: AgentStatus | null, b: AgentStatus | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.instanceId === b.instanceId &&
    a.greeting === b.greeting &&
    a.tasksProcessed === b.tasksProcessed &&
    a.queuePressure === b.queuePressure &&
    a.port === b.port
  );
}

function hitlQueueEqual(a: HitlQueueResponse | null, b: HitlQueueResponse | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.queueLength === b.queueLength &&
    a.currentBreakpointId === b.currentBreakpointId &&
    JSON.stringify(a.items) === JSON.stringify(b.items)
  );
}

export default function App() {
  const bootstrap = useMemo(() => readBootstrap(), []);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [hitlQueue, setHitlQueue] = useState<HitlQueueResponse | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(
    () => bootstrap?.hitl?.focusedBreakpointId ?? null,
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState(false);

  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;

  const hubBase = useMemo(() => {
    if (!bootstrap) return "";
    return bootstrap.hubBaseUrl ?? `http://127.0.0.1:${bootstrap.hubPort}`;
  }, [bootstrap]);

  const proxyBase = useMemo(() => {
    if (!bootstrap || !hubBase) return "";
    if (bootstrap.proxyBasePath) {
      return `${hubBase.replace(/\/$/, "")}${bootstrap.proxyBasePath}`;
    }
    return `${hubBase}/api/v1/instances/${encodeURIComponent(bootstrap.instanceId)}`;
  }, [bootstrap, hubBase]);

  const hitlBase = useMemo(() => {
    if (!bootstrap || !hubBase) return "";
    if (bootstrap.spokeToken) {
      return `${hubBase}/api/v1/spoke/instances/${encodeURIComponent(bootstrap.instanceId)}/hitl`;
    }
    return `${hubBase}/api/v1/instances/${encodeURIComponent(bootstrap.instanceId)}/hitl`;
  }, [bootstrap, hubBase]);

  const authHeaders = useMemo((): Record<string, string> | undefined => {
    if (!bootstrap) return undefined;
    if (bootstrap.mfeSession) {
      return { "X-Pantheon-Mfe-Session": bootstrap.mfeSession };
    }
    if (bootstrap.spokeToken) {
      return {
        Authorization: `Bearer ${bootstrap.spokeToken}`,
        "X-Pantheon-Spoke-Token": bootstrap.spokeToken,
      };
    }
    return undefined;
  }, [bootstrap]);

  const currentHitl = useMemo(() => {
    if (!hitlQueue?.items.length) return null;
    const targetId = focusedId ?? hitlQueue.currentBreakpointId ?? hitlQueue.items[0]?.breakpointId;
    return hitlQueue.items.find((item) => item.breakpointId === targetId) ?? hitlQueue.items[0];
  }, [focusedId, hitlQueue]);

  useEffect(() => {
    if (!currentHitl?.interactiveFormSchema.fields) {
      setFormValues({});
      return;
    }
    const next: Record<string, string> = {};
    for (const field of currentHitl.interactiveFormSchema.fields) {
      next[field.id] = fieldDefault(field);
    }
    setFormValues(next);
  }, [currentHitl?.breakpointId]);

  const refreshHitl = useCallback(async () => {
    if (!bootstrap || !hitlBase || !authHeaders) return;
    const focusQuery = focusedIdRef.current
      ? `?focus=${encodeURIComponent(focusedIdRef.current)}`
      : "";
    const path = bootstrap.spokeToken
      ? `${hitlBase}/active${focusQuery}`
      : `${hitlBase}/active${focusQuery}`;
    const res = await fetch(path, { headers: authHeaders });
    if (!res.ok) return;
    const data = (await res.json()) as HitlQueueResponse | { requests?: HitlBreakpoint[] };
    const normalized: HitlQueueResponse = "requests" in data && data.requests
      ? {
          queueLength: data.requests.length,
          currentBreakpointId: data.requests[0]?.breakpointId ?? null,
          items: data.requests,
        }
      : (data as HitlQueueResponse);
    setHitlQueue((prev) => (hitlQueueEqual(prev, normalized) ? prev : normalized));
    if (normalized.currentBreakpointId && normalized.currentBreakpointId !== focusedIdRef.current) {
      setFocusedId(normalized.currentBreakpointId);
    } else if (!normalized.items.length) {
      setFocusedId(null);
    }
  }, [bootstrap, hitlBase, authHeaders]);

  const refreshStatus = useCallback(async () => {
    if (!bootstrap || !proxyBase || !authHeaders) {
      setError("Pantheon bootstrap missing — reopen this app from Pantheon.");
      return false;
    }
    const res = await fetch(`${proxyBase}/api/v1/status`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = (await res.json()) as AgentStatus;
    setStatus((prev) => (statusEqual(prev, next) ? prev : next));
    return true;
  }, [bootstrap, proxyBase, authHeaders]);

  const refresh = useCallback(
    async (manual = false) => {
      if (!bootstrap || !proxyBase || !authHeaders) {
        setError("Pantheon bootstrap missing — reopen this app from Pantheon.");
        return;
      }
      if (manual) setRefreshing(true);
      setError(null);
      try {
        await refreshStatus();
        await refreshHitl();
      } catch (e) {
        setError(String(e));
        setStatus(null);
      } finally {
        if (manual) setRefreshing(false);
        setInitialLoading(false);
      }
    },
    [bootstrap, proxyBase, authHeaders, refreshStatus, refreshHitl],
  );

  const resolveCurrentHitl = async () => {
    if (!bootstrap || !hitlBase || !authHeaders || !currentHitl) return;
    setResolving(true);
    setError(null);
    try {
      const res = await fetch(
        `${hitlBase}/${encodeURIComponent(currentHitl.breakpointId)}/resolve`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resolution: formValues }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refreshHitl();
    } catch (e) {
      setError(String(e));
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    void refresh(false);
    if (!bootstrap || !hubBase || !authHeaders) return;

    const controller = new AbortController();
    let reconnectDelay = 1000;

    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          const { subscribeHubEventStream } = await import("./hubEventStream");
          await subscribeHubEventStream(
            hubBase,
            authHeaders,
            (event) => {
              const type = event.event ?? "";
              if (
                type === "PANTHEON://CROSS_NETWORK_HITL_ALERT" ||
                type === "PANTHEON://HITL_RESOLVED" ||
                type === "PANTHEON://INSTANCE_STATE_CHANGED" ||
                type === "PANTHEON://TELEMETRY_UPDATED"
              ) {
                void refreshStatus().catch(() => {});
                void refreshHitl();
              }
            },
            controller.signal,
          );
          reconnectDelay = 1000;
        } catch {
          if (controller.signal.aborted) break;
          await new Promise((resolve) => window.setTimeout(resolve, reconnectDelay));
          reconnectDelay = Math.min(reconnectDelay * 2, 15000);
        }
      }
    };

    void connect();
    return () => controller.abort();
  }, [bootstrap, hubBase, authHeaders, refresh, refreshStatus, refreshHitl]);

  const remainingCount = Math.max((hitlQueue?.queueLength ?? 0) - 1, 0);
  const showRefreshSpinner = initialLoading || refreshing;

  return (
    <div style={{ minHeight: "100vh", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {currentHitl && (
        <section
          style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 4,
            border: "1px solid #FF3D00",
            background: "rgba(255, 61, 0, 0.12)",
          }}
        >
          <div style={{ color: "#FF3D00", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
            HUMAN IN THE LOOP · {currentHitl.urgency}
          </div>
          <h2 style={{ margin: "8px 0 4px", fontSize: 20 }}>{currentHitl.headline}</h2>
          <p style={{ margin: "0 0 12px", color: "#d0d0d8" }}>{currentHitl.summary}</p>
          <p style={{ margin: "0 0 16px", color: "#9a9aa3", fontSize: 13 }}>
            Pantheon-managed HITL queue — resolved in this App only. The agent process cannot list or
            resolve these events.
          </p>

          {(currentHitl.interactiveFormSchema.fields ?? []).map((field) => (
            <label
              key={field.id}
              style={{ display: "block", marginBottom: 12, color: "#c8c8d0", fontSize: 14 }}
            >
              {field.label}
              {field.type === "DROPDOWN" ? (
                <select
                  value={formValues[field.id] ?? fieldDefault(field)}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, [field.id]: event.target.value }))
                  }
                  style={inputStyle}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={formValues[field.id] ?? ""}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, [field.id]: event.target.value }))
                  }
                  style={inputStyle}
                />
              )}
            </label>
          ))}

          <button
            onClick={resolveCurrentHitl}
            disabled={resolving}
            style={{ ...buttonStyle, background: "#00E676", color: "#111" }}
          >
            {resolving ? "Submitting…" : "Submit resolution"}
          </button>

          {remainingCount > 0 && (
            <p style={{ margin: "12px 0 0", color: "#9a9aa3", fontSize: 12 }}>
              {remainingCount} more event{remainingCount === 1 ? "" : "s"} queued after this one.
            </p>
          )}
        </section>
      )}

      <header style={{ marginBottom: 24 }}>
        <div style={{ color: "#00E676", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700 }}>
          PANTHEON DEMO
        </div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 28 }}>Demo Agent App</h1>
        <p style={{ margin: 0, color: "#9a9aa3" }}>
          Instance-scoped MFE. HITL events are Pantheon-managed and resolved here in queue order — the
          agent keeps serving other endpoints.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MetricCard label="Tasks processed" value={status?.tasksProcessed ?? "—"} accent />
        <MetricCard
          label="Work queue load"
          value={status ? `${status.queuePressure.toFixed(1)}%` : "—"}
        />
        <MetricCard label="HITL queue (Pantheon)" value={hitlQueue?.queueLength ?? 0} />
        <MetricCard label="Instance ID" value={bootstrap?.instanceId.slice(0, 8) ?? "—"} small />
      </section>

      <p style={{ margin: "0 0 16px", color: "#6f6f78", fontSize: 12 }}>
        Work queue load is an agent-owned demo metric. HITL queue length comes from Pantheon,
        not the agent process.
      </p>

      {status && (
        <p style={{ color: "#c8c8d0" }}>
          {status.greeting} · full instance ID <code>{status.instanceId}</code>
        </p>
      )}

      {error && (
        <p style={{ color: "#FF3D00" }}>
          Could not reach agent via Pantheon proxy. Start the instance and reopen App from Pantheon.{" "}
          {error}
        </p>
      )}

      <button onClick={() => void refresh(true)} disabled={showRefreshSpinner} style={buttonStyle}>
        {showRefreshSpinner ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}

const MetricCard = memo(function MetricCard({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #2a2a30",
        borderRadius: 4,
        padding: 16,
        background: "#1A1A1E",
      }}
    >
      <div style={{ color: "#6f6f78", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: small ? 14 : 24,
          fontWeight: 700,
          color: accent ? "#00E676" : "#fff",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
});

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid #2a2a30",
  background: "#111114",
  color: "#fff",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 4,
  border: "1px solid #00E676",
  background: "transparent",
  color: "#00E676",
  cursor: "pointer",
  fontWeight: 600,
};
