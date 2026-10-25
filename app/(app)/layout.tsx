import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" className="brand">
            Vehicle Log
          </Link>
          <span className="who">{user.name}</span>
          <Link href="/new" className="btn primary small">
            + New
          </Link>
          <form method="post" action="/api/logout">
            <button className="small" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
