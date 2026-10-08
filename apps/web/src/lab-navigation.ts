import { publicItemCodeMaxLength } from "@warera-lab/domain";

export type LabId = "economy" | "company" | "market";

export interface LabRoute {
  lab: LabId;
  playerId?: string;
  companyId?: string;
  itemCode?: string;
}

export interface ParsedLabLocation {
  route: LabRoute;
  message?: string;
}

interface LocationParts {
  pathname: string;
  search: string;
  hash: string;
}

const maxIdentityLength = 160;

function parseIdentity(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxIdentityLength) return undefined;
  return trimmed;
}

function parseItemCode(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > publicItemCodeMaxLength) return undefined;
  return trimmed;
}

export function parseLabLocation(search: string): ParsedLabLocation {
  const params = new URLSearchParams(search);
  const requestedLab = params.get("lab");
  const lab: LabId =
    requestedLab === "company" || requestedLab === "market" ? requestedLab : "economy";
  const messages: string[] = [];

  if (
    requestedLab !== null &&
    requestedLab !== "economy" &&
    requestedLab !== "company" &&
    requestedLab !== "market"
  ) {
    messages.push("Unknown lab link. Economy Lab was opened instead.");
  }

  const rawItemCode = lab === "market" ? params.get("item") : null;
  const itemCode = parseItemCode(rawItemCode);
  if (rawItemCode !== null && itemCode === undefined) {
    messages.push("The item context in this link is invalid. Choose an item again.");
  }

  const rawPlayerId = params.get("player");
  const rawCompanyId = params.get("company");
  const playerId = parseIdentity(rawPlayerId);

  if (rawPlayerId !== null && playerId === undefined) {
    messages.push("The player context in this link is invalid. Search for the player again.");
  }

  const baseRoute: LabRoute = {
    lab,
    ...(itemCode === undefined ? {} : { itemCode }),
  };

  if (playerId === undefined) {
    if (rawCompanyId !== null) {
      messages.push("A company link also needs a player context. Search for the player again.");
    }
    return {
      route: baseRoute,
      ...(messages.length > 0 ? { message: messages.join(" ") } : {}),
    };
  }

  const companyId = parseIdentity(rawCompanyId);
  if (rawCompanyId !== null && companyId === undefined) {
    messages.push("The company context in this link is invalid. Choose a company again.");
  }

  return {
    route: {
      ...baseRoute,
      playerId,
      ...(companyId === undefined ? {} : { companyId }),
    },
    ...(messages.length > 0 ? { message: messages.join(" ") } : {}),
  };
}

export function buildLabHref(route: LabRoute, location: LocationParts): string {
  const params = new URLSearchParams(location.search);
  params.set("lab", route.lab);

  if (route.playerId) {
    params.set("player", route.playerId);
    if (route.companyId) params.set("company", route.companyId);
    else params.delete("company");
  } else {
    params.delete("player");
    params.delete("company");
  }

  if (route.lab === "market" && route.itemCode) {
    params.set("item", route.itemCode);
  } else {
    params.delete("item");
  }

  const query = params.toString();
  return location.pathname + (query.length > 0 ? "?" + query : "") + location.hash;
}

export function buildPortableScenarioHref(location: LocationParts, shareFragment: string): string {
  const params = new URLSearchParams(location.search);
  params.delete("lab");
  params.delete("player");
  params.delete("company");
  params.delete("item");

  const query = params.toString();
  const fragment = shareFragment.startsWith("#") ? shareFragment : "#" + shareFragment;
  return location.pathname + (query.length > 0 ? "?" + query : "") + fragment;
}
