import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// 从环境变量中获取Go微服务的地址
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://localhost:8081";

/**
 * A generic handler to proxy requests to the Billing microservice.
 */
async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const path = params.path ? params.path.join("/") : "";
    const url = `${BILLING_SERVICE_URL}/${path}`;

    const headers = new Headers(req.headers);
    headers.set("X-User-Id", session.user.id);

    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
      // Duplex must be set for streaming request bodies
      // @ts-ignore
      duplex: 'half',
    });
    
    // Handle potential empty responses
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return new NextResponse(null, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error(`Failed to proxy request to billing service:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
