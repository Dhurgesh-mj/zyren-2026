"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authAPI } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    department: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await authAPI.register(form);
      login(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container fade-in">
        <div className="auth-card">
          <div className="auth-logo">
            <h1>🛡️ EventIQ Secure</h1>
            <p>Create your secure account</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                className="input"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                className="input"
                placeholder="you@college.edu"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>

            <div className="input-group">
              <label>Role</label>
              <select name="role" className="input" value={form.role} onChange={handleChange}>
                <option value="student">Student</option>
                <option value="organizer">Organizer</option>
                <option value="dept_admin">Department Admin</option>
                <option value="college_admin">College Admin</option>
              </select>
            </div>

            <div className="input-group">
              <label>Department (optional)</label>
              <input
                type="text"
                name="department"
                className="input"
                placeholder="Computer Science"
                value={form.department}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
