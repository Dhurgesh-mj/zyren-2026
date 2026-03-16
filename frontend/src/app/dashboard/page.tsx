"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { eventsAPI, registrationsAPI, notificationsAPI, analyticsAPI } from "@/lib/api";

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
  venue: string;
  capacity: number;
  category: string;
  status: string;
  registered_count: number;
  organizer_name: string;
}

interface Registration {
  id: number;
  event_id: number;
  status: string;
  event_title: string;
  qr_token: string | null;
  registered_at: string;
}

interface Notification {
  id: number;
  message: string;
  type: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [overview, setOverview] = useState<Record<string, number | unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [eventsData, notifData] = await Promise.all([
        eventsAPI.list(),
        notificationsAPI.list(),
      ]);
      setEvents(eventsData.slice(0, 5));
      setNotifications(notifData.slice(0, 5));

      if (user?.role === "student") {
        const regs = await registrationsAPI.my();
        setRegistrations(regs);
      }

      if (["organizer", "dept_admin", "college_admin"].includes(user?.role || "")) {
        try {
          const ov = await analyticsAPI.overview();
          setOverview(ov);
        } catch {
          // Analytics may fail for some roles
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const isAdmin = ["organizer", "dept_admin", "college_admin"].includes(user.role);
  const unreadCount = notifications.filter(n => n.status === "unread").length;

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1>Welcome back, {user.name} 👋</h1>
          <p>Here&apos;s what&apos;s happening with your events today.</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {isAdmin ? (
            <>
              <div className="stat-card">
                <div className="stat-icon blue">🎯</div>
                <div className="stat-value">{(overview.total_events as number) || events.length}</div>
                <div className="stat-label">Total Events</div>
              </div>
              <div className="stat-card" onClick={() => router.push("/approvals")} style={{ cursor: "pointer" }}>
                <div className="stat-icon orange">⏳</div>
                <div className="stat-value">{events.filter(e => e.status === "pending").length}</div>
                <div className="stat-label">Pending Approval</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">👥</div>
                <div className="stat-value">{(overview.total_registrations as number) || 0}</div>
                <div className="stat-label">Registrations</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">✅</div>
                <div className="stat-value">{(overview.total_attendance as number) || 0}</div>
                <div className="stat-label">Check-ins</div>
              </div>
            </>
          ) : (
            <>
              <div className="stat-card">
                <div className="stat-icon blue">🎫</div>
                <div className="stat-value">{registrations.filter(r => r.status === "confirmed").length}</div>
                <div className="stat-label">My Registrations</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">🎯</div>
                <div className="stat-value">{events.filter(e => e.status === "published").length}</div>
                <div className="stat-label">Available Events</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">⏳</div>
                <div className="stat-value">{registrations.filter(r => r.status === "waitlisted").length}</div>
                <div className="stat-label">Waitlisted</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange">🔔</div>
                <div className="stat-value">{unreadCount}</div>
                <div className="stat-label">Notifications</div>
              </div>
            </>
          )}
        </div>
        {/* Pending Approvals Banner — Admin Only */}
        {["dept_admin", "college_admin"].includes(user.role) && events.filter(e => e.status === "pending").length > 0 && (
          <div className="card" style={{
            marginBottom: 24, borderLeft: "4px solid #f59e0b",
            background: "linear-gradient(135deg, rgba(245,158,11,0.05), rgba(99,102,241,0.03))",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                  ⏳ Events Awaiting Your Approval
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {events.filter(e => e.status === "pending").length} event(s) need your review
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => router.push("/approvals")}>
                Review All →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {events.filter(e => e.status === "pending").slice(0, 3).map(event => (
                <div key={event.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", borderRadius: 10, background: "var(--bg-input)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      📅 {event.date} &middot; 📍 {event.venue} &middot; 👤 {event.organizer_name}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12, padding: "4px 12px" }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await eventsAPI.approve(event.id);
                          loadData();
                        } catch { /* ignore */ }
                      }}
                    >
                      ✅ Approve
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => router.push(`/events/${event.id}`)}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <div className="table-container">
            <div className="table-header">
              <h3>Recent Events</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push("/events")}>
                View All →
              </button>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎯</div>
                <h3>No events yet</h3>
                <p>Events will appear here once created.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} onClick={() => router.push(`/events/${event.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{event.title}</td>
                      <td>{event.date}</td>
                      <td><span className={`badge badge-${event.status}`}>{event.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Notifications */}
          <div className="table-container">
            <div className="table-header">
              <h3>🔔 Notifications {unreadCount > 0 && <span className="badge badge-published" style={{ marginLeft: 8 }}>{unreadCount} new</span>}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push("/notifications")}>
                View All →
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔕</div>
                <h3>No notifications</h3>
                <p>You&apos;re all caught up!</p>
              </div>
            ) : (
              <div>
                {notifications.map((notif) => (
                  <div key={notif.id} className={`notification-item ${notif.status === "unread" ? "unread" : ""}`}>
                    <div className={`notification-dot ${notif.status === "read" ? "read" : ""}`}></div>
                    <div className="notification-content">
                      <p>{notif.message}</p>
                      <span>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Student: My Registrations */}
        {user.role === "student" && registrations.length > 0 && (
          <div className="table-container" style={{ marginTop: 24 }}>
            <div className="table-header">
              <h3>🎫 My Registrations</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>QR Ticket</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{reg.event_title}</td>
                    <td><span className={`badge badge-${reg.status}`}>{reg.status}</span></td>
                    <td>{new Date(reg.registered_at).toLocaleDateString()}</td>
                    <td>
                      {reg.qr_token ? (
                        <span className="badge badge-confirmed">🎟️ Available</span>
                      ) : (
                        <span className="badge badge-draft">—</span>
                      )}
                    </td>
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
