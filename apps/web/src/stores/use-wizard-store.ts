import { type CommitConventions, kindPlatforms, PROJECT_KIND_INFO, toggleStackOption } from "@agent-tracking/core";
import { create } from "zustand";
import type { AssistantBrief, GithubPublish, DiscoveredSkill, GithubFileKind, Platform, ProjectKind, RepoInspection, RequirementArea, RequirementType } from "@/lib/api";

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
  toggleSkill: (skill: SelectedSkill) => void;
  setRequirement: (key: string, data: Partial<RequirementDraft>) => void;
  addRequirement: () => void;
  removeRequirement: (key: string) => void;
  /** Adds imported requirements, replacing the empty draft the step starts with. */
  importRequirements: (list: { title: string; description: string; type: RequirementType; area: RequirementArea; dod: string[] }[]) => void;
  reset: () => void;
};

const newRequirement = (): RequirementDraft => ({ key: crypto.randomUUID(), title: "", description: "", type: null, area: null, dod: [""], llmDod: [] });

const initial = (): WizardData => ({
  step: 0,
  reached: 0,
  source: "scratch",
  repo: null,
  githubFiles: [],
  publish: null,
  commitConventions: null,
  prTemplate: null,
  name: "",
  kind: "fullstack",
  platforms: [],
  repoUrl: "",
  stack: [],
  databases: [],
  stackTouched: false,
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
  setSource: (source) => set({ source, repo: null, githubFiles: source === "new" ? ["ci", "prTemplate"] : [] }),
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
    })),
  patch: (data) => set(data),
  togglePlatform: (platform) => set((s) => ({ platforms: toggle(s.platforms, platform) })),
  // The stack keeps exclusive groups and requirements consistent; databases are a free list.
  toggleIn: (field, value) =>
    set((s) =>
      field === "stack"
        ? { stack: toggleStackOption(s.stack, value), stackTouched: true }
        : { databases: toggle(s.databases, value), stackTouched: true },
    ),
  toggleSkill: (skill) =>
    set((s) => {
      const skills = { ...s.skills };
      if (skills[skill.key]) delete skills[skill.key];
      else skills[skill.key] = skill;
      return { skills };
    }),
  setRequirement: (key, data) =>
    set((s) => ({ requirements: s.requirements.map((r) => (r.key === key ? { ...r, ...data } : r)) })),
  addRequirement: () => set((s) => ({ requirements: [...s.requirements, newRequirement()] })),
  removeRequirement: (key) => set((s) => ({ requirements: s.requirements.filter((r) => r.key !== key) })),
  importRequirements: (list) =>
    set((s) => ({
      requirements: [
        ...s.requirements.filter((r) => r.title.trim() || r.description.trim() || r.dod.some((d) => d.trim())),
        ...list.map((r) => ({ ...newRequirement(), title: r.title, description: r.description, type: r.type, area: r.area, dod: r.dod.length ? r.dod : [""] })),
      ],
    })),
  reset: () => set(initial()),
}));

/** What the assistant gets to know about the project being created. */
export const wizardBrief = (state: WizardData): AssistantBrief => ({
  name: state.name.trim(),
  goal: state.goal.trim(),
  kind: state.kind,
  platforms: kindPlatforms(state.kind, state.platforms),
  stack: state.stack,
  databases: state.databases,
  rules: state.rules.map((r) => r.trim()).filter(Boolean),
  requirements: state.requirements
    .filter((r) => r.title.trim())
    .map((r) => ({ title: r.title.trim(), description: r.description.trim() })),
});

/** Whether the data of a step is complete enough to move past it. */
export const isStepValid = (state: WizardData, step: number): boolean => {
  switch (WIZARD_STEPS[step]?.id) {
    case "source":
      // A repo that already has a project file is imported, not configured again.
      return (
        state.source === "scratch" ||
        (state.repo !== null && !state.repo.existingProjectId && !state.repo.projectFile)
      );
    case "basics":
      return state.name.trim() !== "" && (PROJECT_KIND_INFO[state.kind].platforms !== null || state.platforms.length > 0);
    case "stack":
      return state.stack.length > 0;
    case "goal":
      return state.goal.trim() !== "";
    case "requirements":
      return state.requirements.some((r) => r.title.trim() !== "");
    default:
      return true;
  }
};

/** A step can be opened when every step before it is valid. */
export const canOpenStep = (state: WizardData, step: number) =>
  Array.from({ length: step }, (_, i) => i).every((i) => isStepValid(state, i));

export default useWizardStore;
