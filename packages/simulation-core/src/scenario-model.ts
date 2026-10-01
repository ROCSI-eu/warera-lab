import {
  companyUpgradeKeys,
  economySkillKeys,
  type CompanyUpgradeKey,
  type EconomySkillKey,
} from "@warera-lab/domain";

import { companyUpgradePlannerVersion } from "./company-upgrade-planner.js";
import {
  marketMarginComparisonVersion,
  marketMarginSimulatorVersion,
} from "./market-margin-simulator.js";
import { skillPlannerVersion } from "./skill-planner.js";

export const scenarioDocumentVersion = "warera-lab-scenario-v1" as const;
export const scenarioShareFragmentPrefix = "#wl=" as const;
export const scenarioShareFragmentMaxBytes = 8 * 1024;
export const scenarioJsonMaxBytes = 64 * 1024;

const maxInputPriceOverrides = 128;
const maxCodeLength = 64;
const maxMetadataLength = 128;

export type ScenarioDocumentVersion = typeof scenarioDocumentVersion;

export type ScenarioModelErrorCode =
  | "INVALID_PAYLOAD"
  | "MALFORMED_JSON"
  | "UNSUPPORTED_VERSION"
  | "JSON_PAYLOAD_TOO_LARGE"
  | "SHARE_PAYLOAD_TOO_LARGE";

export class ScenarioModelError extends Error {
  readonly code: ScenarioModelErrorCode;
  readonly path?: string;

  constructor(message: string, details: { code: ScenarioModelErrorCode; path?: string }) {
    super(message);
    this.name = "ScenarioModelError";
    this.code = details.code;
    if (details.path !== undefined) this.path = details.path;
  }
}

export interface ScenarioMarketInputV1 {
  itemCode: string;
  quantity: number;
  outputPriceOverride?: number;
  inputPriceOverrides: Record<string, number>;
  assumedLabourCostTotal?: number;
  assumedOtherCostTotal?: number;
}

export interface EconomyScenarioStateV1 {
  skills: Partial<Record<EconomySkillKey, number>>;
  companyItemCode?: string;
  companyUpgrades: Partial<Record<CompanyUpgradeKey, number>>;
  market?: ScenarioMarketInputV1;
}

export interface ScenarioCalculationVersionsV1 {
  skillPlanner: string;
  companyUpgradePlanner: string;
  marketMarginSimulator: string;
  marketMarginComparison: string;
}

export interface ScenarioConfigMetadataV1 {
  revision?: string;
  retrievedAt?: string;
}

export interface ScenarioSourcePlayerIdentityV1 {
  id: string;
  username: string;
}

export interface ScenarioSourceMetadataV1 {
  snapshotRetrievedAt?: string;
  player?: ScenarioSourcePlayerIdentityV1;
}

export interface ScenarioDocumentV1 {
  version: ScenarioDocumentVersion;
  calculationVersions: ScenarioCalculationVersionsV1;
  config: ScenarioConfigMetadataV1;
  scenarios: {
    baseline: EconomyScenarioStateV1;
    scenarioA: EconomyScenarioStateV1;
    scenarioB: EconomyScenarioStateV1;
  };
  source?: ScenarioSourceMetadataV1;
}

export interface CreateScenarioDocumentInput {
  baseline: EconomyScenarioStateV1;
  scenarioA: EconomyScenarioStateV1;
  scenarioB: EconomyScenarioStateV1;
  config?: ScenarioConfigMetadataV1;
  sourceSnapshotRetrievedAt?: string;
  sourcePlayer?: ScenarioSourcePlayerIdentityV1;
}

export interface CreateScenarioDocumentOptions {
  includeSourcePlayerIdentity?: boolean;
}

export interface ScenarioSerializationOptions {
  includeSourcePlayerIdentity?: boolean;
}

export interface ScenarioChangeV1 {
  path: string;
  from?: string | number;
  to?: string | number;
}

export interface ScenarioStateComparisonV1 {
  changes: ScenarioChangeV1[];
}

export interface ScenarioDocumentComparisonV1 {
  baselineToA: ScenarioStateComparisonV1;
  baselineToB: ScenarioStateComparisonV1;
  scenarioAToB: ScenarioStateComparisonV1;
}

type UnknownRecord = Record<string, unknown>;
type ComparableScenarioValue = string | number | undefined;

