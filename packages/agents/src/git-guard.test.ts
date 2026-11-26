import { describe, expect, test } from "bun:test";
import { gitGuard } from "./git-guard";

const onMain = { protected: ["main", "master"], current: "main" };
const onFeature = { protected: ["main", "master"], current: "feat/pagos" };

describe("gitGuard", () => {
  test.each([
    ["git branch -D main", onFeature],
    ["git branch --delete master", onFeature],
    ["cd repo && git branch -d -f main", onFeature],
    ["git branch -m main old-main", onFeature],
    ["git branch -M nueva", onMain],
    ["git branch -f main HEAD~3", onFeature],
    ["git push origin --delete main", onFeature],
    ["git push origin :main", onFeature],
    ["git push -f origin main", onFeature],
    ["git push --force-with-lease", onMain],
    ["git push origin +HEAD:refs/heads/main", onFeature],
    ["git push --mirror", onFeature],
    ["git checkout --orphan nueva", onFeature],
    ["git switch --orphan nueva", onFeature],
    ["git checkout -B main", onFeature],
    ["git switch -C main origin/main", onFeature],
    ["git reset --hard HEAD~2", onMain],
    ["git update-ref -d refs/heads/main", onFeature],
    ["git clean -fdx", onFeature],
    ["git -C /repo -c core.x=1 clean --force", onFeature],
    ["git filter-branch --tree-filter x", onFeature],
    ['echo hecho; git "branch" -D "main"', onFeature],
  ])("stops %s", (command, ctx) => {
    expect(gitGuard(command, ctx)).toBeString();
  });

  test.each([
    ["git switch -c feat/pagos", onMain],
    ["git branch -d feat/viejo", onMain],
    ["git push -u origin feat/pagos", onFeature],
    ["git push --force-with-lease origin feat/pagos", onFeature],
    ["git push -f", onFeature],
    ["git reset --hard origin/feat/pagos", onFeature],
    ["git reset HEAD~1", onMain],
    ['git commit -m "branch -D main en el mensaje"', onFeature],
    ["git status && git log --oneline -5 2>&1 | head", onMain],
    ["git checkout main", onFeature],
    ["git clean -n", onFeature],
    ["npm test", onMain],
  ])("allows %s", (command, ctx) => {
    expect(gitGuard(command, ctx)).toBeNull();
  });
});
