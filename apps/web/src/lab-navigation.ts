export type LabId = "economy" | "company";

export interface LabRoute {
  lab: LabId;
  playerId?: string;
  companyId?: string;
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

export function parseLabLocation(search: string): ParsedLabLocation {
  const params = new URLSearchParams(search);
  const requestedLab = params.get("lab");
  const lab: LabId = requestedLab === "company" ? "company" : "economy";
  const messages: string[] = [];

  if (requestedLab !== null && requestedLab !== "economy" && requestedLab !== "company") {
    messages.push("Unknown lab link. Economy Lab was opened instead.");
  }

  const rawPlayerId = params.get("player");
  const rawCompanyId = params.get("company");
  const playerId = parseIdentity(rawPlayerId);

  if (rawPlayerId !== null && playerId === undefined) {
    messages.push("The player context in this link is invalid. Search for the player again.");
  }

  if (playerId === undefined) {
    if (rawCompanyId !== null) {
      messages.push("A company link also needs a player context. Search for the player again.");
    }
    return {
      route: { lab },
      ...(messages.length > 0 ? { message: messages.join(" ") } : {}),
    };
  }

  const companyId = parseIdentity(rawCompanyId);
  if (rawCompanyId !== null && companyId === undefined) {
    messages.push("The company context in this link is invalid. Choose a company again.");
  }

  return {
    route: {
      lab,
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

  const query = params.toString();
  return location.pathname + (query.length > 0 ? "?" + query : "") + location.hash;
}

export function buildPortableScenarioHref(location: LocationParts, shareFragment: string): string {
  const params = new URLSearchParams(location.search);
  params.delete("lab");
  params.delete("player");
  params.delete("company");

  const query = params.toString();
  const fragment = shareFragment.startsWith("#") ? shareFragment : "#" + shareFragment;
  return location.pathname + (query.length > 0 ? "?" + query : "") + fragment;
}
