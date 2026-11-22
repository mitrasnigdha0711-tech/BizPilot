
import Link from 'next/link';
import ProjectsTable from '@/components/ProjectsTable';

export default function ProjectsPage() {
  return (
    <main data-nexen-component="nx_app_projects_page" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6" data-nexen-id="nx-578d255b-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-nexen-id="nx-578d255b-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-nexen-id="nx-578d255b-2">Projects</h1>
          <p className="text-sm text-muted-foreground" data-nexen-id="nx-578d255b-3">
            See each project's status and upcoming deadline, and open any project to manage it.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
         data-nexen-id="nx-578d255b-4">
          New project
        </Link>
      </header>

      <section className="min-w-0 overflow-x-auto rounded-[var(--radius)] border border-border bg-card shadow-sm" data-nexen-id="nx-578d255b-5">
        <ProjectsTable />
      </section>
    </main>
  );
}