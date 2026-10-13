export type {
  DetectedProductItem,
  VoiceActionType,
  ExistingPantryProduct,
  ParsedVoiceItem,
  VoiceParsingResult,
  AIPerDayMealSlot,
  AIMealPlanResponse,
  PantryCopilotContext,
  PantryCopilotResult,
  DetectedMemoryFact,
  GenkitFlowMetadata,
} from "./flows";

export interface IdentifiedProductResult {
  productName: string;
  productCategory: string;
  success: boolean;
}

export interface PantryContextProduct {
  name: string;
  quantity: string | number;
  category?: string;
  expiryDate?: string;
  isExpiringSoon?: boolean;
}
