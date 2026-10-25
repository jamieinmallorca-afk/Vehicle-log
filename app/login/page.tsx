export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login">
      <h1>Vehicle Log</h1>
      <p className="muted">Private. Authorised users only.</p>
      {error === "locked" ? (
        <div className="error">Too many attempts. Try again in 15 minutes.</div>
      ) : error ? (
        <div className="error">Wrong username or password.</div>
      ) : null}
      <form method="post" action="/api/login">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <p>
          <button className="primary" type="submit" style={{ width: "100%" }}>
            Log in
          </button>
        </p>
      </form>
    </div>
  );
}
