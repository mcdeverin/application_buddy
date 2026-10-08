export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8F8F6] text-[#171717]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-black/5 bg-white px-6 py-8">
          <div className="mb-12 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-sm text-white">
              ✦
            </div>
            <span className="text-lg font-semibold tracking-tight">
              job_tracker
            </span>
          </div>

          <nav className="space-y-1">
            <NavItem label="Today" active />
            <NavItem label="Matches" />
            <NavItem label="Applications" />
            <NavItem label="Interviews" />
          </nav>

          <div className="mt-auto">
            <NavItem label="Me" />
          </div>
        </aside>

        {/* Main content */}
        <div className="ml-60 w-full">
          <div className="mx-auto max-w-6xl px-12 pb-32 pt-14">
            {/* Header */}
            <header className="mb-12">
              <p className="mb-2 text-sm text-neutral-500">
                Wednesday, September 30
              </p>

              <h1 className="text-4xl font-semibold tracking-[-0.04em]">
                Good evening, Macauley.
              </h1>

              <p className="mt-3 text-lg text-neutral-500">
                Here&apos;s what&apos;s happening with your search.
              </p>
            </header>

            {/* Fresh Matches */}
            <section className="mb-12">
              <SectionHeader title="Fresh matches" action="See all" />

              <div className="grid grid-cols-3 gap-4">
                <JobCard
                  company="Notion"
                  role="Product Operations Manager"
                  location="New York, NY"
                  reason="Your workflow automation and cross-functional operations experience align closely."
                  time="2h ago"
                />

                <JobCard
                  company="Ramp"
                  role="Business Operations"
                  location="New York, NY"
                  reason="Strong overlap with your systems, analytics, and operational process work."
                  time="5h ago"
                />

                <JobCard
                  company="Headspace"
                  role="Program Operations Manager"
                  location="Remote"
                  reason="Your program management and stakeholder coordination experience stand out."
                  time="Today"
                />
              </div>
            </section>

            {/* Needs You */}
            <section className="mb-12">
              <SectionHeader title="Needs you" count="2" />

              <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
                <ActionRow
                  title="Send interview availability"
                  description="Lyra Health · Training Operations Associate II"
                  tag="Interview"
                />

                <ActionRow
                  title="Follow up with recruiter"
                  description="No update since your final interview"
                  tag="Best Egg"
                  last
                />
              </div>
            </section>

            {/* Applications */}
            <section className="mb-12">
              <SectionHeader title="Applications" action="View all" />

              <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
                <div className="grid grid-cols-[1.1fr_1.8fr_1fr_.8fr] px-6 py-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
                  <span>Company</span>
                  <span>Role</span>
                  <span>Stage</span>
                  <span>Updated</span>
                </div>

                <ApplicationRow
                  company="Lyra Health"
                  role="Training Operations Associate II"
                  stage="Interview"
                  updated="Today"
                />

                <ApplicationRow
                  company="Best Egg"
                  role="Associate Product Operations Manager"
                  stage="Final"
                  updated="2d ago"
                  last
                />
              </div>
            </section>

            {/* Interviews */}
            <section>
              <SectionHeader title="Upcoming interviews" />

              <div className="flex items-center justify-between rounded-2xl border border-black/[0.07] bg-white p-6">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-xs font-medium text-[#4263A8]">
                      Prep ready
                    </span>

                    <span className="text-sm text-neutral-400">
                      Tomorrow · 11:00 AM
                    </span>
                  </div>

                  <h3 className="font-medium">Lyra Health</h3>

                  <p className="mt-1 text-sm text-neutral-500">
                    Training Operations Associate II
                  </p>
                </div>

                <button className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium transition hover:bg-neutral-50">
                  Open prep →
                </button>
              </div>
            </section>
          </div>

          {/* AI input */}
          <div className="fixed bottom-6 left-[calc(15rem+50%)] w-[min(620px,calc(100%-20rem))] -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              <span className="text-neutral-400">✦</span>

              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                placeholder="Ask anything about your search..."
              />

              <span className="text-xs text-neutral-300">⌘ K</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NavItem({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-[#F2F2EF] font-medium text-black"
          : "text-neutral-500 hover:bg-neutral-50 hover:text-black"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({
  title,
  action,
  count,
}: {
  title: string;
  action?: string;
  count?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>

        {count && (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs">
            {count}
          </span>
        )}
      </div>

      {action && (
        <button className="text-sm text-neutral-400 transition hover:text-black">
          {action} →
        </button>
      )}
    </div>
  );
}

function JobCard({
  company,
  role,
  location,
  reason,
  time,
}: {
  company: string;
  role: string;
  location: string;
  reason: string;
  time: string;
}) {
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border border-black/[0.07] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold">
          {company.charAt(0)}
        </div>

        <span className="text-xs text-neutral-400">{time}</span>
      </div>

      <p className="text-sm text-neutral-500">{company}</p>

      <h3 className="mt-1 font-semibold leading-snug">{role}</h3>

      <p className="mt-1 text-xs text-neutral-400">{location}</p>

      <div className="mt-auto pt-5">
        <p className="mb-2 text-xs font-medium text-neutral-400">
          Why this surfaced
        </p>

        <p className="text-sm leading-relaxed text-neutral-600">{reason}</p>
      </div>
    </article>
  );
}

function ActionRow({
  title,
  description,
  tag,
  last = false,
}: {
  title: string;
  description: string;
  tag: string;
  last?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-neutral-50 ${
        !last ? "border-b border-black/[0.06]" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="h-2 w-2 rounded-full bg-[#E7A53E]" />

        <div>
          <p className="text-sm font-medium">{title}</p>

          <p className="mt-1 text-sm text-neutral-400">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">
          {tag}
        </span>

        <span className="text-neutral-300">→</span>
      </div>
    </button>
  );
}

function ApplicationRow({
  company,
  role,
  stage,
  updated,
  last = false,
}: {
  company: string;
  role: string;
  stage: string;
  updated: string;
  last?: boolean;
}) {
  return (
    <button
      className={`grid w-full grid-cols-[1.1fr_1.8fr_1fr_.8fr] items-center px-6 py-4 text-left text-sm transition hover:bg-neutral-50 ${
        !last ? "border-b border-black/[0.06]" : ""
      }`}
    >
      <span className="font-medium">{company}</span>

      <span className="text-neutral-600">{role}</span>

      <span>
        <span className="rounded-full bg-[#F2F2EF] px-2.5 py-1 text-xs">
          {stage}
        </span>
      </span>

      <span className="text-neutral-400">{updated}</span>
    </button>
  );
}
