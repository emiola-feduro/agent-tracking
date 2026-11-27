import type { DodItem } from "./types";

/**
 * What can be handed to an agent to implement: a whole requirement while none of its Definition of
 * Done is done yet (one with criteria already met is continued criterion by criterion), and any
 * criterion not done yet.
 */
export const requirementImplementable = (dod: Pick<DodItem, "status">[]) => dod.every((d) => d.status !== "done");

export const dodImplementable = (item: Pick<DodItem, "status">) => item.status !== "done";
