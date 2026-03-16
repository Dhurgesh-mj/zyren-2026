"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { eventsAPI } from "@/lib/api";

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  capacity: number;
  category: string;
  status: string;
  registered_count: number;
  organizer_name: string;
  registration_deadline: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<"pending" | "published" | "rejected" | "all">("pending");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (!isLoading && user && !["dept_admin", "college_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) loadEvents();
  }, [user]);

  const loadEvents = async () => {
    try {
      const data = await eventsAPI.list();
      setAllEvents(data);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId: number, eventTitle: string) => {
    setActionLoading(eventId);
    setMessage({ type: "", text: "" });
    try {
      await eventsAPI.approve(eventId);
      setMessage({ type: "success", text: `✅ "${eventTitle}" has been approved and published!` });
      loadEvents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (eventId: number, eventTitle: string) => {
    if (!confirm(`Are you sure you want to reject "${eventTitle}"? The organizer will be notified.`)) return;
    setActionLoading(eventId);
    setMessage({ type: "", text: "" });
    try {
      await eventsAPI.reject(eventId);
      setMessage({ type: "success", text: `❌ "${eventTitle}" has been rejected. Organizer notified.` });
      loadEvents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rejection failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading || !user) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>;
  }

  const filteredEvents = filter === "all" ? allEvents : allEvents.filter(e => e.status === filter);
  const pendingCount = allEvents.filter(e => e.status === "pending").length;
  const publishedCount = allEvents.filter(e => e.status === "published").length;
  const rejectedCount = allEvents.filter(e => e.status === "rejected").length;

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1>🛡️ Event Approvals</h1>
          <p>Review, approve, or reject event proposals from organizers</p>
        </div>

        {message.text && (
          <div className={message.type === "error" ? "error-msg" : "success-msg"} style={{ marginBottom: 20 }}>
            {message.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card" onClick={() => setFilter("pending")} style={{ cursor: "pointer", border: filter === "pending" ? "2px solid var(--warning)" : "2px solid transparent" }}>
            <div className="stat-icon orange">⏳</div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pending Review</div>
          </div>
          <div className="stat-card" onClick={() => setFilter("published")} style={{ cursor: "pointer", border: filter === "published" ? "2px solid var(--success)" : "2px solid transparent" }}>
            <div className="stat-icon green">✅</div>
            <div className="stat-value">{publishedCount}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card" onClick={() => setFilter("rejected")} style={{ cursor: "pointer", border: filter === "rejected" ? "2px solid var(--danger)" : "2px solid transparent" }}>
            <div className="stat-icon" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>❌</div>
            <div className="stat-value">{rejectedCount}</div>
            <div className="stat-label">Rejected</div>
          </div>
          <div className="stat-card" onClick={() => setFilter("all")} style={{ cursor: "pointer", border: filter === "all" ? "2px solid var(--accent)" : "2px solid transparent" }}>
            <div className="stat-icon blue">📋</div>
            <div className="stat-value">{allEvents.length}</div>
            <div className="stat-label">Total Events</div>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{filter === "pending" ? "🎉" : "📋"}</div>
            <h3>{filter === "pending" ? "No pending approvals!" : `No ${filter} events`}</h3>
            <p>{filter === "pending" ? "All events have been reviewed." : "No events match this filter."}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredEvents.map(event => (
              <div key={event.id} className="card" style={{
                borderLeft: `4px solid ${
                  event.status === "pending" ? "#f59e0b" :
                  event.status === "published" ? "#10b981" :
                  event.status === "rejected" ? "#ef4444" : "var(--border)"
                }`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                        {event.title}
                      </h3>
                      <span className={`badge badge-${event.status}`}>{event.status}</span>
                      <span className={`badge badge-${event.category.toLowerCase()}`}>{event.category}</span>
                    </div>

                    {event.description && (
                      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                        {event.description}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                      <span>📅 {event.date} at {event.time}</span>
                      <span>📍 {event.venue}</span>
                      <span>👤 {event.organizer_name}</span>
                      <span>👥 Capacity: {event.capacity}</span>
                      <span>📋 Deadline: {event.registration_deadline}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {event.status === "pending" && (
                    <div style={{ display: "flex", gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading === event.id}
                        onClick={() => handleApprove(event.id, event.title)}
                        style={{ minWidth: 90, justifyContent: "center" }}
                      >
                        {actionLoading === event.id ? "..." : "✅ Approve"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading === event.id}
                        onClick={() => handleReject(event.id, event.title)}
                        style={{ minWidth: 90, justifyContent: "center" }}
                      >
                        {actionLoading === event.id ? "..." : "❌ Reject"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => router.push(`/events/${event.id}`)}
                      >
                        View →
                      </button>
                    </div>
                  )}

                  {event.status !== "pending" && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/events/${event.id}`)}
                      style={{ marginLeft: 16 }}
                    >
                      View →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
