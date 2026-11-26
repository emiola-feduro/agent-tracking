import {
  type CommitConventions,
  defaultTestTypes,
  kindPlatforms,
  newPart,
  partsProblems,
  PROJECT_KIND_INFO,
  recommendStack,
  suggestPartPath,
  summarizeParts,
  toggleStackOption,
  type ProjectPart,
  type ProjectStructure,
  type TestType,
} from "@agent-tracking/core";
import { create } from "zustand";
import type {
  AgentKind,
  AssistantBrief,
  GithubPublish,
  DiscoveredSkill,
  GithubFileKind,
  Platform,
  ProjectKind,
  RepoInspection,
  RequirementArea,
  RequirementType,
} from "@/lib/api";

export const WIZARD_STEPS = [
  { id: "source", label: "Origen" },
  { id: "basics", label: "Proyecto" },
  { id: "stack", label: "Stack" },
  { id: "skills", label: "Skills" },
  { id: "goal", label: "Objetivo y reglas" },
  { id: "requirements", label: "Requerimientos" },
  { id: "summary", label: "Resumen" },
] as const;

export type StepId = (typeof WIZARD_STEPS)[number]["id"];
export type SourceKind = "scratch" | "new" | "local" | "github";
export type SelectedSkill = DiscoveredSkill & { key: string };
export type RequirementDraft = {
  key: string;
  title: string;
  description: string;
  /** null: deduced from the text when the project is created. */
  type: RequirementType | null;
  area: RequirementArea | null;
  /** Criteria written by the person. */
  dod: string[];
  /** Criteria suggested by the assistant and accepted; saved with origin "llm". */
  llmDod: string[];
  /** Pieces of the monorepo it touches. */
  parts: string[];
};

type WizardData = {
  step: number;
  /** Furthest step reached, so breadcrumbs can jump back and forward again. */
  reached: number;
  source: SourceKind;
  repo: RepoInspection | null;
  /** Starter `.github` files to write into the repo when the project is created. */
  githubFiles: GithubFileKind[];
  /** Create the repository on GitHub too (only for local repos without a remote). */
  publish: (GithubPublish & { enabled: boolean }) | null;
  /** null: the default conventions (Conventional Commits). */
  commitConventions: CommitConventions | null;
  /** Agents that will work on the project; their instruction files get the Agent Tracking block. */
  agents: AgentKind[];
  /** Pull request template as edited in the summary; null until edited (then it follows the requirements). */
  prTemplate: string | null;
  name: string;
  kind: ProjectKind;
  /** Only chosen for a full app; other kinds have fixed platforms (see PROJECT_KIND_INFO). */
  platforms: Platform[];
  repoUrl: string;
  stack: string[];
  databases: string[];
  stackTouched: boolean;
  /** One app, or a monorepo of pieces, each with its own kind, platforms, folder and stack. */
  structure: ProjectStructure;
  parts: ProjectPart[];
  /** Pieces whose stack the person edited (the recommendation no longer replaces it). */
  partsTouched: string[];
  /** Piece shown in the stack step. */
  activePart: string | null;
  /** null: the recommended one for the languages of the pieces. */
  monorepoTool: string | null;
  /** null: the defaults for the kind of project. */
  testTypes: TestType[] | null;
  /** Write the starting folders and manifests into the repository. */
  scaffold: boolean;
  skills: Record<string, SelectedSkill>;
  skillsPreselected: boolean;
  /** Why the assistant preselected a skill, by skill key. */
  skillReasons: Record<string, string>;
  goal: string;
  rules: string[];
  requirements: RequirementDraft[];
};

