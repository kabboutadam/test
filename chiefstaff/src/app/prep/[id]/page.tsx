import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SignedOut } from "@/components/SignedOut";
import type { PrepSection } from "@/core/prep";

export const dynamic = "force-dynamic";

export default async function PrepPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return <SignedOut />;
  const { id } = await params;

  const prep = await db.meetingPrep.findFirst({ where: { id, userId: user.id }, include: { person: true } });
  if (!prep) notFound();

  const sections = prep.sections as unknown as PrepSection[];

  return (
    <main>
      <h1>{prep.title}</h1>
      <p className="lede">
        {prep.startsAt.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: user.timezone })}
        {prep.person ? ` · with ${prep.person.name ?? prep.person.email}` : ""}
      </p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <ul>
            {section.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
