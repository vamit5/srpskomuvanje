"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { mergeSiteContent } from "@/lib/siteContent";

export interface ManualPaymentBankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  note: string;
}

export interface ManualPaymentRequestResult {
  referenceCode: string;
  amountLabel: string;
  bank: ManualPaymentBankInfo;
}

/**
 * Napravi zahtev za rucnu uplatu na racun -- privremeno resenje dok Stripe
 * pregled ne prodje. NE odobrava nista automatski -- samo pravi "na
 * cekanju" zapis sa jedinstvenom sifrom, admin RUCNO potvrdjuje uplatu na
 * pravom racunu pre nego sto odobri (/admin/uplate).
 */
export async function requestManualPayment(
  type: "premium" | "credits" | "boost",
  packageId?: string
): Promise<{ error: string | null; request: ManualPaymentRequestResult | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a.", request: null };

  let amountLabel: string;
  let resolvedPackageId: string | null = null;

  if (type === "credits") {
    if (!packageId) return { error: "Nedostaje paket.", request: null };
    const { data: pkg } = await supabase
      .from("credit_packages")
      .select("id, name, price_cents, currency")
      .eq("id", packageId)
      .eq("is_active", true)
      .maybeSingle();
    if (!pkg) return { error: "Ovaj paket više nije dostupan.", request: null };
    amountLabel = `${(pkg.price_cents / 100).toFixed(2)} ${pkg.currency.toUpperCase()} — ${pkg.name}`;
    resolvedPackageId = pkg.id;
  } else if (type === "boost") {
    const [{ data: priceCentsRow }, { data: currencyRow }] = await Promise.all([
      supabase.from("muvaj_config").select("value").eq("key", "boost_price_cents").maybeSingle(),
      supabase.from("muvaj_config").select("value").eq("key", "boost_currency").maybeSingle(),
    ]);
    const parsedPrice = priceCentsRow ? Number(priceCentsRow.value) : NaN;
    const priceCents = Number.isFinite(parsedPrice) ? parsedPrice : 299;
    const currency = currencyRow?.value ?? "eur";
    amountLabel = `${(priceCents / 100).toFixed(2)} ${currency.toUpperCase()} — Boost`;
  } else {
    const { data: rows } = await supabase.from("site_content").select("key, value").eq("key", "manual_premium_amount_label");
    amountLabel = mergeSiteContent(rows).manual_premium_amount_label;
  }

  const referenceCode = crypto.randomUUID().slice(0, 8).toUpperCase();

  const { error } = await supabase.from("manual_payment_requests").insert({
    profile_id: user.id,
    type,
    package_id: resolvedPackageId,
    amount_label: amountLabel,
    reference_code: referenceCode,
  });
  if (error) return { error: "Ne mogu da napravim zahtev. Pokušaj ponovo.", request: null };

  const { data: bankRows } = await supabase
    .from("site_content")
    .select("key, value")
    .in("key", ["bank_transfer_account_name", "bank_transfer_account_number", "bank_transfer_bank_name", "bank_transfer_note"]);
  const bank = mergeSiteContent(bankRows);

  return {
    error: null,
    request: {
      referenceCode,
      amountLabel,
      bank: {
        accountName: bank.bank_transfer_account_name,
        accountNumber: bank.bank_transfer_account_number,
        bankName: bank.bank_transfer_bank_name,
        note: bank.bank_transfer_note,
      },
    },
  };
}