function fail(message: string, path?: string): never {
  throw new ScenarioModelError(message, {
    code: "INVALID_PAYLOAD",
    ...(path === undefined ? {} : { path }),
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) fail(`${path} must be an object.`, path);
  return value;
}

function assertKnownKeys(record: UnknownRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key))
      fail(`${path} contains unsupported field "${key}".`, `${path}.${key}`);
  }
}

function readString(value: unknown, path: string, options: { maxLength?: number } = {}): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${path} must be a non-empty string.`, path);
  }

  const maxLength = options.maxLength ?? maxMetadataLength;
  if (value.length > maxLength) {
    fail(`${path} exceeds the maximum length of ${maxLength} characters.`, path);
  }

  return value;
}

function readOptionalString(
  value: unknown,
  path: string,
  options: { maxLength?: number } = {},
): string | undefined {
  if (value === undefined) return undefined;
  return readString(value, path, options);
}

function readNonNegativeNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${path} must be a finite non-negative number.`, path);
  }
  return value;
}

function readPositiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(`${path} must be a finite positive number.`, path);
  }
  return value;
}

function readLevel(value: unknown, path: string): number {
  const level = readNonNegativeNumber(value, path);
  if (!Number.isInteger(level)) fail(`${path} must be an integer level.`, path);
  return level;
}

function readCode(value: unknown, path: string): string {
  const code = readString(value, path, { maxLength: maxCodeLength });
  if (code === "__proto__" || code === "prototype" || code === "constructor") {
    fail(`${path} uses a reserved code.`, path);
  }
  return code;
}

function parseLevelMap<K extends string>(
  value: unknown,
  path: string,
  allowedKeys: readonly K[],
): Partial<Record<K, number>> {
  if (value === undefined) return {};
  const record = requireRecord(value, path);
  assertKnownKeys(record, allowedKeys, path);

  const parsed: Partial<Record<K, number>> = {};
  for (const key of allowedKeys) {
    if (record[key] !== undefined) parsed[key] = readLevel(record[key], `${path}.${key}`);
  }
  return parsed;
}

function parseInputPriceOverrides(value: unknown, path: string): Record<string, number> {
  if (value === undefined) return {};
  const record = requireRecord(value, path);
  const entries = Object.entries(record);

  if (entries.length > maxInputPriceOverrides) {
    fail(`${path} exceeds the maximum of ${maxInputPriceOverrides} entries.`, path);
  }

  return Object.fromEntries(
    entries.map(([itemCode, price]) => {
      const code = readCode(itemCode, `${path} key`);
      return [code, readNonNegativeNumber(price, `${path}.${code}`)];
    }),
  );
}

function parseMarket(value: unknown, path: string): ScenarioMarketInputV1 | undefined {
  if (value === undefined) return undefined;
  const record = requireRecord(value, path);
  assertKnownKeys(
    record,
    [
      "itemCode",
      "quantity",
      "outputPriceOverride",
      "inputPriceOverrides",
      "assumedLabourCostTotal",
      "assumedOtherCostTotal",
    ],
    path,
  );

  const outputPriceOverride =
    record.outputPriceOverride === undefined
      ? undefined
      : readNonNegativeNumber(record.outputPriceOverride, `${path}.outputPriceOverride`);
  const assumedLabourCostTotal =
    record.assumedLabourCostTotal === undefined
      ? undefined
      : readNonNegativeNumber(record.assumedLabourCostTotal, `${path}.assumedLabourCostTotal`);
  const assumedOtherCostTotal =
    record.assumedOtherCostTotal === undefined
      ? undefined
      : readNonNegativeNumber(record.assumedOtherCostTotal, `${path}.assumedOtherCostTotal`);

  return {
    itemCode: readCode(record.itemCode, `${path}.itemCode`),
    quantity: readPositiveNumber(record.quantity, `${path}.quantity`),
    inputPriceOverrides: parseInputPriceOverrides(
      record.inputPriceOverrides,
      `${path}.inputPriceOverrides`,
    ),
    ...(outputPriceOverride === undefined ? {} : { outputPriceOverride }),
    ...(assumedLabourCostTotal === undefined ? {} : { assumedLabourCostTotal }),
    ...(assumedOtherCostTotal === undefined ? {} : { assumedOtherCostTotal }),
  };
}

