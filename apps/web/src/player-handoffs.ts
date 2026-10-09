import { publicItemCodeMaxLength, type PublicCompanySnapshot } from "@warera-lab/domain";

import { buildLabHref, type LabId, type LabRoute } from "./lab-navigation.js";

type HandoffLab = Extract<LabId, "economy" | "company" | "market">;
export interface HandoffLocation {
  pathname: string;
  search: string;
  hash: string;
}

/**
 * Pass only public identifiers, never a snapshot or scenario document.
 * The destination revalidates player/company data or refetches market item data.
 * Portable #wl= fragments are deliberately never copied into a lab handoff.
 */
export function playerHandoffHref(
  lab: HandoffLab,
  playerId: string,
  location: HandoffLocation,
  company?: PublicCompanySnapshot,
): string | undefined {
  // The player snapshot API accepts IDs up to 128 characters; route identities
  // allow up to 160. Never silently trim a record ID into a different identity.
  const validIdentity = (value: string, maxLength: number) =>
    value.length > 0 && value.length <= maxLength && value === value.trim();
  if (!validIdentity(playerId, 128) || (company && !validIdentity(company.id, 160))) {
    return undefined;
  }
  const itemCode = company?.itemCode.trim();
  if (lab === "market" && (!company || !itemCode || itemCode.length > publicItemCodeMaxLength)) {
    return undefined;
  }
  const route: LabRoute = {
    lab,
    playerId,
    ...(company ? { companyId: company.id } : {}),
    ...(lab === "market" && itemCode ? { itemCode } : {}),
  };
  return buildLabHref(route, { ...location, hash: "" });
}
