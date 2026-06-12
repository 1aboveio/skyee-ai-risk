export function GET(): Response {
  return Response.json({
    status: "ok",
    service: "skyee-graph-demo",
  });
}
