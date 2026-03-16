"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { eventsAPI, registrationsAPI, attendanceAPI } from "@/lib/api";

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
  organizer_id: number;
  registration_deadline: string;
}

interface Registration {
  id: number;
  user_id: number;
  event_id: number;
  status: string;
  qr_token: string | null;
  registered_at: string;
  user_name: string;
}

interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  checkin_time: string;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = parseInt(resolvedParams.id);
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [qrTicketImage, setQrTicketImage] = useState<string | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) loadEvent();
  }, [user]);

  const loadEvent = async () => {
    try {
      const eventData = await eventsAPI.get(eventId);
      setEvent(eventData);

      // Load my registration
      if (user?.role === "student") {
        try {
          const myRegs = await registrationsAPI.my();
          const found = myRegs.find((r: Registration) => r.event_id === eventId && r.status !== "cancelled");
          setMyRegistration(found || null);
        } catch { /* ignore */ }
      }

      // Load registrations & attendance if organizer/admin
      if (["organizer", "dept_admin", "college_admin"].includes(user?.role || "")) {
        try {
          const regs = await registrationsAPI.eventRegistrations(eventId);
          setRegistrations(regs);
          const att = await attendanceAPI.eventAttendance(eventId);
          setAttendance(att);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error("Failed to load event:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setActionLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const reg = await registrationsAPI.register(eventId);
      setMyRegistration(reg);
      setMessage({ type: "success", text: reg.status === "waitlisted" ? "Added to waitlist!" : "Registration confirmed! 🎉" });
      loadEvent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!myRegistration) return;
    setActionLoading(true);
    try {
      await registrationsAPI.cancel(myRegistration.id);
      setMyRegistration(null);
      setMessage({ type: "success", text: "Registration cancelled." });
      loadEvent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancellation failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await eventsAPI.approve(eventId);
      setMessage({ type: "success", text: "Event approved and published! ✅" });
      loadEvent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Approval failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || !user || loading) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading event...</p></div>;
  }

  if (!event) {
    return (
      <div className="page-container">
        <Sidebar />
        <main className="main-content">
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <h3>Event not found</h3>
            <button className="btn btn-primary" onClick={() => router.push("/events")}>Back to Events</button>
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = ["dept_admin", "college_admin"].includes(user.role);
  const isOrganizer = event.organizer_id === user.id || isAdmin;
  const fillPercent = event.capacity > 0 ? Math.round((event.registered_count / event.capacity) * 100) : 0;

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/events")} style={{ marginBottom: 16 }}>
          ← Back to Events
        </button>

        {message.text && (
          <div className={message.type === "error" ? "error-msg" : "success-msg"} style={{ marginBottom: 16 }}>
            {message.text}
          </div>
        )}

        <div className="detail-grid">
          {/* Main Info */}
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{event.title}</h1>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className={`badge badge-${event.status}`}>{event.status}</span>
                    <span className={`badge badge-${event.category.toLowerCase()}`}>{event.category}</span>
                  </div>
                </div>
              </div>

              {event.description && (
                <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>{event.description}</p>
              )}

              <div className="detail-info-list">
                <div className="detail-info-item">
                  <label>📅 Date</label>
                  <span>{event.date}</span>
                </div>
                <div className="detail-info-item">
                  <label>⏰ Time</label>
                  <span>{event.time}</span>
                </div>
                <div className="detail-info-item">
                  <label>📍 Venue</label>
                  <span>{event.venue}</span>
                </div>
                <div className="detail-info-item">
                  <label>👤 Organizer</label>
                  <span>{event.organizer_name}</span>
                </div>
                <div className="detail-info-item">
                  <label>📋 Deadline</label>
                  <span>{event.registration_deadline}</span>
                </div>
              </div>
            </div>

            {/* Registrations Table (for organizers) */}
            {isOrganizer && registrations.length > 0 && (
              <div className="table-container">
                <div className="table-header">
                  <h3>Registrations ({registrations.length})</h3>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(reg => (
                      <tr key={reg.id}>
                        <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{reg.user_name}</td>
                        <td><span className={`badge badge-${reg.status}`}>{reg.status}</span></td>
                        <td>{new Date(reg.registered_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Attendance Table (for organizers) */}
            {isOrganizer && attendance.length > 0 && (
              <div className="table-container" style={{ marginTop: 24 }}>
                <div className="table-header">
                  <h3>Attendance ({attendance.length})</h3>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Check-in Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map(att => (
                      <tr key={att.id}>
                        <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{att.user_name}</td>
                        <td>{new Date(att.checkin_time).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar - Actions */}
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Capacity</h3>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                  {event.registered_count}<span style={{ color: "var(--text-muted)", fontSize: 18 }}>/{event.capacity}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fillPercent}% filled</div>
              </div>
              <div className="capacity-bar" style={{ height: 8 }}>
                <div className="capacity-bar-fill" style={{
                  width: `${Math.min(fillPercent, 100)}%`,
                  background: fillPercent >= 100 ? "var(--danger)" : "linear-gradient(90deg, var(--accent), var(--info))"
                }}></div>
              </div>
            </div>

            {/* Student Actions */}
            {user.role === "student" && event.status === "published" && (
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Registration</h3>
                {myRegistration ? (
                  <div>
                    <div className="success-msg" style={{ marginBottom: 12 }}>
                      Status: <strong>{myRegistration.status}</strong>
                    </div>
                    {myRegistration.qr_token && (
                      <div style={{ textAlign: "center", padding: "12px 0", marginBottom: 12 }}>
                        {qrTicketImage ? (
                          <img
                            src={`data:image/png;base64,${qrTicketImage}`}
                            alt="QR Ticket"
                            style={{
                              maxWidth: "100%", borderRadius: 12,
                              border: "2px solid var(--accent)",
                              boxShadow: "0 4px 20px rgba(99, 102, 241, 0.2)"
                            }}
                          />
                        ) : (
                          <div style={{
                            background: "var(--bg-input)", width: "100%", height: 200,
                            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer",
                          }} onClick={async () => {
                            setLoadingTicket(true);
                            try {
                              const data = await registrationsAPI.qrTicket(myRegistration.id);
                              setQrTicketImage(data.qr_image_base64);
                            } catch { /* ignore */ }
                            setLoadingTicket(false);
                          }}>
                            {loadingTicket ? (
                              <div className="spinner"></div>
                            ) : (
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 48 }}>🎟️</div>
                                <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                                  Click to load QR Ticket
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {qrTicketImage && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = `data:image/png;base64,${qrTicketImage}`;
                              link.download = `ticket_${event?.title?.replace(/\s/g, "_")}.png`;
                              link.click();
                            }}
                          >
                            📥 Download QR Ticket
                          </button>
                        )}
                        <p style={{
                          fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                          color: "var(--text-muted)", wordBreak: "break-all", marginTop: 8, padding: "0 4px"
                        }}>
                          Token: {myRegistration.qr_token.substring(0, 40)}...
                        </p>
                      </div>
                    )}
                    <button className="btn btn-danger btn-sm" style={{ width: "100%", justifyContent: "center" }}
                      onClick={handleCancel} disabled={actionLoading}>
                      {actionLoading ? "Cancelling..." : "Cancel Registration"}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleRegister} disabled={actionLoading}>
                    {actionLoading ? "Registering..." : event.registered_count >= event.capacity ? "Join Waitlist" : "Register Now"}
                  </button>
                )}
              </div>
            )}

            {/* Admin: Approve */}
            {isAdmin && event.status === "pending" && (
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Admin Actions</h3>
                <button className="btn btn-success" style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleApprove} disabled={actionLoading}>
                  {actionLoading ? "Approving..." : "✅ Approve & Publish"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
