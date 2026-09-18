import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { repositoryUrl } from "./repository";
import { appName } from "./site";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: appName,
    },
    githubUrl: repositoryUrl,
  };
}
