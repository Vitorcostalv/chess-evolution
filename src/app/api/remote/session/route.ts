import {
  assertOrigin,
  rateLimit,
  createSession,
  failure,
} from "@/services/remote/security";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request);
    await createSession();
    return Response.json({ authenticated: true, expiresInDays: 30 });
  } catch (error) {
    return failure(error);
  }
}
