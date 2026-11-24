import { readFile } from "node:fs/promises";
import type { Stats } from "node:fs";

export interface User {
  id: string;
}

export type UserId = User["id"];

export enum Role {
  Admin,
  Member,
}

export const MAX_USERS = 10;
export let counter = 0;
const internalCache = new Map<string, User>();

export async function loadUser(id: UserId): Promise<User> {
  return JSON.parse(await readFile(id, "utf8"));
}

export const formatUser = (u: User) => u.id;

function helper() {
  return internalCache.size;
}

export abstract class Repository<T> {
  abstract find(id: string): T;
  async save(item: T) {
    return item;
  }
  onChange = () => helper();
  private static count = 0;
}

class Hidden {
  method() {}
}

export { Hidden as Visible };

export default function main() {}

declare global {
  interface Window {}
}
