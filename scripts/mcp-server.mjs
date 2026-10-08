#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { adminDb } from "../lib/firebase-admin.js";
import { MCP_TOOLS, executeMcpTool } from "../lib/mcp/tools.js";
import type { ResolvedMcpUser } from "../lib/mcp/auth.js";

async function main() {
  const token = process.env.PANTRY_MCP_TOKEN || process.env.MCP_TOKEN;

  let resolvedUser: ResolvedMcpUser | null = null;

  if (token) {
    try {
      const snap = await adminDb
        .collection("users")
        .where("mcpToken", "==", token)
        .limit(1)
        .get();

      if (!snap.empty) {
        const uDoc = snap.docs[0]!;
        const uData = uDoc.data();
        const pantryIds = Array.isArray(uData.userProfilePantryIds)
          ? uData.userProfilePantryIds.filter(Boolean)
          : [];
        resolvedUser = {
          userId: uDoc.id,
          userEmail: uData.userEmail || "",
          userName: uData.userProfileName || undefined,
          currentPantryId:
            uData.userProfileCurrentPantryId || (pantryIds.length > 0 ? pantryIds[0] : ""),
          pantryIds,
        };
      }
    } catch (err) {
      console.error("[PantryAI MCP CLI] Errore risoluzione token:", err);
    }
  }

  // Fallback: se nessun token specifico è impostato, recupera il primo utente con dispensa valida
  if (!resolvedUser) {
    try {
      const usersSnap = await adminDb.collection("users").limit(1).get();
      if (!usersSnap.empty) {
        const uDoc = usersSnap.docs[0]!;
        const uData = uDoc.data();
        const pantryIds = Array.isArray(uData.userProfilePantryIds)
          ? uData.userProfilePantryIds.filter(Boolean)
          : [];
        resolvedUser = {
          userId: uDoc.id,
          userEmail: uData.userEmail || "",
          userName: uData.userProfileName || undefined,
          currentPantryId:
            uData.userProfileCurrentPantryId || (pantryIds.length > 0 ? pantryIds[0] : ""),
          pantryIds,
        };
      }
    } catch (err) {
      console.error("[PantryAI MCP CLI] Errore fallback utente:", err);
    }
  }

  if (!resolvedUser) {
    resolvedUser = {
      userId: "local-user",
      userEmail: "local@pantryai.app",
      currentPantryId: process.env.PANTRY_ID || "",
      pantryIds: [process.env.PANTRY_ID || ""].filter(Boolean),
    };
  }

  const server = new Server(
    {
      name: "pantry-ai",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // List Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: MCP_TOOLS,
    };
  });

  // Call Tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const output = await executeMcpTool(name, args || {}, resolvedUser!);
      return {
        content: [
          {
            type: "text",
            text: output.text,
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Errore tool ${name}: ${error.message || String(error)}`,
          },
        ],
      };
    }
  });

  // List Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "pantry://current/inventory",
          name: "Inventario Dispensa Attuale",
          mimeType: "application/json",
          description: "Stato in tempo reale degli alimenti nella dispensa attiva",
        },
      ],
    };
  });

  // List Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "pantry_audit",
          description: "Ispezione anti-spreco della dispensa",
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting PantryAI MCP server:", err);
  process.exit(1);
});
