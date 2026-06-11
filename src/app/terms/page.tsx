import Link from "next/link";

export const metadata = {
  title: "Terms of Service | OTG Fueling",
  description: "Terms of Service for On The Go Fueling mobile fuel delivery service.",
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: May 28, 2026</p>

      <div className="prose prose-slate max-w-none">
        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">1. Acceptance of Terms</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          By accessing or using the On The Go Fueling (&ldquo;OTG Fueling,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) website, mobile application, or any related services (collectively, the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">2. Description of Service</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          OTG Fueling provides on-demand and scheduled mobile fuel delivery services to vehicles and boats at customer-specified locations within our designated service areas in the Dallas-Fort Worth metropolitan area, Texas.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">3. Account Registration</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          To use certain features of the Service, you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">4. Fuel Pricing &amp; Payment</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-slate-700 leading-relaxed font-medium mb-2">
            Important: Fuel Price Disclaimer
          </p>
          <p className="text-slate-600 leading-relaxed">
            OTG Fueling does not display gasoline or diesel prices on the Service. <strong>Fuel prices fluctuate daily based on market conditions. The number of gallons you receive will be determined by the market price at the time of delivery, not at the time of order placement.</strong> By placing an order, you acknowledge and agree that the actual gallons delivered may vary based on current fuel prices.
          </p>
        </div>
        <p className="text-slate-600 leading-relaxed mb-2">
          <strong>Hold Model:</strong> All orders use a temporary hold on your payment method. No immediate charge is made at the time of order placement.
        </p>
        <ul className="list-disc list-inside text-slate-600 leading-relaxed mb-4 space-y-1">
          <li><strong>Dollar Amount Orders:</strong> When you select a dollar amount (e.g., $40), that amount is held on your card. At delivery, you are charged only for the actual fuel dispensed at the market price. If your tank fills before reaching the full dollar amount, only the actual cost is charged and the remaining hold is released.</li>
          <li><strong>Fill-Up Orders:</strong> A $40 hold is placed on your card when you select the fill-up option. You will only be charged for what you receive at time of completion. The hold is released immediately after delivery.</li>
          <li><strong>Recurring Orders:</strong> All recurring orders are fill-up orders. A $40 hold is placed each delivery day. You will only be charged for what you receive at time of completion. The hold is released immediately after delivery.</li>
        </ul>
        <p className="text-slate-600 leading-relaxed mb-4">
          Holds that are not captured will be released according to your financial institution&rsquo;s policies (typically 3&ndash;7 business days). Service fees (delivery fees) are included in the final charge at the time of delivery completion.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">5. Subscription Plans</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          OTG Fueling offers subscription plans that provide discounted delivery fees. Subscriptions are billed monthly and automatically renew unless cancelled. Subscribers are entitled to one (1) complimentary delivery per week (fuel cost only). A second fill-up within the same week is available for an additional $10 delivery fee. The subscription week runs from Sunday at 12:00 AM to the following Sunday at 12:00 AM (Central Time). Cancellation of a subscription may be done at any time through your account profile; access continues through the end of the current billing period.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">6. Delivery &amp; Service Areas</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Deliveries are subject to availability within our designated service areas. We reserve the right to modify service areas, delivery schedules, and time slots at any time. Orders placed for locations outside of active service areas will not be processed.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">7. Recurring Orders</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Customers may opt into recurring weekly orders. By enabling a recurring order, you authorize OTG Fueling to automatically create an order and place a hold on your saved payment method each week on your selected day. You may pause or cancel recurring orders at any time through your account.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">8. Cancellations &amp; Refunds</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Orders may be cancelled without charge while in &ldquo;Awaiting Payment&rdquo; or &ldquo;Pending&rdquo; status. Once an order is confirmed or in progress, cancellation may not be available. If you believe you were charged in error, please contact us at otgfuelingllc@gmail.com.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">9. User Responsibilities</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          You agree to: (a) provide accurate vehicle and location information; (b) ensure your vehicle is accessible at the scheduled delivery time; (c) not request delivery of fuel to unsafe or prohibited locations; (d) comply with all applicable local, state, and federal laws regarding fuel storage and handling.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">10. Limitation of Liability</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          To the fullest extent permitted by law, OTG Fueling shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability for any claim arising from or related to the Service shall not exceed the amount you paid to OTG Fueling in the twelve (12) months preceding the claim.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">11. Indemnification</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          You agree to indemnify and hold harmless OTG Fueling, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">12. Modifications to Terms</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. Your continued use of the Service after changes are posted constitutes acceptance of the revised Terms.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">13. Governing Law</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Tarrant County, Texas.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">14. Customer Gifts &amp; Rewards</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          On The Go Fueling does not conduct sweepstakes, contests, or lotteries. From time to time, we may choose to gift items or experiences to our customers at our sole discretion as a token of appreciation. These gifts are not guaranteed, are not tied to any purchase or subscription requirement, and do not constitute a promotional offer or obligation. On The Go Fueling reserves the right to select gift recipients using any criteria it deems appropriate. No customer is entitled to receive a gift, and the decision to provide gifts is entirely voluntary on the part of OTG Fueling.
        </p>

        <h2 className="text-xl font-semibold text-slate-800 mt-8 mb-3">15. Contact Information</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
If you have questions about these Terms of Service, please contact us at:<br />
           Email: otgfuelingllc@gmail.com
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-slate-200">
        <Link href="/privacy" className="text-red-600 hover:text-red-500 font-medium text-sm">
          View Privacy Policy →
        </Link>
      </div>
    </div>
  );
}
