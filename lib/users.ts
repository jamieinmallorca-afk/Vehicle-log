// Users come from the USERS env var: "name:password,name2:password2".
// First user is the admin. Edge-safe (no Node-only imports) so middleware can use it.

export type UserRec = { name: string; password: string };

export function getUsers(): UserRec[] {
  const raw = process.env.USERS || "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      return i > 0 ? { name: pair.slice(0, i).trim(), password: pair.slice(i + 1) } : null;
    })
    .filter((u): u is UserRec => !!u && !!u.name && !!u.password);
}

export function findUser(name: string): UserRec | undefined {
  const n = name.trim().toLowerCase();
  return getUsers().find((u) => u.name.toLowerCase() === n);
}

export function isAllowedUser(name: string): boolean {
  return !!findUser(name);
}

export function isAdmin(name: string): boolean {
  const first = getUsers()[0];
  return !!first && first.name.toLowerCase() === name.toLowerCase();
}
