"use client";

import { useState } from "react";
import { toggleDiscoverable } from "../actions";

interface UserRow {
  id: string;
  name: string;
  age: number;
  city: string | null;
  isVerified: boolean;
  isDiscoverable: boolean;
  createdAt: string;
  lastActiveAt: string;
  isPremium: boolean;
  spent: { currency: string; cents: number }[];
}

function formatSpent(spent: UserRow["spent"]) {
  if (!spent.length) return "—";
  return spent
    .map((s) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: s.currency.toUpperCase() }).format(s.cents / 100))
    .join(" + ");
}

export function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    const result = await toggleDiscoverable(id, !current);
    setBusyId(null);
    if (!result.error) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isDiscoverable: !current } : u)));
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-bg-elevated)] text-xs text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2">Ime</th>
            <th className="px-3 py-2">Grad</th>
            <th className="px-3 py-2">Registrovan</th>
            <th className="px-3 py-2">Premium</th>
            <th className="px-3 py-2">Potrošeno</th>
            <th className="px-3 py-2">Vidljiv</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-[var(--color-border)]">
              <td className="px-3 py-2">
                {u.name}, {u.age} {u.isVerified && <span title="Verifikovan">✓</span>}
              </td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{u.city ?? "—"}</td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">
                {new Date(u.createdAt).toLocaleDateString("sr-RS")}
              </td>
              <td className="px-3 py-2">
                {u.isPremium ? (
                  <span className="rounded-full bg-gradient-accent px-2 py-0.5 text-xs font-semibold text-white">⭐ Premium</span>
                ) : (
                  <span className="text-[var(--color-text-faint)]">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{formatSpent(u.spent)}</td>
              <td className="px-3 py-2">
                {u.isDiscoverable ? (
                  <span className="text-[var(--color-success)]">Da</span>
                ) : (
                  <span className="text-[var(--color-danger)]">Sakriven</span>
                )}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => handleToggle(u.id, u.isDiscoverable)}
                  className="tap-scale text-xs text-[var(--color-text-muted)] underline disabled:opacity-40"
                >
                  {u.isDiscoverable ? "Sakrij" : "Vrati"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
