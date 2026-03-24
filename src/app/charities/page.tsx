import { CharityDirectory } from "@/components/charity-directory";
import { SectionHeading } from "@/components/section-heading";
import { getCharityDirectorySnapshot } from "@/lib/platform";

export default async function CharitiesPage() {
  const snapshot = await getCharityDirectorySnapshot();

  return (
    <div className="section-shell space-y-10 py-14 md:py-20">
      <SectionHeading
        eyebrow="Charity directory"
        title="Search missions, filter by cause, and back a story that feels personal."
        description="Every listed charity has a transparent mission profile, event context, and funding ledger visibility."
      />
      <CharityDirectory charities={snapshot.charities} categories={snapshot.categories} />
    </div>
  );
}
