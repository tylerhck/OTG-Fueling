import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | OTG Fueling",
  description: "Privacy Policy for On The Go Fueling mobile fuel delivery service.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: May 28, 2026</p>

      <div className="prose prose-slate max-w-none">
        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Introduction</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          On The Go Fueling (&ldquo;OTG Fueling,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile application, and fuel delivery services (collectively, the &ldquo;Service&rdquo;).
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Information We Collect</h2>
        <p className="text-slate-600 leading-relaxed mb-2"><strong>Personal Information:</strong></p>
        <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-1">
          <li>Name, email address, and phone number</li>
          <li>Billing and payment information (processed securely via Stripe)</li>
          <li>Delivery addresses and vehicle/boat information</li>
          <li>Account credentials</li>
        </ul>
        <p className="text-slate-600 leading-relaxed mb-2"><strong>Usage Information:</strong></p>
        <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-1">
          <li>Order history and service preferences</li>
          <li>Device information and browser type</li>
          <li>IP address and general location data</li>
          <li>Interaction data with our Service</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. How We Use Your Information</h2>
        <p className="text-slate-600 leading-relaxed mb-2">We use your information to:</p>
        <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-1">
          <li>Process and fulfill fuel delivery orders</li>
          <li>Manage your account and subscription</li>
          <li>Process payments and prevent fraud</li>
          <li>Communicate with you about orders, updates, and promotions</li>
          <li>Verify delivery addresses are within our service areas</li>
          <li>Improve our Service and customer experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Payment Information</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          All payment processing is handled by Stripe, Inc. We do not store your full credit card number, CVV, or other sensitive payment details on our servers. Stripe&rsquo;s handling of your payment information is governed by their own privacy policy and PCI-DSS compliance standards.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Information Sharing</h2>
        <p className="text-slate-600 leading-relaxed mb-2">We do not sell your personal information. We may share your information with:</p>
        <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-1">
          <li><strong>Service providers:</strong> Payment processors (Stripe), email services, and hosting providers necessary to operate the Service</li>
          <li><strong>Delivery personnel:</strong> Limited information (name, address, vehicle details) necessary to complete your delivery</li>
          <li><strong>Legal compliance:</strong> When required by law, court order, or governmental authority</li>
          <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
        </ul>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Data Security</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          We implement commercially reasonable security measures to protect your personal information, including encryption of data in transit (TLS/SSL), secure password hashing, and access controls. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Data Retention</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          We retain your personal information for as long as your account is active or as needed to provide the Service. We may retain certain information as required by law or for legitimate business purposes (such as resolving disputes or enforcing agreements).
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Your Rights</h2>
        <p className="text-slate-600 leading-relaxed mb-2">You have the right to:</p>
        <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated data</li>
          <li>Opt out of promotional communications</li>
          <li>Cancel your subscription at any time</li>
        </ul>
        <p className="text-slate-600 leading-relaxed mb-4">
          To exercise any of these rights, please contact us at otgfuelingllc@gmail.com.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. Cookies &amp; Tracking</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          We use cookies and similar technologies to maintain your session, remember your preferences, and analyze usage patterns. You may disable cookies in your browser settings, but some features of the Service may not function properly without them.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">10. Third-Party Links</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">11. Children&rsquo;s Privacy</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          The Service is not intended for individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that we have collected information from a user under 16, we will take steps to delete that information.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">12. Changes to This Policy</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date. Your continued use of the Service after changes are posted constitutes acceptance of the revised policy.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">13. Contact Us</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
If you have questions or concerns about this Privacy Policy, please contact us at:<br />
           Email: otgfuelingllc@gmail.com
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-slate-200">
        <Link href="/terms" className="text-red-600 hover:text-red-500 font-medium text-sm">
          View Terms of Service →
        </Link>
      </div>
    </div>
  );
}
