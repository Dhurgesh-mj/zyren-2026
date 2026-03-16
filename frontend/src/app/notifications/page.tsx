"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { notificationsAPI } from "@/lib/api";

interface Notification {
  id: number;
  user_id: number;
  event_id: number | null;
  message: string;
  type: string;
  status: string;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const data = await notificationsAPI.list();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, status: "read" } : n)
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, status: "read" }))
      );
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "confirmation": return "✅";
      case "reminder": return "⏰";
      case "alert": return "🚨";
      default: return "ℹ️";
    }
  };

  if (isLoading || !user) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>;
  }

  const unreadCount = notifications.filter(n => n.status === "unread").length;

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>🔔 Notifications</h1>
            <p>{unreadCount > 0 ? `You have ${unreadCount} unread notifications` : "You're all caught up!"}</p>
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={markAllRead}>
              Mark All as Read
            </button>
          )}
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ padding: 60, textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔕</div>
              <h3>No notifications</h3>
              <p>Notifications about your events and registrations will appear here.</p>
            </div>
          ) : (
            <div>
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notification-item ${notif.status === "unread" ? "unread" : ""}`}
                  onClick={() => {
                    if (notif.status === "unread") markRead(notif.id);
                    if (notif.event_id) router.push(`/events/${notif.event_id}`);
                  }}
                >
                  <div style={{ fontSize: 20, marginTop: 2 }}>{getTypeIcon(notif.type)}</div>
                  <div className="notification-content">
                    <p style={{ fontWeight: notif.status === "unread" ? 600 : 400 }}>{notif.message}</p>
                    <span>{new Date(notif.created_at).toLocaleString()}</span>
                  </div>
                  <div className={`notification-dot ${notif.status === "read" ? "read" : ""}`}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
