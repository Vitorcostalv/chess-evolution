import { remoteEnabled } from "@/services/remote/security";
export async function GET() {
  return Response.json({
    enabled: remoteEnabled(),
    authentication: "signed-browser-session",
    weightsSync: false,
  });
}
