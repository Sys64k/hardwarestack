import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for HardwareStack.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Terms of Use</h1>
      <p className="text-sm text-slate-400 mb-10">Last updated: October 2026</p>

      <div className="flex flex-col gap-8 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">1. Acceptance</h2>
          <p>
            By accessing or using HardwareStack (&ldquo;the Site&rdquo;), you agree to these
            Terms of Use. If you do not agree, please do not use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">2. Informational use only</h2>
          <p>
            All bottleneck calculations, hardware scores, and upgrade recommendations are
            estimates derived from publicly available benchmark data. They are provided for
            informational purposes only and do not constitute professional advice. Results
            may not reflect real-world gaming performance, which varies by game, driver
            version, system configuration, and other factors.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">3. No warranty</h2>
          <p>
            The Site is provided &ldquo;as is&rdquo; without any warranty of any kind, express or
            implied. HardwareStack makes no representations regarding the accuracy,
            completeness, or fitness for any particular purpose of the information
            presented. Benchmark data may be outdated or incomplete.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">4. Affiliate and external links</h2>
          <p>
            The Site links to third-party retailers such as Amazon, Google Shopping and
            PCPartPicker. Links to Amazon are affiliate links: as an Amazon Associate,
            HardwareStack earns from qualifying purchases, at no additional cost to you.
            Affiliate links never affect the calculator results or which hardware is recommended.
            HardwareStack is not responsible for the content, pricing, availability, or accuracy
            of information on any third-party site.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">5. Visit statistics</h2>
          <p>
            HardwareStack uses Cloudflare Web Analytics to count visits and page views. It
            does not use cookies, local storage, or fingerprinting, and does not track you
            across sites. Only aggregated statistics (such as page views, referrers, country,
            and browser type) are collected. See{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-900"
            >
              Cloudflare&apos;s privacy policy
            </a>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">6. Limitation of liability</h2>
          <p>
            HardwareStack shall not be liable for any loss or damage arising from your use
            of the Site or any purchasing decisions made based on information presented here.
            Always verify component compatibility with your motherboard&apos;s specifications
            and QVL before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">7. Changes</h2>
          <p>
            These terms may be updated at any time. Continued use of the Site after changes
            are posted constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">8. Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline hover:text-slate-900"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
