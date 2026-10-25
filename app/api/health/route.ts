// Public, reveals nothing. Used by Railway's healthcheck.
export async function GET() {
  return new Response("ok", { status: 200 });
}
