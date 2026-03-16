"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import { attendanceAPI } from "@/lib/api";

interface CheckinResult {
  id: number;
  user_name: string;
  event_title: string;
  checkin_time: string;
}

export default function ScannerPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [qrInput, setQrInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string; data?: CheckinResult } | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<CheckinResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedRef = useRef<string>("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (!isLoading && user && !["organizer", "dept_admin", "college_admin"].includes(user.role)) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckin = useCallback(async (token: string) => {
    if (!token.trim() || scanning) return;
    // Prevent duplicate scans of the same token
    if (token === lastScannedRef.current) return;
    lastScannedRef.current = token;

    setScanning(true);
    setResult(null);

    try {
      const data = await attendanceAPI.checkin(token.trim());
      setResult({ type: "success", message: "Check-in successful!", data });
      setRecentCheckins(prev => [data, ...prev.slice(0, 19)]);
      setQrInput("");

      // Success beep
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.2;
        osc.frequency.value = 880;
        osc.type = "sine";
        osc.start();
        setTimeout(() => { osc.frequency.value = 1320; }, 100);
        setTimeout(() => { osc.stop(); ctx.close(); }, 250);
      } catch { /* audio not supported */ }

      // Allow re-scan after 3 seconds
      setTimeout(() => { lastScannedRef.current = ""; }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Check-in failed";
      setResult({ type: "error", message });
      // Allow retry after 2 seconds
      setTimeout(() => { lastScannedRef.current = ""; }, 2000);
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const startCamera = async () => {
    setCameraError("");

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Camera API not available. This requires HTTPS or localhost. Try using the manual token input or upload a QR image below."
      );
      return;
    }

    // Check permission status first
    try {
      if (navigator.permissions) {
        const permStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (permStatus.state === "denied") {
          setCameraError(
            "Camera permission was denied. To fix:\n1. Click the lock/camera icon in your browser address bar\n2. Allow camera access\n3. Reload the page and try again\n\nAlternatively, use the manual token input or upload a QR image."
          );
          return;
        }
      }
    } catch {
      // permissions.query not supported, proceed anyway
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      // Dynamically import jsQR for scanning
      const jsQR = (await import("jsqr")).default;

      // Start scanning loop
      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx || video.videoWidth === 0) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleCheckin(code.data);
        }
      }, 200);

    } catch (err: unknown) {
      console.error("Camera error:", err);
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setCameraError(
          "Camera permission denied. Please allow camera access in your browser settings, then reload and try again. You can also use the manual input or upload a QR image."
        );
      } else if (name === "NotFoundError") {
        setCameraError("No camera found on this device. Use the manual token input or upload a QR image.");
      } else if (name === "NotReadableError") {
        setCameraError("Camera is in use by another app. Close other apps using the camera and try again.");
      } else {
        setCameraError(`Camera error: ${err instanceof Error ? err.message : "Unknown error"}. Use manual input instead.`);
      }
    }
  };

  // Scan QR from uploaded image file
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const jsQR = (await import("jsqr")).default;
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code && code.data) {
          handleCheckin(code.data);
        } else {
          setResult({ type: "error", message: "No QR code found in the uploaded image. Make sure the QR code is clear and visible." });
        }

        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch {
      setResult({ type: "error", message: "Failed to process image." });
    }
    // Reset file input
    e.target.value = "";
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  if (isLoading || !user) {
    return <div className="loading-page"><div className="spinner"></div><p>Loading...</p></div>;
  }

  return (
    <div className="page-container">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header">
          <h1>📱 QR Attendance Scanner</h1>
          <p>Scan QR codes using camera or paste tokens manually for check-in</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Left: Scanner */}
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                  {cameraActive ? "📷 Camera Active — Point at QR Code" : "🔍 Scan Mode"}
                </h3>
                <button
                  className={`btn ${cameraActive ? "btn-danger" : "btn-primary"} btn-sm`}
                  onClick={cameraActive ? stopCamera : startCamera}
                >
                  {cameraActive ? "⬛ Stop" : "📷 Start Camera"}
                </button>
              </div>

              {/* Camera Feed */}
              <div style={{
                position: "relative", width: "100%", borderRadius: 12, overflow: "hidden",
                border: cameraActive ? "2px solid var(--accent)" : "2px dashed var(--border)",
                background: "#000", minHeight: 300,
                boxShadow: cameraActive ? "0 0 30px rgba(99, 102, 241, 0.3)" : "none",
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    display: cameraActive ? "block" : "none",
                  }}
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {/* Scanning overlay */}
                {cameraActive && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    pointerEvents: "none",
                  }}>
                    <div style={{
                      width: 200, height: 200,
                      border: "3px solid rgba(99, 102, 241, 0.8)",
                      borderRadius: 16,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                      animation: "pulse 2s ease-in-out infinite",
                    }}>
                      {/* Corner markers */}
                      <div style={{ position: "absolute", top: -2, left: -2, width: 24, height: 24, borderTop: "4px solid #6366f1", borderLeft: "4px solid #6366f1", borderRadius: "4px 0 0 0" }} />
                      <div style={{ position: "absolute", top: -2, right: -2, width: 24, height: 24, borderTop: "4px solid #6366f1", borderRight: "4px solid #6366f1", borderRadius: "0 4px 0 0" }} />
                      <div style={{ position: "absolute", bottom: -2, left: -2, width: 24, height: 24, borderBottom: "4px solid #6366f1", borderLeft: "4px solid #6366f1", borderRadius: "0 0 0 4px" }} />
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderBottom: "4px solid #6366f1", borderRight: "4px solid #6366f1", borderRadius: "0 0 4px 0" }} />
                    </div>
                  </div>
                )}

                {/* Placeholder when camera off */}
                {!cameraActive && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    height: 300, gap: 12,
                  }}>
                    <div style={{ fontSize: 56, opacity: 0.4 }}>📷</div>
                    <p style={{ color: "#888", fontSize: 14 }}>Click &quot;Start Camera&quot; to scan QR codes</p>
                    <p style={{ color: "#666", fontSize: 12 }}>Or paste a token manually below</p>
                  </div>
                )}

                {/* Scanning status indicator */}
                {cameraActive && (
                  <div style={{
                    position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.7)", borderRadius: 20, padding: "6px 16px",
                    display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                      animation: "pulse 1s infinite",
                    }} />
                    Scanning...
                  </div>
                )}
              </div>

              {cameraError && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#ef4444", fontSize: 13,
                }}>
                  ⚠️ {cameraError}
                </div>
              )}
            </div>

            {/* Manual Input */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✏️ Manual Token Input</h3>
              <textarea
                className="input"
                placeholder="Paste QR token string here..."
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCheckin(qrInput);
                  }
                }}
                style={{ minHeight: 70, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => handleCheckin(qrInput)}
                  disabled={scanning || !qrInput.trim()}
                >
                  {scanning ? "⏳ Verifying..." : "🔍 Verify & Check In"}
                </button>
                <label className="btn btn-ghost btn-sm" style={{
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px",
                }}>
                  📁 Upload QR Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right: Results & History */}
          <div>
            {/* Result Banner */}
            {result && (
              <div className="card" style={{
                marginBottom: 20,
                borderLeft: `4px solid ${result.type === "success" ? "var(--success)" : "var(--danger)"}`,
              }}>
                <h3 style={{
                  fontSize: 18, fontWeight: 800, marginBottom: 12,
                  color: result.type === "success" ? "var(--success)" : "var(--danger)",
                }}>
                  {result.type === "success" ? "✅ Check-in Successful!" : `❌ ${result.message}`}
                </h3>
                {result.data && (
                  <div style={{ fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "var(--text-muted)" }}>👤 Student</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{result.data.user_name}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "var(--text-muted)" }}>📌 Event</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{result.data.event_title}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <span style={{ color: "var(--text-muted)" }}>🕐 Time</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{new Date(result.data.checkin_time).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Check-ins */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                📋 Recent Check-ins
                {recentCheckins.length > 0 && (
                  <span style={{
                    marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 10,
                    background: "rgba(16, 185, 129, 0.15)", color: "var(--success)"
                  }}>
                    {recentCheckins.length}
                  </span>
                )}
              </h3>
              {recentCheckins.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📋</div>
                  <p>No check-ins yet this session</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Scan a QR code to get started</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {recentCheckins.map((c, i) => (
                    <div key={i} style={{
                      padding: "10px 14px", borderRadius: 10,
                      background: "rgba(16, 185, 129, 0.06)",
                      border: "1px solid rgba(16, 185, 129, 0.12)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{c.user_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.event_title} &middot; {new Date(c.checkin_time).toLocaleTimeString()}</div>
                      </div>
                      <span style={{ color: "var(--success)", fontSize: 18 }}>✅</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Info */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🔒 Security Features</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: "🛡️", title: "HMAC-SHA256 Signed", desc: "Tokens cryptographically signed" },
                  { icon: "🔄", title: "Replay Protection", desc: "Each QR code works only once" },
                  { icon: "⏰", title: "24h Token Expiry", desc: "Tokens auto-expire for safety" },
                  { icon: "📝", title: "Audit Logged", desc: "Every scan recorded with IP" },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: 10, background: "var(--bg-input)", borderRadius: 8,
                    display: "flex", gap: 10, alignItems: "center"
                  }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