type WizardActions = {
  goTo: (step: number) => void;
  setSource: (source: SourceKind) => void;
  setRepo: (repo: RepoInspection | null) => void;
  toggleGithubFile: (kind: GithubFileKind) => void;
  setKind: (kind: ProjectKind) => void;
  patch: (data: Partial<WizardData>) => void;
  togglePlatform: (platform: Platform) => void;
  toggleIn: (field: "stack" | "databases", value: string) => void;
  /** Replaces the stack of the project, or of the piece being edited in a monorepo. */
  setStack: (stack: string[], databases: string[] | null, touched: boolean) => void;
  setStructure: (structure: ProjectStructure) => void;
  addPart: (kind: ProjectPart["kind"]) => void;
  updatePart: (id: string, data: Partial<Omit<ProjectPart, "id">>) => void;
  removePart: (id: string) => void;
  toggleTestType: (type: TestType) => void;
  toggleSkill: (skill: SelectedSkill) => void;
  setRequirement: (key: string, data: Partial<RequirementDraft>) => void;
  addRequirement: () => void;
  removeRequirement: (key: string) => void;
  /** Adds imported requirements, replacing the empty draft the step starts with. */
  importRequirements: (list: { title: string; description: string; type: RequirementType; area: RequirementArea; dod: string[] }[]) => void;
  reset: () => void;
};

const newRequirement = (): RequirementDraft => ({
  key: crypto.randomUUID(),
  title: "",
  description: "",
  type: null,
  area: null,
  dod: [""],
  llmDod: [],
  parts: [],
});

const initial = (): WizardData => ({
  step: 0,
  reached: 0,
  source: "scratch",
  repo: null,
  githubFiles: [],
  publish: null,
  commitConventions: null,
  agents: [],
  prTemplate: null,
  name: "",
  kind: "fullstack",
  platforms: [],
  repoUrl: "",
  stack: [],
  databases: [],
  stackTouched: false,
  structure: "single",
  parts: [],
  partsTouched: [],
  activePart: null,
  monorepoTool: null,
  testTypes: null,
  scaffold: false,
  skills: {},
  skillsPreselected: false,
  skillReasons: {},
  goal: "",
  rules: [""],
  requirements: [newRequirement()],
});

const toggle = <T>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