function parseScenarioState(value: unknown, path: string): EconomyScenarioStateV1 {
  const record = requireRecord(value, path);
  assertKnownKeys(record, ["skills", "companyItemCode", "companyUpgrades", "market"], path);

  const companyItemCode = readOptionalString(record.companyItemCode, `${path}.companyItemCode`, {
    maxLength: maxCodeLength,
  });
  if (
    companyItemCode === "__proto__" ||
    companyItemCode === "prototype" ||
    companyItemCode === "constructor"
  ) {
    fail(`${path}.companyItemCode uses a reserved code.`, `${path}.companyItemCode`);
  }

  const market = parseMarket(record.market, `${path}.market`);

  return {
    skills: parseLevelMap(record.skills, `${path}.skills`, economySkillKeys),
    ...(companyItemCode === undefined ? {} : { companyItemCode }),
    companyUpgrades: parseLevelMap(
      record.companyUpgrades,
      `${path}.companyUpgrades`,
      companyUpgradeKeys,
    ),
    ...(market === undefined ? {} : { market }),
  };
}

function parseCalculationVersions(value: unknown): ScenarioCalculationVersionsV1 {
  const path = "calculationVersions";
  const record = requireRecord(value, path);
  assertKnownKeys(
    record,
    ["skillPlanner", "companyUpgradePlanner", "marketMarginSimulator", "marketMarginComparison"],
    path,
  );

  return {
    skillPlanner: readString(record.skillPlanner, `${path}.skillPlanner`, {
      maxLength: maxMetadataLength,
    }),
    companyUpgradePlanner: readString(
      record.companyUpgradePlanner,
      `${path}.companyUpgradePlanner`,
      { maxLength: maxMetadataLength },
    ),
    marketMarginSimulator: readString(
      record.marketMarginSimulator,
      `${path}.marketMarginSimulator`,
      { maxLength: maxMetadataLength },
    ),
    marketMarginComparison: readString(
      record.marketMarginComparison,
      `${path}.marketMarginComparison`,
      { maxLength: maxMetadataLength },
    ),
  };
}

function parseConfig(value: unknown): ScenarioConfigMetadataV1 {
  const path = "config";
  const record = value === undefined ? {} : requireRecord(value, path);
  assertKnownKeys(record, ["revision", "retrievedAt"], path);

  const revision = readOptionalString(record.revision, `${path}.revision`);
  const retrievedAt = readOptionalString(record.retrievedAt, `${path}.retrievedAt`);

  return {
    ...(revision === undefined ? {} : { revision }),
    ...(retrievedAt === undefined ? {} : { retrievedAt }),
  };
}

function parseSourcePlayer(value: unknown, path: string): ScenarioSourcePlayerIdentityV1 {
  const record = requireRecord(value, path);
  assertKnownKeys(record, ["id", "username"], path);
  return {
    id: readString(record.id, `${path}.id`),
    username: readString(record.username, `${path}.username`),
  };
}

function parseSource(value: unknown): ScenarioSourceMetadataV1 | undefined {
  if (value === undefined) return undefined;
  const path = "source";
  const record = requireRecord(value, path);
  assertKnownKeys(record, ["snapshotRetrievedAt", "player"], path);

  const snapshotRetrievedAt = readOptionalString(
    record.snapshotRetrievedAt,
    `${path}.snapshotRetrievedAt`,
  );
  const player =
    record.player === undefined ? undefined : parseSourcePlayer(record.player, `${path}.player`);

  return {
    ...(snapshotRetrievedAt === undefined ? {} : { snapshotRetrievedAt }),
    ...(player === undefined ? {} : { player }),
  };
}

