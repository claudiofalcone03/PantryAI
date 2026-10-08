import { NextRequest, NextResponse } from "next/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { MCP_TOOLS, executeMcpTool } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET Handler per handshake SSE e informazioni server MCP
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const user = await authenticateMcpRequest(authHeader);

  if (!user) {
    return NextResponse.json(
      {
        error: "Non autorizzato. Includi l'header 'Authorization: Bearer <il-tuo-token-mcp>' recuperabile dalla pagina Profilo.",
      },
      { status: 401 }
    );
  }

  // Risponde con metadati server MCP
  return NextResponse.json({
    name: "pantry-ai-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    description: "Server MCP remoto ufficiale di PantryAI per Antigravity",
    user: {
      email: user.userEmail,
      name: user.userName,
      currentPantryId: user.currentPantryId,
      pantriesCount: user.pantryIds.length,
    },
    toolsCount: MCP_TOOLS.length,
  });
}

/**
 * POST Handler per protocollo MCP JSON-RPC 2.0 (Streamable HTTP / JSON-RPC)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const user = await authenticateMcpRequest(authHeader);

  if (!user) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Autenticazione fallita. Token Personale MCP non valido o revocato.",
        },
        id: null,
      },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: JSON non valido" },
        id: null,
      },
      { status: 400 }
    );
  }

  const { jsonrpc, id, method, params } = body;

  // Risposta standard JSON-RPC
  const sendResult = (result: any) =>
    NextResponse.json({
      jsonrpc: "2.0",
      id: id ?? null,
      result,
    });

  const sendError = (code: number, message: string) =>
    NextResponse.json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    });

  try {
    switch (method) {
      // ---------------------------------------------------------
      // INIZIALIZZAZIONE MCP
      // ---------------------------------------------------------
      case "initialize": {
        return sendResult({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: "pantry-ai-mcp",
            version: "1.0.0",
          },
          instructions:
            `Benvenuto nel server MCP di PantryAI per ${user.userName || user.userEmail}. ` +
            `Dispensa attiva corrente: ${user.currentPantryId}. ` +
            "Puoi gestire scorte, aggiungere e togliere cibi, consultare la spesa, generare ricette salva-dispensa e tracciare lo spreco.",
        });
      }

      // Notifica di completamento handshake
      case "notifications/initialized": {
        return new NextResponse(null, { status: 204 });
      }

      // Ping liveness
      case "ping": {
        return sendResult({});
      }

      // ---------------------------------------------------------
      // TOOLS LIST
      // ---------------------------------------------------------
      case "tools/list": {
        return sendResult({
          tools: MCP_TOOLS,
        });
      }

      // ---------------------------------------------------------
      // TOOLS CALL
      // ---------------------------------------------------------
      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          return sendError(-32602, "Parametro 'name' del tool obbligatorio");
        }

        const output = await executeMcpTool(toolName, toolArgs, user);

        return sendResult({
          content: [
            {
              type: "text",
              text: output.text,
            },
          ],
        });
      }

      // ---------------------------------------------------------
      // PROMPTS LIST
      // ---------------------------------------------------------
      case "prompts/list": {
        return sendResult({
          prompts: [
            {
              name: "pantry_audit",
              description: "Esegue un'ispezione approfondita della dispensa, evidenziando cibi aperti, scadenze e suggerendo un piano d'azione anti-spreco.",
            },
            {
              name: "meal_plan_from_pantry",
              description: "Pianifica i pasti dei prossimi giorni massimizzando l'impiego delle scorte attuali e riducendo gli sprechi.",
            },
          ],
        });
      }

      // ---------------------------------------------------------
      // RESOURCES LIST
      // ---------------------------------------------------------
      case "resources/list": {
        return sendResult({
          resources: [
            {
              uri: "pantry://current/inventory",
              name: "Inventario Dispensa Attuale",
              mimeType: "application/json",
              description: "Stato in tempo reale degli alimenti nella dispensa attiva",
            },
            {
              uri: "pantry://current/shopping-list",
              name: "Lista della Spesa Attuale",
              mimeType: "application/json",
              description: "Elenco articoli da acquistare per la dispensa attiva",
            },
          ],
        });
      }

      default:
        return sendError(-32601, `Metodo '${method}' non supportato`);
    }
  } catch (error: any) {
    console.error(`[MCP Tool Error] Metodo ${method} fallito:`, error);
    return sendError(-32000, error.message || "Errore interno durante l'esecuzione del tool MCP");
  }
}
