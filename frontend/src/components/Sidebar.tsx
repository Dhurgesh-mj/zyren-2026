"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊", roles: ["student", "organizer", "dept_admin", "college_admin"] },
    { href: "/events", label: "Events", icon: "🎯", roles: ["student", "organizer", "dept_admin", "college_admin"] },
    { href: "/approvals", label: "Approvals", icon: "🛡️", roles: ["dept_admin", "college_admin"] },
    { href: "/scanner", label: "QR Scanner", icon: "📱", roles: ["organizer", "dept_admin", "college_admin"] },
    { href: "/analytics", label: "Analytics", icon: "📈", roles: ["organizer", "dept_admin", "college_admin"] },
    { href: "/notifications", label: "Notifications", icon: "🔔", roles: ["student", "organizer", "dept_admin", "college_admin"] },
    { href: "/profile", label: "Profile", icon: "👤", roles: ["student", "organizer", "dept_admin", "college_admin"] },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    if (!user) return null;

    const filteredNav = navItems.filter(item => item.roles.includes(user.role));

    return (
        <div className="sidebar">
            <div className="sidebar-brand">
                <h1>EventIQ Secure</h1>
                <p>Secure Events Platform</p>
            </div>

            <nav className="sidebar-nav">
                {filteredNav.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-link ${pathname === item.href ? "active" : ""}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className="sidebar-user">
                <div className="sidebar-avatar">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                    <h4>{user.name}</h4>
                    <p>{user.role.replace("_", " ")}</p>
                </div>
                <button
                    onClick={() => { logout(); window.location.href = "/login"; }}
                    className="btn btn-ghost btn-sm"
                    title="Logout"
                >
                    ↗
                </button>
            </div>
        </div>
    );
}
