import type {
  EconomyPlannerContextResponse,
  PlayerSearchResponse,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

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
  economyContext?: EconomyPlannerContextResponse | undefined;
  economyContextItemCode?: string | undefined;
  isLoadingEconomyContext: boolean;
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
  | { type: "company-selected"; companyId: string }
  | { type: "economy-context-started"; itemCode: string }
  | {
      type: "economy-context-succeeded";
      itemCode: string;
      context: EconomyPlannerContextResponse;
    }
  | { type: "economy-context-failed"; itemCode: string; message: string };

export const initialWorkspaceState: WorkspaceState = {
  query: "",
  isSearching: false,
  isImporting: false,
  isLoadingEconomyContext: false,
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
        economyContext: undefined,
        economyContextItemCode: undefined,
        isLoadingEconomyContext: false,
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
      return {
        ...state,
        selectedCompanyId: action.companyId,
        economyContext: undefined,
        economyContextItemCode: undefined,
      };
    case "economy-context-started":
      return {
        ...state,
        isLoadingEconomyContext: true,
        economyContextItemCode: action.itemCode,
        message: {
          kind: "status",
          text: "Loading live Economy Lab configuration and market references…",
        },
      };
    case "economy-context-succeeded":
      if (state.economyContextItemCode !== action.itemCode) return state;
      return {
        ...state,
        isLoadingEconomyContext: false,
        economyContext: action.context,
        message: undefined,
      };
    case "economy-context-failed":
      if (state.economyContextItemCode !== action.itemCode) return state;
      return {
        ...state,
        isLoadingEconomyContext: false,
        economyContext: undefined,
        message: { kind: "error", text: action.message },
      };
  }
}
