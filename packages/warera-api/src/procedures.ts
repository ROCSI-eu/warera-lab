export const documentedMvpProcedures = [
  "search.searchAnything",
  "user.getUserLite",
  "company.getCompanies",
  "company.getById",
  "region.getById",
  "region.getRegionsObject",
  "country.getCountryById",
  "country.getAllCountries",
  "itemTrading.getPrices",
  "tradingOrder.getTopOrders",
  "gameConfig.getGameConfig",
] as const;

export type DocumentedMvpProcedure = (typeof documentedMvpProcedures)[number];

const documentedMvpProcedureSet = new Set<string>(documentedMvpProcedures);

export function isDocumentedMvpProcedure(value: string): value is DocumentedMvpProcedure {
  return documentedMvpProcedureSet.has(value);
}
