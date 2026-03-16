const API_BASE = "http://127.0.0.1:8000";

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
}

async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (res.status === 401) {
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        throw new Error("Unauthorized");
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `API error: ${res.status}`);
    }

    return res.json();
}

// Auth
export const authAPI = {
    register: (data: { name: string; email: string; password: string; role: string; department?: string }) =>
        apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
        apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    me: () => apiFetch("/auth/me"),
    updateProfile: (data: { name?: string; department?: string; telegram_chat_id?: number | null }) =>
        apiFetch("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
    testTelegram: () => apiFetch("/auth/test-telegram", { method: "POST" }),
};

// Events
export const eventsAPI = {
    list: (status?: string, category?: string) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (category) params.set("category", category);
        return apiFetch(`/events/list?${params}`);
    },
    get: (id: number) => apiFetch(`/events/${id}`),
    create: (data: Record<string, unknown>) =>
        apiFetch("/events/create", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
        apiFetch(`/events/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    approve: (id: number) =>
        apiFetch(`/events/${id}/approve`, { method: "POST" }),
    reject: (id: number) =>
        apiFetch(`/events/${id}/reject`, { method: "POST" }),
};

// Registrations
export const registrationsAPI = {
    register: (eventId: number) =>
        apiFetch("/registrations/register", { method: "POST", body: JSON.stringify({ event_id: eventId }) }),
    cancel: (registrationId: number) =>
        apiFetch(`/registrations/cancel/${registrationId}`, { method: "POST" }),
    my: () => apiFetch("/registrations/my"),
    eventRegistrations: (eventId: number) => apiFetch(`/registrations/event/${eventId}`),
    qrTicket: (registrationId: number) => apiFetch(`/registrations/qr-ticket/${registrationId}`),
    linkTelegram: (chatId: number) =>
        apiFetch("/registrations/telegram/link", { method: "POST", body: JSON.stringify({ chat_id: chatId }) }),
};

// Attendance
export const attendanceAPI = {
    checkin: (qrToken: string) =>
        apiFetch("/attendance/checkin", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }),
    eventAttendance: (eventId: number) => apiFetch(`/attendance/event/${eventId}`),
};

// Notifications
export const notificationsAPI = {
    list: () => apiFetch("/notifications/"),
    markRead: (id: number) => apiFetch(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => apiFetch("/notifications/read-all", { method: "POST" }),
};

// Analytics
export const analyticsAPI = {
    overview: () => apiFetch("/analytics/overview"),
    events: () => apiFetch("/analytics/events"),
    attendance: () => apiFetch("/analytics/attendance"),
};
