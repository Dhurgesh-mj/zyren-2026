"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { analyticsAPI } from "@/lib/api";

interface EventAnalytic {
  id: number;
  title: string;
  date: string;
  category: string;
  capacity: number;
  registered: number;
  attended: number;
  waitlisted: number;
  attendance_rate: number;
  fill_rate: number;
  status: string;
}

interface Overview {
  total_events: number;
  total_users: number;
  total_registrations: number;
  total_attendance: number;
  events_by_status: Record<string, number>;
  events_by_category: Record<string, number>;
  recent_audit_logs: Array<{
    id: number;
    user_id: number;
    action: string;
    details: string;
    ip_address: string;
    timestamp: string;
  }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [eventStats, setEventStats] = useState<EventAnalytic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (!isLoading && user && !["organizer", "dept_admin", "college_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      const [ov, ev] = await Promise.all([
        analyticsAPI.overview(),
        analyticsAPI.events(),
      ]);
      setOverview(ov);
      setEventStats(ev);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user || loading) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading analytics...</p></div>;
  }

  const maxRegistered = Math.max(...eventStats.map(e => e.registered), 1);

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1>📈 Analytics Dashboard</h1>
          <p>Event performance metrics and security audit logs</p>
        </div>

        {/* Overview Stats */}
        {overview && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue">🎯</div>
              <div className="stat-value">{overview.total_events}</div>
              <div className="stat-label">Total Events</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">👥</div>
              <div className="stat-value">{overview.total_users}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">🎫</div>
              <div className="stat-value">{overview.total_registrations}</div>
              <div className="stat-label">Registrations</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">✅</div>
              <div className="stat-value">{overview.total_attendance}</div>
              <div className="stat-label">Check-ins</div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          {/* Events by Status */}
          {overview && (
            <div className="chart-container">
              <div className="chart-header"><h3>Events by Status</h3></div>
              <div className="bar-chart">
                {Object.entries(overview.events_by_status).map(([status, count]) => (
                  <div className="bar-item" key={status}>
                    <div className="bar-label">{status}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${Math.max((count / Math.max(...Object.values(overview.events_by_status), 1)) * 100, 15)}%`
                      }}>
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events by Category */}
          {overview && (
            <div className="chart-container">
              <div className="chart-header"><h3>Events by Category</h3></div>
              <div className="bar-chart">
                {Object.entries(overview.events_by_category).map(([cat, count]) => (
                  <div className="bar-item" key={cat}>
                    <div className="bar-label">{cat}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${Math.max((count / Math.max(...Object.values(overview.events_by_category), 1)) * 100, 15)}%`,
                        background: cat === "Technical" ? "linear-gradient(90deg, #3b82f6, #60a5fa)"
                          : cat === "Cultural" ? "linear-gradient(90deg, #ec4899, #f472b6)"
                          : cat === "Sports" ? "linear-gradient(90deg, #10b981, #34d399)"
                          : "linear-gradient(90deg, #8b5cf6, #a78bfa)"
                      }}>
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Event Performance Table */}
        {eventStats.length > 0 && (
          <div className="table-container" style={{ marginBottom: 24 }}>
            <div className="table-header">
              <h3>Event Performance</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Category</th>
                  <th>Capacity</th>
                  <th>Registered</th>
                  <th>Attended</th>
                  <th>Fill Rate</th>
                  <th>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {eventStats.map(ev => (
                  <tr key={ev.id} onClick={() => router.push(`/events/${ev.id}`)} style={{ cursor: "pointer" }}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{ev.title}</td>
                    <td><span className={`badge badge-${ev.category.toLowerCase()}`}>{ev.category}</span></td>
                    <td>{ev.capacity}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 60, height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden"
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 3,
                            background: "var(--accent)",
                            width: `${(ev.registered / maxRegistered) * 100}%`
                          }}></div>
                        </div>
                        {ev.registered}
                      </div>
                    </td>
                    <td>{ev.attended}</td>
                    <td>
                      <span style={{ color: ev.fill_rate > 80 ? "var(--success)" : "var(--text-secondary)" }}>
                        {ev.fill_rate}%
                      </span>
                    </td>
                    <td>
                      <span style={{ color: ev.attendance_rate > 70 ? "var(--success)" : ev.attendance_rate > 40 ? "var(--warning)" : "var(--danger)" }}>
                        {ev.attendance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Logs */}
        {overview && overview.recent_audit_logs.length > 0 && (
          <div className="table-container">
            <div className="table-header">
              <h3>🔒 Recent Audit Logs</h3>
              <span className="badge badge-published">Security Monitoring</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {overview.recent_audit_logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge ${log.action.includes("FAILED") ? "badge-cancelled" : "badge-confirmed"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.details}
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                      {log.ip_address || "—"}
                    </td>
                    <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
