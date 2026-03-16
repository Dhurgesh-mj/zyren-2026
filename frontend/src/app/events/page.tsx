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

const categories = ["All", "Technical", "Cultural", "Sports", "Workshop", "Seminar"];

export default function EventsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    venue: "",
    capacity: 100,
    category: "Technical",
    registration_deadline: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) loadEvents();
  }, [user]);

  const loadEvents = async () => {
    try {
      const data = await eventsAPI.list();
      setEvents(data);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await eventsAPI.create(createForm);
      setShowCreateModal(false);
      setCreateForm({ title: "", description: "", date: "", time: "", venue: "", capacity: 100, category: "Technical", registration_deadline: "" });
      loadEvents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create event";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const filteredEvents = selectedCategory === "All"
    ? events
    : events.filter(e => e.category === selectedCategory);

  const getCategoryBadge = (cat: string) => {
    const key = cat.toLowerCase();
    return `badge badge-${key}`;
  };

  if (isLoading || !user) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>;
  }

  const isOrganizer = ["organizer", "dept_admin", "college_admin"].includes(user.role);

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Events</h1>
            <p>Browse and manage campus events</p>
          </div>
          {isOrganizer && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ＋ Create Event
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><div className="spinner" style={{ margin: "0 auto" }}></div></div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <h3>No events found</h3>
            <p>{selectedCategory !== "All" ? `No ${selectedCategory} events available.` : "No events have been created yet."}</p>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="event-card"
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <div className="event-card-header">
                  <h3 className="event-card-title">{event.title}</h3>
                  <span className={`badge badge-${event.status}`}>{event.status}</span>
                </div>

                <div className="event-card-meta">
                  <div className="event-card-meta-item">
                    📅 {event.date} at {event.time}
                  </div>
                  <div className="event-card-meta-item">
                    📍 {event.venue}
                  </div>
                  <div className="event-card-meta-item">
                    👤 {event.organizer_name}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span className={getCategoryBadge(event.category)}>{event.category}</span>
                </div>

                <div className="event-card-footer">
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {event.registered_count} / {event.capacity} registered
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Deadline: {event.registration_deadline}
                  </span>
                </div>
                <div className="capacity-bar">
                  <div
                    className="capacity-bar-fill"
                    style={{ width: `${Math.min((event.registered_count / event.capacity) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Event Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>🎯 Create New Event</h2>
              {createError && <div className="error-msg" style={{ marginBottom: 16 }}>{createError}</div>}
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="input-group">
                  <label>Event Title</label>
                  <input className="input" placeholder="Cybersecurity Workshop" value={createForm.title}
                    onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required />
                </div>
                <div className="input-group">
                  <label>Description</label>
                  <input className="input" placeholder="Event description..." value={createForm.description}
                    onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="input-group">
                    <label>Date</label>
                    <input type="date" className="input" value={createForm.date}
                      onChange={e => setCreateForm({ ...createForm, date: e.target.value })} required />
                  </div>
                  <div className="input-group">
                    <label>Time</label>
                    <input type="time" className="input" value={createForm.time}
                      onChange={e => setCreateForm({ ...createForm, time: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label>Venue</label>
                  <input className="input" placeholder="Seminar Hall A" value={createForm.venue}
                    onChange={e => setCreateForm({ ...createForm, venue: e.target.value })} required />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="input-group">
                    <label>Capacity</label>
                    <input type="number" className="input" min={1} value={createForm.capacity}
                      onChange={e => setCreateForm({ ...createForm, capacity: parseInt(e.target.value) || 1 })} required />
                  </div>
                  <div className="input-group">
                    <label>Category</label>
                    <select className="input" value={createForm.category}
                      onChange={e => setCreateForm({ ...createForm, category: e.target.value })}>
                      <option>Technical</option>
                      <option>Cultural</option>
                      <option>Sports</option>
                      <option>Workshop</option>
                      <option>Seminar</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>Registration Deadline</label>
                  <input type="date" className="input" value={createForm.registration_deadline}
                    onChange={e => setCreateForm({ ...createForm, registration_deadline: e.target.value })} required />
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? "Creating..." : "Create Event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
