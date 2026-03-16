"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { authAPI } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setDepartment(user.department || "");
      setTelegramChatId(user.telegram_chat_id ? String(user.telegram_chat_id) : "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const data: Record<string, unknown> = {};
      if (name !== user?.name) data.name = name;
      if (department !== (user?.department || "")) data.department = department || null;
      if (telegramChatId !== (user?.telegram_chat_id ? String(user.telegram_chat_id) : "")) {
        data.telegram_chat_id = telegramChatId ? parseInt(telegramChatId) : null;
      }

      if (Object.keys(data).length === 0) {
        setMessage({ type: "info", text: "No changes to save." });
        setSaving(false);
        return;
      }

      const updated = await authAPI.updateProfile(data as { name?: string; department?: string; telegram_chat_id?: number | null });
      // Update local storage
      localStorage.setItem("user", JSON.stringify(updated));
      setMessage({ type: "success", text: "✅ Profile updated successfully!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await authAPI.testTelegram();
      setMessage({ type: "success", text: `📱 ${res.message}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || !user) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>;
  }

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1>👤 My Profile</h1>
          <p>Manage your account settings and notification preferences</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Profile Info */}
          <div className="card">
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📋 Account Details</h3>

            {message.text && (
              <div className={message.type === "error" ? "error-msg" : "success-msg"} style={{ marginBottom: 16 }}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="input-group">
                <label>Full Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} required />
              </div>

              <div className="input-group">
                <label>Email</label>
                <input className="input" value={user.email} disabled style={{ opacity: 0.6 }} />
                <small style={{ color: "var(--text-muted)", fontSize: 11 }}>Email cannot be changed</small>
              </div>

              <div className="input-group">
                <label>Role</label>
                <input className="input" value={user.role.replace("_", " ")} disabled style={{ opacity: 0.6, textTransform: "capitalize" }} />
              </div>

              <div className="input-group">
                <label>Department</label>
                <input className="input" placeholder="e.g. Computer Science" value={department} onChange={e => setDepartment(e.target.value)} />
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            </form>
          </div>

          {/* Telegram Settings */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📱 Telegram Notifications</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
                Link your Telegram account to receive event confirmations, QR tickets, and reminders directly on Telegram.
              </p>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label>Telegram Chat ID</label>
                <input
                  className="input"
                  placeholder="e.g. 123456789"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value.replace(/\D/g, ""))}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {saving ? "Saving..." : "💾 Save Chat ID"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleTestTelegram}
                  disabled={testing || !telegramChatId}
                  style={{ flex: 1, justifyContent: "center", border: "1px solid var(--border)" }}
                >
                  {testing ? "Sending..." : "🧪 Send Test Message"}
                </button>
              </div>
            </div>

            {/* How to get Chat ID */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>❓ How to Get Your Chat ID</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { step: "1", text: "Open Telegram and search for our bot", detail: "Search for the EventIQ bot" },
                  { step: "2", text: "Send /start to the bot", detail: "This activates the bot for your account" },
                  { step: "3", text: "Send /chatid to the bot", detail: "The bot will reply with your Chat ID" },
                  { step: "4", text: "Paste the number above", detail: "Save it and click 'Send Test Message'" },
                ].map((item) => (
                  <div key={item.step} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "10px 12px", background: "var(--bg-input)", borderRadius: 10,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
