"use client";

import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { em } from "@/components/ui/TableEmoji";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";

import "@/styles/login-premium.css";

const FEATURES = [
  { emoji: em.report, label: "تقارير ذكية" },
  { emoji: "🏭", label: "مخزون شامل" },
  { emoji: "🛒", label: "مبيعات سهلة" },
  { emoji: em.role, label: "آمن وموثوق" },
] as const;

function formatStatusBarTime(date: Date): string {
  return date.toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}

function StatusBarIcons() {
  return (
    <>
      <svg
        className="status-icon-svg"
        viewBox="0 0 18 12"
        width="18"
        height="12"
        aria-hidden
      >
        <rect x="1" y="8.5" width="2.5" height="2.5" rx="0.4" fill="currentColor" opacity="0.35" />
        <rect x="5" y="6" width="2.5" height="5" rx="0.4" fill="currentColor" opacity="0.55" />
        <rect x="9" y="3.5" width="2.5" height="7.5" rx="0.4" fill="currentColor" opacity="0.75" />
        <rect x="13" y="1" width="2.5" height="10" rx="0.4" fill="currentColor" />
      </svg>
      <svg
        className="status-icon-svg"
        viewBox="0 0 16 12"
        width="16"
        height="12"
        fill="none"
        aria-hidden
      >
        <circle cx="8" cy="10.5" r="1" fill="currentColor" />
        <path
          d="M5.5 7.6a3.8 3.8 0 0 1 5 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M3 5a6.5 6.5 0 0 1 10 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M1 2.2a9 9 0 0 1 14 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="status-icon-svg"
        viewBox="0 0 22 12"
        width="22"
        height="12"
        fill="none"
        aria-hidden
      >
        <rect
          x="1"
          y="2.5"
          width="17"
          height="7"
          rx="1.6"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <rect x="2.8" y="4.2" width="11.5" height="3.6" rx="0.8" fill="currentColor" />
        <rect x="19" y="4.6" width="2" height="2.8" rx="0.6" fill="currentColor" />
      </svg>
    </>
  );
}

function MobileStatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(formatStatusBarTime(new Date()));
    update();
    const timer = setInterval(update, 10_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mobile-status-bar">
      <span className="time">{time || "—:—"}</span>
      <div className="status-icons" aria-hidden>
        <StatusBarIcons />
      </div>
    </div>
  );
}

function LoginStars() {
  const [stars, setStars] = useState<
    Array<{
      id: number;
      left: string;
      top: string;
      size: number;
      duration: number;
      delay: number;
      opacity: number;
    }>
  >([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 150 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.5,
      }))
    );
  }, []);

  return (
    <div className="stars-container">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "حدث خطأ");
        return;
      }

      setAuth(data.user, data.branches, data.allowedScreens ?? "all");

      if (data.branches.length === 1) {
        const branchRes = await fetch("/api/auth/select-branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ branchId: data.branches[0].id }),
        });
        if (branchRes.ok) {
          useAuthStore.getState().setBranch(data.branches[0]);
          router.push("/dashboard");
          return;
        }
      }

      router.push("/branches");
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-premium">
      <div className="background-effects">
        <div className="bg-image" />
        <div className="overlay-gradient" />
        <div className="glow-sphere-1" />
        <div className="glow-sphere-2" />
        <LoginStars />
      </div>

      <div className="lying-phone-bg">
        <Image
          src="/login/lying_phone_black.jpg"
          alt=""
          width={550}
          height={400}
          className="lying-phone-img"
          priority
        />
      </div>

      <main className="app-container">
        <div className="top-logo">
          <div className="logo-icon">
            <span aria-hidden>{em.device}</span>
          </div>
          <span className="logo-text">MOBILE STORE</span>
        </div>

        <div className="content-wrapper">
          <div className="left-section">
            <div className="hero-content">
              <h1 className="main-title">
                MOBILE <span className="highlight">STORE</span>
              </h1>
              <p className="sub-title">إدارة مبيعات ومخزون المحل</p>
            </div>

            <div className="features-row">
              {FEATURES.map((feature) => (
                <div key={feature.label} className="feature-card">
                  <div className="feature-icon" aria-hidden>
                    {feature.emoji}
                  </div>
                  <span className="feature-label">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="right-section">
            <div className="mobile-device">
              <div className="mobile-frame">
                <div className="mobile-notch" aria-hidden />
                <div className="mobile-screen">
                  <div className="mobile-status-spacer" aria-hidden />
                  <div className="mobile-content">
                <div className="login-logo-circle">
                  <span aria-hidden>{em.device}</span>
                </div>

                <div className="welcome-text">
                  <h2>مرحباً بك</h2>
                  <p>سجل الدخول للمتابعة</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="input-group">
                    <label htmlFor="login-username">
                      <span aria-hidden>{em.username}</span>
                      اسم المستخدم
                    </label>
                    <div className="input-wrapper">
                      <span className="input-icon" aria-hidden>
                        {em.name}
                      </span>
                      <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="أدخل اسم المستخدم"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="login-password">
                      <span aria-hidden>🔒</span>
                      كلمة المرور
                    </label>
                    <div className="input-wrapper">
                      <span className="input-icon" aria-hidden>
                        🔒
                      </span>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <label className="remember-me">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      تذكرني
                    </label>
                    <button type="button" className="forgot-password">
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? "⏳ جاري الدخول..." : "🔐 تسجيل الدخول"}
                  </button>

                  <div className="divider">
                    <span>أو</span>
                  </div>

                  <button type="button" className="btn-secondary">
                    <span aria-hidden>{em.customers}</span>
                    الدخول كزائر
                  </button>
                </form>
                  </div>
                </div>
              </div>
              <MobileStatusBar />
            </div>
          </div>
        </div>

        <footer className="app-footer">
          <div className="security-note">
            <span aria-hidden>{em.role}</span>
            <span>حماية بياناتك هي أولويتنا</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