const useWizardStore = create<WizardData & WizardActions>((set) => ({
  ...initial(),
  goTo: (step) => set((s) => ({ step, reached: Math.max(s.reached, step) })),
  // A brand-new repo starts with CI and a PR template; existing repos opt in.
  // A brand-new repo also starts with its folders and manifests.
  setSource: (source) => set({ source, repo: null, githubFiles: source === "new" ? ["ci", "prTemplate"] : [], scaffold: source === "new" }),
  toggleGithubFile: (kind) => set((s) => ({ githubFiles: toggle(s.githubFiles, kind) })),
  // Another kind of project brings another recommendation, so the stack follows it again.
  setKind: (kind) => set((s) => (s.kind === kind ? {} : { kind, stackTouched: false })),
  setRepo: (repo) =>
    set((s) => ({
      repo,
      name: repo && !s.name ? repo.repo.name : s.name,
      publish: null,
      repoUrl: repo?.repo.remoteUrl ?? s.repoUrl,
      // A different repo can expose different repo-level skills.
      skillsPreselected: false,
      // A repo that is already a monorepo brings its pieces, unless some were set up already.
      ...(repo?.structure && s.parts.length === 0
        ? {
            structure: repo.structure.structure,
            parts: repo.structure.parts,
            partsTouched: repo.structure.parts.map((p) => p.id),
            activePart: repo.structure.parts[0]?.id ?? null,
            monorepoTool: repo.structure.tool,
          }
        : {}),
    })),
  patch: (data) => set(data),
  togglePlatform: (platform) => set((s) => ({ platforms: toggle(s.platforms, platform) })),
  // The stack keeps exclusive groups and requirements consistent; databases are a free list.
  toggleIn: (field, value) =>
    set((s) => {
      if (field === "databases") return { databases: toggle(s.databases, value), stackTouched: true };
      const part = activePartOf(s);
      if (!part) return { stack: toggleStackOption(s.stack, value), stackTouched: true };
      return withPart(s, part.id, { stack: toggleStackOption(part.stack, value) }, true);
    }),
  setStack: (stack, databases, touched) =>
    set((s) => {
      const part = activePartOf(s);
      const dbs = databases === null ? {} : { databases };
      if (!part) return { stack, ...dbs, stackTouched: touched };
      // Databases are shared by the pieces: a piece's recommendation only adds to them.
      const merged = databases === null ? {} : { databases: [...new Set([...s.databases, ...databases])] };
      return { ...withPart(s, part.id, { stack }, touched), ...(touched ? dbs : merged) };
    }),
  setStructure: (structure) =>
    set((s) => {
      if (structure === s.structure) return {};
      if (structure === "single") return { structure };
      // The first pieces come from what was described so far: a full app splits into its
      // interfaces (one per platform) and its API.
      const seed = (): ProjectPart[] => {
        if (s.kind !== "fullstack") return [recommended({ ...newPart(s.kind), platforms: kindPlatforms(s.kind, s.platforms) })];
        const out: ProjectPart[] = [];
        const kinds: ProjectPart["kind"][] = [
          ...(s.platforms.includes("web") || s.platforms.length === 0 ? (["frontend"] as const) : []),
          ...(s.platforms.includes("mobile") ? (["mobile"] as const) : []),
          ...(s.platforms.includes("desktop") ? (["desktop"] as const) : []),
          "api",
        ];
        for (const kind of kinds) out.push(recommended(newPart(kind, out)));
        return out;
      };
      const parts = s.parts.length ? s.parts : seed();
      return { structure, parts, activePart: s.activePart ?? parts[0]!.id };
    }),
  addPart: (kind) =>
    set((s) => {
      const part = recommended(newPart(kind, s.parts));
      return { parts: [...s.parts, part], activePart: s.activePart ?? part.id };
    }),
  updatePart: (id, data) =>
    set((s) => {
      const current = s.parts.find((p) => p.id === id);
      if (!current) return {};
      const others = s.parts.filter((p) => p.id !== id).map((p) => p.path);
      const next = { ...current, ...data };
      // The folder follows the name and kind until the person writes one of their own.
      if (data.path === undefined && current.path === suggestPartPath(current.kind, current.name, others)) {
        next.path = suggestPartPath(next.kind, next.name, others);
      }
      if (data.kind && data.kind !== current.kind) {
        next.platforms = PROJECT_KIND_INFO[data.kind].platforms ?? current.platforms;
        // Another kind brings another recommendation.
        const fresh = recommended(next);
        return { parts: s.parts.map((p) => (p.id === id ? fresh : p)), partsTouched: s.partsTouched.filter((x) => x !== id) };
      }
      // A piece that chose its first platforms gets its recommendation then.
      if (data.platforms && current.platforms.length === 0 && !s.partsTouched.includes(id)) {
        const fresh = recommended(next);
        return { parts: s.parts.map((p) => (p.id === id ? fresh : p)) };
      }
      return { parts: s.parts.map((p) => (p.id === id ? next : p)) };
    }),
  removePart: (id) =>
    set((s) => {
      const parts = s.parts.filter((p) => p.id !== id);
      return {
        parts,
        partsTouched: s.partsTouched.filter((x) => x !== id),
        activePart: s.activePart === id ? (parts[0]?.id ?? null) : s.activePart,
        requirements: s.requirements.map((r) => ({ ...r, parts: r.parts.filter((x) => x !== id) })),
      };
    }),
  toggleTestType: (type) => set((s) => ({ testTypes: toggle(effectiveTestTypes(s), type) })),
  toggleSkill: (skill) =>
    set((s) => {
      const skills = { ...s.skills };
      if (skills[skill.key]) delete skills[skill.key];
      else skills[skill.key] = skill;
      return { skills };
    }),
  setRequirement: (key, data) => set((s) => ({ requirements: s.requirements.map((r) => (r.key === key ? { ...r, ...data } : r)) })),
  addRequirement: () => set((s) => ({ requirements: [...s.requirements, newRequirement()] })),
  removeRequirement: (key) => set((s) => ({ requirements: s.requirements.filter((r) => r.key !== key) })),
  importRequirements: (list) =>
    set((s) => ({
      requirements: [
        ...s.requirements.filter((r) => r.title.trim() || r.description.trim() || r.dod.some((d) => d.trim())),
        ...list.map((r) => ({
          ...newRequirement(),
          title: r.title,
          description: r.description,
          type: r.type,
          area: r.area,
          dod: r.dod.length ? r.dod : [""],
        })),
      ],
    })),
  reset: () => set(initial()),
}));