export function parseScenarioDocument(value: unknown): ScenarioDocumentV1 {
  const record = requireRecord(value, "scenario");
  assertKnownKeys(
    record,
    ["version", "calculationVersions", "config", "scenarios", "source"],
    "scenario",
  );

  if (record.version !== scenarioDocumentVersion) {
    if (typeof record.version === "string") {
      throw new ScenarioModelError(`Unsupported scenario document version: ${record.version}.`, {
        code: "UNSUPPORTED_VERSION",
        path: "scenario.version",
      });
    }
    fail("scenario.version must be a supported version string.", "scenario.version");
  }

  const scenarios = requireRecord(record.scenarios, "scenarios");
  assertKnownKeys(scenarios, ["baseline", "scenarioA", "scenarioB"], "scenarios");
  const source = parseSource(record.source);

  return {
    version: scenarioDocumentVersion,
    calculationVersions: parseCalculationVersions(record.calculationVersions),
    config: parseConfig(record.config),
    scenarios: {
      baseline: parseScenarioState(scenarios.baseline, "scenarios.baseline"),
      scenarioA: parseScenarioState(scenarios.scenarioA, "scenarios.scenarioA"),
      scenarioB: parseScenarioState(scenarios.scenarioB, "scenarios.scenarioB"),
    },
    ...(source === undefined ? {} : { source }),
  };
}

