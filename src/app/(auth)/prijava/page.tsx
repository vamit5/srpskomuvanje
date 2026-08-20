import { Suspense } from "react";
import { PrijavaForm } from "./PrijavaForm";

export const metadata = { title: "Prijava" };

export default function PrijavaPage() {
  return (
    <Suspense>
      <PrijavaForm />
    </Suspense>
  );
}
