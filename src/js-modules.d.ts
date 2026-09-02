declare module "./lib/directory-model.mjs" {
  export const FORM_ENTITY_TYPES: readonly string[];
  export const ENTITY_TYPES: Record<
    string,
    { label: string; schema: string; official: boolean; sectionHint: string }
  >;
  export const SECTIONS: Record<string, { id: string }>;
  export function assembleEntities(sources: object): DirectoryEntity[];
  export function canClaim(entity: object): boolean;
  export function isOfficialEntity(entity: object): boolean;
  export function looksLikeEmail(value: string): boolean;
  export function looksLikeHttpUrl(value: string): boolean;
  export function plainText(value: string, max?: number): string;
  export function slugify(value: string): string;
}

declare module "./lib/markup.mjs" {
  export function plainPunctuation(value: unknown): string;
  export function renderBody(paragraphs: string[], isPoem?: boolean): string;
}

interface DirectoryEntity {
  slug: string;
  name: string;
  email?: string | null;
  entityType: string;
  official?: boolean;
  website?: string | null;
  social?: Array<{ platform?: string; url: string }>;
  address?: { street?: string; locality?: string } | null;
  serviceArea?: string | null;
  phone?: string | null;
  description?: string;
  descriptionShort?: string;
  meetingTimes?: string | null;
  accessibility?: string | null;
  notes_seasonal?: string | null;
  openingHours?: unknown;
  /**
   * Shaped rather than `object`, because whether a listing has been claimed is
   * read from it in the Worker and `object` made that a type error.
   */
  verification?: {
    email?: { value?: string | null; verifiedAt?: string | null; method?: string } | null;
    lastReviewedAt?: string | null;
    sourceKind?: string;
  } | null;
  status?: string;
  claimable?: boolean;
  section?: string;
}
