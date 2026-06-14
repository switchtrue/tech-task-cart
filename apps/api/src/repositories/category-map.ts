import { Category as DbCategory } from "../generated/prisma/client.js";
import type { Category as WireCategory } from "@cart/contracts";

const toWire: Record<DbCategory, WireCategory> = {
  [DbCategory.dry_food]: "dry-food",
  [DbCategory.wet_food]: "wet-food",
  [DbCategory.treats]: "treats",
  [DbCategory.toys]: "toys",
  [DbCategory.healthcare]: "healthcare",
};

const fromWire = Object.fromEntries(
  Object.entries(toWire).map(([db, wire]) => [wire, db]),
) as Record<WireCategory, DbCategory>;

export const categoryToWire = (c: DbCategory): WireCategory => toWire[c];
export const categoryFromWire = (c: WireCategory): DbCategory => fromWire[c];