/** The piece edited in the stack step, in a monorepo; null for a single app. */
export const activePartOf = (s: Pick<WizardData, "structure" | "parts" | "activePart">): ProjectPart | null =>
  s.structure === "monorepo" ? (s.parts.find((p) => p.id === s.activePart) ?? s.parts[0] ?? null) : null;

/** A piece starts with the recommended stack for its kind and platforms, as a single app does. */
const recommended = (part: ProjectPart): ProjectPart => {
  const platforms = PROJECT_KIND_INFO[part.kind].platforms ?? part.platforms;
  return { ...part, stack: recommendStack(platforms, part.kind).stack };
};

function withPart(s: WizardData, id: string, data: Partial<ProjectPart>, touched: boolean): Partial<WizardData> {
  return {
    parts: s.parts.map((p) => (p.id === id ? { ...p, ...data } : p)),
    partsTouched: touched ? [...new Set([...s.partsTouched, id])] : s.partsTouched,
  };
}

/** Stack step selectors: the piece being edited in a monorepo, the project otherwise. */
export const selectKind = (s: WizardData) => activePartOf(s)?.kind ?? s.kind;
export const selectPlatforms = (s: WizardData) => {
  const part = activePartOf(s);
  return part ? (PROJECT_KIND_INFO[part.kind].platforms ?? part.platforms) : s.platforms;
};
export const selectStack = (s: WizardData) => activePartOf(s)?.stack ?? s.stack;
export const selectStackTouched = (s: WizardData) => {
  const part = activePartOf(s);
  return part ? s.partsTouched.includes(part.id) : s.stackTouched;
};

/** Kind, platforms and stack of the whole project (the union of the pieces in a monorepo). */
export const projectShape = (s: WizardData) =>
  s.structure === "monorepo" && s.parts.length
    ? summarizeParts(s.parts)
    : { kind: s.kind, platforms: kindPlatforms(s.kind, s.platforms), stack: s.stack };

/** The tests agents must write: what the person chose, or the defaults for the kind of project. */
export const effectiveTestTypes = (s: WizardData): TestType[] => s.testTypes ?? defaultTestTypes(projectShape(s).kind);

/** What the assistant gets to know about the project being created. */
export const wizardBrief = (state: WizardData): AssistantBrief => ({
  name: state.name.trim(),
  goal: state.goal.trim(),
  kind: selectKind(state),
  platforms: selectPlatforms(state),
  stack: selectStack(state),
  databases: state.databases,
  rules: state.rules.map((r) => r.trim()).filter(Boolean),
  requirements: state.requirements.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), description: r.description.trim() })),
});

/** Whether the data of a step is complete enough to move past it. */
export const isStepValid = (state: WizardData, step: number): boolean => {
  switch (WIZARD_STEPS[step]?.id) {
    case "source":
      // A repo that already has a project file is imported, not configured again.
      return state.source === "scratch" || (state.repo !== null && !state.repo.existingProjectId && !state.repo.projectFile);
    case "basics":
      if (state.name.trim() === "") return false;
      if (state.structure === "monorepo") return partsProblems(state.parts).length === 0;
      return PROJECT_KIND_INFO[state.kind].platforms !== null || state.platforms.length > 0;
    case "stack":
      return state.structure === "monorepo" ? state.parts.every((p) => p.stack.length > 0) : state.stack.length > 0;
    case "goal":
      return state.goal.trim() !== "";
    case "requirements":
      return state.requirements.some((r) => r.title.trim() !== "");
    default:
      return true;
  }
};

/** A step can be opened when every step before it is valid. */
export const canOpenStep = (state: WizardData, step: number) => Array.from({ length: step }, (_, i) => i).every((i) => isStepValid(state, i));

export default useWizardStore;
