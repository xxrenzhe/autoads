// apps/frontend/src/app/api/workflows/start/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// Updated to use service discovery friendly name. 
// The frontend service can resolve 'workflow' because they are on the same docker network.
const WORKFLOW_SERVICE_URL = process.env.WORKFLOW_SERVICE_URL || 'http://workflow:8080';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { template_id, offer_id } = await req.json();

        if (!template_id || !offer_id) {
            return new Response(JSON.stringify({ error: 'Missing template_id or offer_id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const workflowRequest = {
            user_id: session.user.id,
            template_id,
            offer_id,
        };

        // Forward the request to the workflow microservice
        const response = await fetch(`${WORKFLOW_SERVICE_URL}/v1/workflows/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(workflowRequest),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Workflow service error:', errorBody);
            return new Response(JSON.stringify({ error: 'Failed to start workflow' }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in workflow start API route:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
