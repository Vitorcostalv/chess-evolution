export async function GET() {
  return Response.json({
    status: "ok",
    application: "chess-evolution",
    storage: "indexeddb",
    remoteSync: false,
    training: "browser-workers",
    version: "1.0.0",
  });
}
