import type { PlayerSearchResponse, PublicPlayerSnapshotResponse } from "@warera-lab/domain";

export interface WorkspaceMessage {
  kind: "error" | "status";
  text: string;
}

export interface WorkspaceState {
  query: string;
  isSearching: boolean;
  isImporting: boolean;
  pendingPlayerId?: string | undefined;
  search?: PlayerSearchResponse | undefined;
  snapshot?: PublicPlayerSnapshotResponse | undefined;
  selectedCompanyId?: string | undefined;
  message?: WorkspaceMessage | undefined;
}

export type WorkspaceAction =
  | { type: "query-changed"; query: string }
  | { type: "search-started" }
  | { type: "search-succeeded"; search: PlayerSearchResponse }
  | { type: "search-failed"; message: string }
  | { type: "import-started"; playerId: string }
  | { type: "import-succeeded"; snapshot: PublicPlayerSnapshotResponse }
  | { type: "import-failed"; message: string }
  | { type: "company-selected"; companyId: string };

export const initialWorkspaceState: WorkspaceState = {
  query: "",
  isSearching: false,
  isImporting: false,
};

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "query-changed":
      return { ...state, query: action.query };
    case "search-started":
      return {
        ...state,
        isSearching: true,
        message: { kind: "status", text: "Searching public WarEra players…" },
      };
    case "search-succeeded":
      return {
        ...state,
        isSearching: false,
        search: action.search,
        message:
          action.search.matches.length === 0
            ? { kind: "status", text: "No public players matched that search." }
            : undefined,
      };
    case "search-failed":
      return {
        ...state,
        isSearching: false,
        message: { kind: "error", text: action.message },
      };
    case "import-started":
      return {
        ...state,
        isImporting: true,
        pendingPlayerId: action.playerId,
        message: { kind: "status", text: "Importing the public economy snapshot…" },
      };
    case "import-succeeded":
      return {
        ...state,
        isImporting: false,
        pendingPlayerId: undefined,
        snapshot: action.snapshot,
        selectedCompanyId: action.snapshot.companies[0]?.id,
        message: undefined,
      };
    case "import-failed":
      return {
        ...state,
        isImporting: false,
        pendingPlayerId: undefined,
        message: { kind: "error", text: action.message },
      };
    case "company-selected":
      if (!state.snapshot?.companies.some((company) => company.id === action.companyId)) {
        return state;
      }
      return { ...state, selectedCompanyId: action.companyId };
  }
}
