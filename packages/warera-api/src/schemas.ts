import { z } from "zod";

export const trpcSuccessEnvelopeSchema = z
  .object({
    result: z.object({ data: z.unknown() }).passthrough(),
  })
  .passthrough();

export const trpcErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        message: z.string(),
        data: z
          .object({
            code: z.string().optional(),
            httpStatus: z.number().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const economySkillSnapshotSchema = z.object({
  level: z.number(),
  value: z.number(),
  total: z.number(),
});

export const publicPlayerEconomySchema = z
  .object({
    _id: z.string(),
    username: z.string(),
    country: z.string(),
    leveling: z.object({
      level: z.number(),
      availableSkillPoints: z.number(),
      spentSkillPoints: z.number(),
      totalSkillPoints: z.number(),
    }),
    skills: z.object({
      production: economySkillSnapshotSchema,
      entrepreneurship: economySkillSnapshotSchema,
      management: economySkillSnapshotSchema,
      companies: economySkillSnapshotSchema,
    }),
  })
  .passthrough();

export const companySchema = z
  .object({
    _id: z.string(),
    user: z.string(),
    region: z.string(),
    itemCode: z.string(),
    name: z.string(),
    production: z.number().optional(),
    workerCount: z.number().optional(),
    activeUpgradeLevels: z
      .object({
        automatedEngine: z.number().optional(),
        storage: z.number().optional(),
        breakRoom: z.number().optional(),
      })
      .passthrough()
      .optional(),
    estimatedValue: z.number().optional(),
  })
  .passthrough();

export const companiesPageSchema = z
  .object({
    items: z.array(companySchema),
    nextCursor: z.string().nullish(),
  })
  .passthrough();

export const searchResultSchema = z
  .object({
    userIds: z.array(z.string()),
    muIds: z.array(z.string()),
    countryIds: z.array(z.string()),
    regionIds: z.array(z.string()),
    partyIds: z.array(z.string()),
    hasData: z.boolean(),
  })
  .passthrough();

export const regionSchema = z
  .object({
    _id: z.string(),
    code: z.string(),
    country: z.string(),
    name: z.string(),
    development: z.number(),
    baseDevelopment: z.number(),
    countryCode: z.string(),
    isCapital: z.boolean(),
    isLinkedToCapital: z.boolean(),
    biome: z.string().optional(),
    climate: z.string().optional(),
  })
  .passthrough();

const countryTaxesSchema = z.object({
  income: z.number(),
  market: z.number(),
  selfWork: z.number(),
});

export const countrySchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    code: z.string(),
    development: z.number().optional(),
    specializedItem: z.string().optional(),
    taxes: countryTaxesSchema.optional(),
    strategicResources: z
      .object({
        bonuses: z
          .object({
            productionPercent: z.number().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const countriesSchema = z.array(countrySchema);
export const regionsObjectSchema = z.record(z.string(), regionSchema);
export const marketPricesSchema = z.record(z.string(), z.number());

const marketOrderSchema = z
  .object({
    _id: z.string(),
    user: z.string(),
    itemCode: z.string(),
    quantity: z.number(),
    price: z.number(),
    type: z.enum(["buy", "sell"]),
    offerAt: z.string().optional(),
  })
  .passthrough();

export const marketOrderBookSchema = z
  .object({
    buyOrders: z.array(marketOrderSchema),
    sellOrders: z.array(marketOrderSchema),
  })
  .passthrough();

const skillLevelConfigSchema = z
  .object({
    value: z.number(),
    totalCost: z.number(),
    cost: z.number().optional(),
    unlockAtLevel: z.number(),
  })
  .passthrough();

const skillConfigSchema = z.object({
  levels: z.record(z.string(), skillLevelConfigSchema),
});

const itemConfigSchema = z
  .object({
    type: z.string(),
    code: z.string(),
    rarity: z.string(),
    productionPoints: z.number().optional(),
    productionNeeds: z.record(z.string(), z.number()).optional(),
    isTradable: z.boolean().optional(),
  })
  .passthrough();

const companyUpgradeLevelSchema = z
  .object({
    level: z.number(),
    steelCost: z.number(),
    constructionPointsCost: z.number().optional(),
    stats: z
      .object({
        dailyProd: z.number().optional(),
        maxProduction: z.number().optional(),
        maxWorkers: z.number().optional(),
        dailyHires: z.number().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const companyUpgradeSchema = z
  .object({
    canDowngrade: z.boolean().optional(),
    pendingDurationHours: z.number().optional(),
    levels: z.record(z.string(), companyUpgradeLevelSchema),
  })
  .passthrough();

export const economyGameConfigSchema = z
  .object({
    skills: z.object({
      production: skillConfigSchema,
      entrepreneurship: skillConfigSchema,
      management: skillConfigSchema,
      companies: skillConfigSchema,
    }),
    items: z.record(z.string(), itemConfigSchema),
    upgradesConfig: z.object({
      automatedEngine: companyUpgradeSchema,
      storage: companyUpgradeSchema,
      breakRoom: companyUpgradeSchema,
    }),
    company: z
      .object({
        depositResourceBonus: z.number().optional(),
        moveCost: z.number().optional(),
        changeItemCost: z.number().optional(),
      })
      .passthrough(),
    worker: z
      .object({
        maxFidelity: z.number().optional(),
        fidelityProductionBonusPercent: z.number().optional(),
      })
      .passthrough(),
  })
  .passthrough();
