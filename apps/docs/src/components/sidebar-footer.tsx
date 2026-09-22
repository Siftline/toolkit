import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";

import { repositoryUrl } from "@/lib/repository";

/** Replaces the stock footer, whose one pill stretches the GitHub icon and the switch apart. */
export function SidebarFooter() {
  return (
    <div className="flex items-center justify-between text-sm text-fd-muted-foreground">
      <a
        href={repositoryUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        <GitHubMark className="size-4" />
        GitHub
      </a>
      <ThemeSwitch />
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}
