import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/section-heading";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCharityPageSnapshot } from "@/lib/platform";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function CharityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const snapshot = await getCharityPageSnapshot(slug);

  if (!snapshot) {
    notFound();
  }

  const { charity, related } = snapshot;

  return (
    <div className="section-shell space-y-10 py-14 md:py-20">
      <SectionHeading
        eyebrow={charity.category}
        title={charity.name}
        description={charity.description}
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Mission</h2>
          <p className="text-sm leading-7 text-muted">{charity.mission}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Raised to date</p>
              <p className="mt-2 text-3xl font-semibold">{formatCurrency(charity.totalRaisedCents)}</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Events live</p>
              <p className="mt-2 text-3xl font-semibold">{charity.upcomingEvents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="mesh-card space-y-5">
          <h2 className="display-font text-3xl font-semibold">Upcoming events</h2>
          {charity.upcomingEvents.map((event) => (
            <div key={event.id} className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                {formatDate(event.date)} • {event.location}
              </p>
              <p className="mt-2 text-xl font-semibold">{event.title}</p>
              <p className="mt-2 text-sm leading-7 text-muted">{event.summary}</p>
            </div>
          ))}
          <Link href="/pricing" className={buttonStyles({ variant: "primary", size: "md", fullWidth: true })}>
            Subscribe and support this cause
          </Link>
        </Card>
      </div>
      {related.length > 0 ? (
        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Related charities</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/charities/${item.slug}`}
                className="rounded-[1.5rem] border border-line bg-white/80 p-4 hover:border-secondary"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{item.category}</p>
                <p className="mt-2 text-xl font-semibold">{item.name}</p>
                <p className="mt-2 text-sm leading-7 text-muted">{item.impactTag}</p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
