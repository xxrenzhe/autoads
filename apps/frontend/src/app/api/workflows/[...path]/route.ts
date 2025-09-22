import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/v5-config";
import { NextRequest, NextResponse } from "next/server";

// Workflow服务地址：容器内优先使用服务名，其次回退到本地映射端口
const WORKFLOW_SERVICE_URL = process.env.WORKFLOW_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://workflow:8080' : 'http://localhost:8087');

/**
 * A generic handler to proxy requests to the Workflow microservice.
 * It captures all paths under /api/workflows/* and forwards them.
 * @param req The incoming Next.js request.
 * @param context Context object containing dynamic path parameters.
 */
async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const path = params.path ? params.path.join("/") : "";
    const url = `${WORKFLOW_SERVICE_URL}/api/v1/workflows/${path}`;

    const headers = new Headers(req.headers);
    headers.set("X-User-Id", session.user.id);

    // For GET requests, we don't forward a body
    if (req.method === 'GET') {
        const response = await fetch(url, {
            method: "GET",
            headers,
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    }

    // For POST, PUT, etc., we forward the body
    const body = await req.json();
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: JSON.stringify(body),
    });
    
    // Handle potential empty responses
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return new NextResponse(null, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error(`Failed to proxy request to workflow service:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
