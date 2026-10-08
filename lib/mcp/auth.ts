import { adminDb } from "@/lib/firebase-admin";
import type { UserProfile } from "@/types/firestore/userProfileType";

export interface ResolvedMcpUser {
  userId: string;
  userEmail: string;
  userName?: string;
  currentPantryId: string;
  pantryIds: string[];
}

/**
 * Valida il Bearer token inviato dall'header Authorization e risolve l'utente
 * interrogando la collezione Firestore "users".
 */
export async function authenticateMcpRequest(authHeader: string | null): Promise<ResolvedMcpUser | null> {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return null;
  }

  try {
    const usersSnapshot = await adminDb
      .collection("users")
      .where("mcpToken", "==", token)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return null;
    }

    const userDoc = usersSnapshot.docs[0]!;
    const userData = userDoc.data() as UserProfile;

    const pantryIds = Array.isArray(userData.userProfilePantryIds)
      ? userData.userProfilePantryIds.filter(Boolean)
      : [];

    const currentPantryId =
      userData.userProfileCurrentPantryId ||
      (pantryIds.length > 0 ? pantryIds[0] : "") ||
      "";

    return {
      userId: userDoc.id,
      userEmail: userData.userEmail || "",
      userName: userData.userProfileName || undefined,
      currentPantryId,
      pantryIds,
    };
  } catch (error) {
    console.error("[MCP Auth Error] Errore verifica token:", error);
    return null;
  }
}
