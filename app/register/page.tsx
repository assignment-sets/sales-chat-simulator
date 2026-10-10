import Link from "next/link";
import { signup } from "@/app/auth/actions";

interface Props {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Sales Chat Simulator</h1>
      <h2>Create Account</h2>

      {params.error && (
        <div style={{ padding: "10px", marginBottom: "15px", backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ef9a9a" }}>
          {params.error}
        </div>
      )}

      {params.message && (
        <div style={{ padding: "10px", marginBottom: "15px", backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7" }}>
          {params.message}
        </div>
      )}

      <form action={signup} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: "4px" }}>Email:</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: "4px" }}>Password:</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          />
        </div>

        <button type="submit" style={{ padding: "10px", marginTop: "10px", cursor: "pointer", fontWeight: "bold" }}>
          Sign Up
        </button>
      </form>

      <p style={{ marginTop: "20px", fontSize: "14px" }}>
        Already have an account? <Link href="/login">Login here</Link>
      </p>
    </main>
  );
}
