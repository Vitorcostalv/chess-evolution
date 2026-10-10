import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
const globalDb = globalThis as unknown as { chessPrisma?: PrismaClient };
export function remoteEnabled() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.AUTH_SECRET &&
    process.env.AUTH_SECRET.length >= 32,
  );
}
export function remoteDb() {
  if (!remoteEnabled())
    throw new RemoteError(503, "Sincronização remota não configurada.");
  return globalDb.chessPrisma ?? (globalDb.chessPrisma = new PrismaClient());
}
export class RemoteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin,
    origin = request.headers.get("origin");
  if (
    (origin && origin !== expected) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.method !== "GET" && origin !== expected)
  )
    throw new RemoteError(403, "Origem não autorizada.");
}
function sign(value: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update(value)
    .digest("base64url");
}
export function validateToken(token: string, now = Date.now()) {
  const [id, expiry, signature] = token.split(".");
  if (
    !id ||
    !/^\d+$/.test(expiry) ||
    !signature ||
    !/^[0-9a-f-]{36}$/i.test(id)
  )
    return null;
  const expected = Buffer.from(sign(`${id}.${expiry}`)),
    actual = Buffer.from(signature);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual) ||
    Number(expiry) < now
  )
    return null;
  return id;
}
export async function owner() {
  remoteDb();
  const token = (await cookies()).get("chess-session")?.value;
  const id = token ? validateToken(token) : null;
  if (!id) throw new RemoteError(401, "Inicie uma sessão remota.");
  return id;
}
export async function createSession() {
  const jar = await cookies(),
    existing = jar.get("chess-session")?.value,
    id = (existing ? validateToken(existing) : null) ?? randomUUID();
  await remoteDb().user.upsert({ where: { id }, create: { id }, update: {} });
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000,
    value = `${id}.${expiry}`;
  jar.set("chess-session", `${value}.${sign(value)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return id;
}
export async function rateLimit(request: Request) {
  const db = remoteDb(),
    window = Math.floor(Date.now() / 60000),
    ip =
      request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for") ??
      "local";
  const key = sign(`${ip}:${window}`).slice(0, 48) + ":" + window;
  const bucket = await db.rateBucket.upsert({
    where: { id: key },
    create: { id: key, count: 1, expiresAt: new Date(Date.now() + 120000) },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > 30)
    throw new RemoteError(429, "Limite de 30 requisições por minuto.");
  await db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
export async function body(request: Request, max = 262144) {
  if (Number(request.headers.get("content-length")) > max)
    throw new RemoteError(413, "Payload excede o limite.");
  const reader = request.body?.getReader();
  if (!reader) throw new RemoteError(400, "Payload ausente.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new RemoteError(413, "Payload excede o limite.");
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    throw new RemoteError(400, "JSON inválido.");
  }
}
export function failure(error: unknown) {
  if (error instanceof RemoteError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  return Response.json(
    { error: "Serviço remoto indisponível. Dados locais preservados." },
    { status: 503 },
  );
}
