import { get18PlusCandidates, getPendingKrevetSignals } from "./actions";
import { EighteenPlusApp } from "./EighteenPlusApp";

export const metadata = { title: "18+ Muvanje" };

export default async function EighteenPlusPage() {
  const [{ candidates }, { signals }] = await Promise.all([get18PlusCandidates(), getPendingKrevetSignals()]);

  return <EighteenPlusApp initialSignals={signals} initialCandidates={candidates} />;
}
