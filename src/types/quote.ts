// Auto-generated from prisma/schema.prisma — canonical Quote shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface Quote {
  id: string;
  createdAt: string;
  updatedAt: string;
  text: string;
  author?: string | null;
  personalSuggestion?: string | null;
  displayDate: string;
  isFavourite: boolean;
  businessId: string;
  userId: string;
  challengeText?: string | null;
  challengeStatus?: string | null;
}