export function createScenarioDocument(
  input: CreateScenarioDocumentInput,
  options: CreateScenarioDocumentOptions = {},
): ScenarioDocumentV1 {
  const includeSourcePlayerIdentity = options.includeSourcePlayerIdentity === true;
  const source =
    input.sourceSnapshotRetrievedAt !== undefined ||
    (includeSourcePlayerIdentity && input.sourcePlayer !== undefined)
      ? {
          ...(input.sourceSnapshotRetrievedAt === undefined
            ? {}
            : { snapshotRetrievedAt: input.sourceSnapshotRetrievedAt }),
          ...(!includeSourcePlayerIdentity || input.sourcePlayer === undefined
            ? {}
            : { player: input.sourcePlayer }),
        }
      : undefined;

  return parseScenarioDocument({
    version: scenarioDocumentVersion,
    calculationVersions: {
      skillPlanner: skillPlannerVersion,
      companyUpgradePlanner: companyUpgradePlannerVersion,
      marketMarginSimulator: marketMarginSimulatorVersion,
      marketMarginComparison: marketMarginComparisonVersion,
    },
    config: input.config ?? {},
    scenarios: {
      baseline: input.baseline,
      scenarioA: input.scenarioA,
      scenarioB: input.scenarioB,
    },
    ...(source === undefined ? {} : { source }),
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function prepareScenarioForSerialization(
  document: ScenarioDocumentV1,
  options: ScenarioSerializationOptions = {},
): ScenarioDocumentV1 {
  const normalized = parseScenarioDocument(document);
  if (options.includeSourcePlayerIdentity === true || normalized.source?.player === undefined) {
    return normalized;
  }

  return {
    version: normalized.version,
    calculationVersions: normalized.calculationVersions,
    config: normalized.config,
    scenarios: normalized.scenarios,
    ...(normalized.source.snapshotRetrievedAt === undefined
      ? {}
      : { source: { snapshotRetrievedAt: normalized.source.snapshotRetrievedAt } }),
  };
}

export function serializeScenarioJson(
  document: ScenarioDocumentV1,
  options: ScenarioSerializationOptions = {},
): string {
  const normalized = prepareScenarioForSerialization(document, options);
  const json = JSON.stringify(normalized);
  if (byteLength(json) > scenarioJsonMaxBytes) {
    throw new ScenarioModelError(`Scenario JSON exceeds the ${scenarioJsonMaxBytes}-byte limit.`, {
      code: "JSON_PAYLOAD_TOO_LARGE",
    });
  }
  return json;
}

export function parseScenarioJson(json: string): ScenarioDocumentV1 {
  if (byteLength(json) > scenarioJsonMaxBytes) {
    throw new ScenarioModelError(`Scenario JSON exceeds the ${scenarioJsonMaxBytes}-byte limit.`, {
      code: "JSON_PAYLOAD_TOO_LARGE",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ScenarioModelError("Scenario JSON is malformed.", { code: "MALFORMED_JSON" });
  }

  return parseScenarioDocument(parsed);
}

export function encodeScenarioFragment(
  document: ScenarioDocumentV1,
  options: ScenarioSerializationOptions = {},
): string {
  const fragment = `${scenarioShareFragmentPrefix}${encodeURIComponent(
    serializeScenarioJson(document, options),
  )}`;
  if (byteLength(fragment) > scenarioShareFragmentMaxBytes) {
    throw new ScenarioModelError(
      `Scenario share fragment exceeds the ${scenarioShareFragmentMaxBytes}-byte limit.`,
      { code: "SHARE_PAYLOAD_TOO_LARGE" },
    );
  }
  return fragment;
}

export function decodeScenarioFragment(fragment: string): ScenarioDocumentV1 {
  if (byteLength(fragment) > scenarioShareFragmentMaxBytes) {
    throw new ScenarioModelError(
      `Scenario share fragment exceeds the ${scenarioShareFragmentMaxBytes}-byte limit.`,
      { code: "SHARE_PAYLOAD_TOO_LARGE" },
    );
  }

  if (!fragment.startsWith(scenarioShareFragmentPrefix)) {
    throw new ScenarioModelError(
      `Scenario share fragment must start with ${scenarioShareFragmentPrefix}.`,
      { code: "INVALID_PAYLOAD", path: "fragment" },
    );
  }

  const encoded = fragment.slice(scenarioShareFragmentPrefix.length);
  let json: string;
  try {
    json = decodeURIComponent(encoded);
  } catch {
    throw new ScenarioModelError("Scenario share fragment is malformed.", {
      code: "INVALID_PAYLOAD",
      path: "fragment",
    });
  }

  return parseScenarioJson(json);
}

function addChange(
  changes: ScenarioChangeV1[],
  path: string,
  from: ComparableScenarioValue,
  to: ComparableScenarioValue,
): void {
  if (Object.is(from, to)) return;
  changes.push({
    path,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });
}

export function compareScenarioStates(
  from: EconomyScenarioStateV1,
  to: EconomyScenarioStateV1,
): ScenarioStateComparisonV1 {
  const normalizedFrom = parseScenarioState(from, "from");
  const normalizedTo = parseScenarioState(to, "to");
  const changes: ScenarioChangeV1[] = [];

  addChange(
    changes,
    "companyItemCode",
    normalizedFrom.companyItemCode,
    normalizedTo.companyItemCode,
  );

  for (const key of economySkillKeys) {
    addChange(changes, `skills.${key}`, normalizedFrom.skills[key], normalizedTo.skills[key]);
  }

  for (const key of companyUpgradeKeys) {
    addChange(
      changes,
      `companyUpgrades.${key}`,
      normalizedFrom.companyUpgrades[key],
      normalizedTo.companyUpgrades[key],
    );
  }

  addChange(
    changes,
    "market.itemCode",
    normalizedFrom.market?.itemCode,
    normalizedTo.market?.itemCode,
  );
  addChange(
    changes,
    "market.quantity",
    normalizedFrom.market?.quantity,
    normalizedTo.market?.quantity,
  );
  addChange(
    changes,
    "market.outputPriceOverride",
    normalizedFrom.market?.outputPriceOverride,
    normalizedTo.market?.outputPriceOverride,
  );

  const inputCodes = new Set([
    ...Object.keys(normalizedFrom.market?.inputPriceOverrides ?? {}),
    ...Object.keys(normalizedTo.market?.inputPriceOverrides ?? {}),
  ]);
  for (const itemCode of [...inputCodes].sort()) {
    addChange(
      changes,
      `market.inputPriceOverrides.${itemCode}`,
      normalizedFrom.market?.inputPriceOverrides[itemCode],
      normalizedTo.market?.inputPriceOverrides[itemCode],
    );
  }

  addChange(
    changes,
    "market.assumedLabourCostTotal",
    normalizedFrom.market?.assumedLabourCostTotal,
    normalizedTo.market?.assumedLabourCostTotal,
  );
  addChange(
    changes,
    "market.assumedOtherCostTotal",
    normalizedFrom.market?.assumedOtherCostTotal,
    normalizedTo.market?.assumedOtherCostTotal,
  );

  return { changes };
}

export function compareScenarioDocument(
  document: ScenarioDocumentV1,
): ScenarioDocumentComparisonV1 {
  const normalized = parseScenarioDocument(document);
  return {
    baselineToA: compareScenarioStates(
      normalized.scenarios.baseline,
      normalized.scenarios.scenarioA,
    ),
    baselineToB: compareScenarioStates(
      normalized.scenarios.baseline,
      normalized.scenarios.scenarioB,
    ),
    scenarioAToB: compareScenarioStates(
      normalized.scenarios.scenarioA,
      normalized.scenarios.scenarioB,
    ),
  };
}
