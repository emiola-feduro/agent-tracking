import type { ReactNode } from "react";
import useGithubWatch from "@/hooks/data/use-github-watch";
import type { Project } from "@/lib/api";
import GithubConnection from "./github-connection";
import GithubLinkRepo from "./github-link-repo";

type GithubPanelProps = {
  project: Project;
  children: ReactNode;
};

/** Shared frame for the GitHub tabs: asks to link a repository, shows the connection, keeps polling alive. */
const GithubPanel = ({ project, children }: GithubPanelProps) => {
  const { id, repoUrl } = project;
  useGithubWatch(id, Boolean(repoUrl));

  if (!repoUrl) return <GithubLinkRepo projectId={id} />;
  return (
    <div className="flex flex-col gap-4">
      <GithubConnection />
      {children}
    </div>
  );
};

export default GithubPanel;
