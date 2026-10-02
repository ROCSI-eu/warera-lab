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
  isRefreshing: boolean;
  message?: WorkspaceMessage | undefined;
  refreshMessage?: WorkspaceMessage | undefined;
}

export type WorkspaceAction =
  | { type: "query-changed"; query: string }
  | { type: "search-started" }
  | { type: "search-succeeded"; search: PlayerSearchResponse }
  | { type: "search-failed"; message: string }
  | { type: "import-started"; playerId: string }
  | { type: "import-succeeded"; snapshot: PublicPlayerSnapshotResponse }
  | { type: "import-failed"; message: string }
  | { type: "refresh-started" }
  | {
      type: "refresh-succeeded";
      snapshot: PublicPlayerSnapshotResponse;
      selectedCompanyId?: string | undefined;
      context?: EconomyPlannerContextResponse | undefined;
      message: string;
    }
  | { type: "refresh-failed"; message: string }
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
  isRefreshing: false,
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
        refreshMessage: undefined,
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
    case "refresh-started":
      return {
        ...state,
        isRefreshing: true,
        refreshMessage: {
          kind: "status",
          text: "Refreshing the live snapshot and Economy context…",
        },
      };
    case "refresh-succeeded":
      return {
        ...state,
        isRefreshing: false,
        snapshot: action.snapshot,
        selectedCompanyId: action.selectedCompanyId,
        economyContext: action.context,
        economyContextItemCode: action.context?.itemCode,
        isLoadingEconomyContext: false,
        refreshMessage: { kind: "status", text: action.message },
      };
    case "refresh-failed":
      return {
        ...state,
        isRefreshing: false,
        refreshMessage: { kind: "error", text: action.message },
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
