import type { Timestamp } from "firebase/firestore";

export type ProposedActionType =
  | "add_product"
  | "update_quantity"
  | "open_product"
  | "freeze_product"
  | "unfreeze_product"
  | "consume_product"
  | "add_to_shopping_list"
  | "add_memory_fact";

export interface ProposedAction {
  id: string; // ID univoco temporaneo per l'azione
  type: ProposedActionType;
  title: string;
  description: string;
  status: "pending" | "applied" | "cancelled";
  payload: {
    productId?: string;
    productName?: string;
    productQuantity?: number;
    productUnit?: string;
    productCategory?: string;
    productExpiryDate?: string; // YYYY-MM-DD
    shelfLifeDays?: number;
    // shopping list
    shoppingItemName?: string;
    // memory fact
    memoryFactText?: string;
    memoryFactCategory?: "diet" | "taste_dislike" | "taste_preference" | "cooking_habit" | "household" | "other";
  };
}

export interface AssistantErrorDetails {
  code?: string | number;
  message: string;
  technicalDetails?: string;
  retryText?: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Timestamp | number;
  proposedActions?: ProposedAction[];
  error?: AssistantErrorDetails;
}
