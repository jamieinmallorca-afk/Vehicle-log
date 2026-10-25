import { redirect } from "@/lib/auth";
import { clearCookie } from "@/lib/session";

export async function POST() {
  const res = redirect("/login");
  res.headers.append("Set-Cookie", clearCookie());
  return res;
}
