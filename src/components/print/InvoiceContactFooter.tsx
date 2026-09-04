"use client";

import {
  formatInvoiceContactBranchesLine,
  type InvoiceSocialPlatform,
  type PrintSettings,
} from "@/lib/print-settings";

function SocialPlatformIcon({ platform }: { platform: InvoiceSocialPlatform }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="invoice-print-social-icon">
          <path
            fill="currentColor"
            d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.845c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.272h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
          />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="invoice-print-social-icon">
          <path
            fill="currentColor"
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="invoice-print-social-icon">
          <path
            fill="currentColor"
            d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.622c-3.16 0-3.532.012-4.768.068-1.024.047-1.58.218-1.948.363-.49.19-.84.417-1.207.784-.367.367-.594.717-.784 1.207-.145.368-.316.924-.363 1.948-.056 1.236-.068 1.608-.068 4.768s.012 3.532.068 4.768c.047 1.024.218 1.58.363 1.948.19.49.417.84.784 1.207.367.367.717.594 1.207.784.368.145.924.316 1.948.363 1.236.056 1.608.068 4.768.068s3.532-.012 4.768-.068c1.024-.047 1.58-.218 1.948-.363.49-.19.84-.417 1.207-.784.367-.367.594-.717.784-1.207.145-.368.316-.924.363-1.948.056-1.236.068-1.608.068-4.768s-.012-3.532-.068-4.768c-.047-1.024-.218-1.58-.363-1.948-.19-.49-.417-.84-.784-1.207-.367-.367-.717-.594-1.207-.784-.368-.145-.924-.316-1.948-.363-1.236-.056-1.608-.068-4.768-.068zM12 7.378a4.622 4.622 0 100 9.244 4.622 4.622 0 000-9.244zm0 7.622a3 3 0 110-6 3 3 0 010 6zm5.884-7.884a1.08 1.08 0 11-2.16 0 1.08 1.08 0 012.16 0z"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="invoice-print-social-icon">
          <path
            fill="currentColor"
            d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"
          />
        </svg>
      );
    default:
      return null;
  }
}

function platformColor(platform: InvoiceSocialPlatform): string {
  switch (platform) {
    case "facebook":
      return "#1877f2";
    case "whatsapp":
      return "#25d366";
    case "instagram":
      return "#e4405f";
    case "tiktok":
      return "#111827";
    default:
      return "#475569";
  }
}

interface InvoiceContactFooterProps {
  settings: PrintSettings;
  variant: "sheet" | "thermal";
}

export default function InvoiceContactFooter({ settings, variant }: InvoiceContactFooterProps) {
  const branches = settings.invoiceContactBranches;
  const socialAccounts = settings.invoiceSocialAccounts;

  const branchesLine = formatInvoiceContactBranchesLine(branches);

  if (!branchesLine && socialAccounts.length === 0) {
    return null;
  }

  const rootClass =
    variant === "thermal"
      ? "invoice-print-contact-footer invoice-print-contact-footer--thermal"
      : "invoice-print-contact-footer";

  return (
    <section className={rootClass} aria-label="بيانات التواصل">
      {branchesLine ? (
        <p className="invoice-print-contact-inline-line">{branchesLine}</p>
      ) : null}

      {socialAccounts.length > 0 ? (
        <div className="invoice-print-social-row-line">
          {socialAccounts.map((account) => (
            <div key={account.id} className="invoice-print-social-chip">
              <span
                className="invoice-print-social-icon-wrap"
                style={{ color: platformColor(account.platform) }}
                aria-hidden
              >
                <SocialPlatformIcon platform={account.platform} />
              </span>
              <span className="invoice-print-social-label">{account.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
