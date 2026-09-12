# Suraksha Setu: emergency delivery and location setup

The prototype now has a simplified map, a reference-inspired alerts dashboard, an SOS form, and automatic browser location detection. Email and SMS delivery are **disabled by default**. No real emergency messages were sent during implementation or testing.

## 1. Choose a monitored receiving authority

Official sources checked on 10 September 2026:

| Organisation | Published contact | Source |
| --- | --- | --- |
| NDMA control room | `controlroom@ndma.gov.in`; telephone `+91-11-26701728` | [NDMA SACHET help desk](https://sachet.ndma.gov.in/HelpDesk) |
| NDRF headquarters | `hq.ndrf@nic.in` | [NDRF contact page](https://www.ndrf.gov.in/en/contact-us) |

The NDMA page was readable directly. The NDRF email was available in the official page's search result; direct access to that page failed during verification. Recheck it before use.

These are published contact points, not verified API endpoints or agreements to accept automated distress traffic. Contact the district disaster management authority for the district where you plan to pilot. Confirm the monitored inbox, an SMS-capable mobile number, coverage area, who responds, and whether they will accept reports from your app. Do not put a landline or emergency short code in the SMS recipient setting. The published NDMA telephone above is a voice contact; SMS reception was not verified.

The current prototype sends to **one configured team**, with one email recipient and one mobile recipient. It includes the user's selected coordinates and landmark in the request. It does not automatically select a different authority for every district. Start with a clearly named district pilot or a central team that has agreed to triage incoming reports.

## 2. Connect email through Resend

1. Create a [Resend account](https://resend.com/), add a domain you control, and complete domain verification using the DNS records Resend provides.
2. Create a server-side API key for sending email. Keep the key in `.env.local`; never in a browser-visible `NEXT_PUBLIC_` setting.
3. Add these values to your existing `.env.local` without replacing other settings:

```dotenv
RESEND_API_KEY=your_private_key
EMERGENCY_FROM_EMAIL=Suraksha Setu <help@your-verified-domain>
EMERGENCY_TO_EMAIL=your-own-test-inbox
```

The sender must be supported by your verified domain. Recipient restrictions apply while using Resend's default testing domain. [Send-email API](https://resend.com/docs/api-reference/emails/send-email), [sender verification errors](https://resend.com/docs/api-reference/errors).

## 3. Connect SMS through Twilio

1. Create a [Twilio account](https://www.twilio.com/), obtain an SMS-capable sender, and enable the destination country in your messaging configuration. Follow trial-account recipient verification if applicable.
2. Copy your Account SID and Auth Token from Twilio into `.env.local`:

```dotenv
TWILIO_ACCOUNT_SID=AC_your_account_sid
TWILIO_AUTH_TOKEN=your_private_auth_token
TWILIO_FROM_NUMBER=your_twilio_number_in_plus_country_code_format
EMERGENCY_TO_SMS=your-own-test-mobile-in-plus-country-code-format
```

The actual Account SID is `AC` followed by 32 hexadecimal characters. Phone numbers must use full international format, for example a leading `+91` for an Indian mobile. Replace every placeholder; do not paste the example text as a working value.

Confirm the supported route and emergency-report use case with Twilio before enabling a real recipient. Its current India guidelines distinguish international routes from domestic routes: domestic sending requires DLT company and sender registration; international delivery has separate eligibility and sender-ID rules. This adapter uses a numeric Twilio sender and the standard Messages API. Domestic alphanumeric sending and DLT template parameters are not implemented. Do not assume creating an account alone enables your intended Indian sending route. [Twilio India guidelines](https://www.twilio.com/en-us/guidelines/in/sms), [Messages API](https://www.twilio.com/docs/messaging/api/message-resource).

## 4. Enable and test using your own contacts

Add:

```dotenv
EMERGENCY_AUTHORITY_NAME=Suraksha Setu test team
EMERGENCY_DELIVERY_ENABLED=true
```

Restart the app. Open **SOS · Need help?**. The form should show the configured team and whether each channel is connected. Use your own inbox/mobile and clearly label the request **TEST ONLY — no assistance required**. Confirm receipt in your inbox, on your phone, and in the provider dashboards. Test email and SMS independently; one may fail while the other succeeds.

Only after the receiving authority has agreed should you replace the test recipients with their confirmed contacts and set the team name to the agreed coverage area. Restart again. Set `EMERGENCY_DELIVERY_ENABLED=false` whenever you want to disable automatic sending.

The app reports provider acceptance, failure, or an unconfirmed outcome separately for each channel. Acceptance is not confirmation of delivery, authority acknowledgement, or rescue dispatch. Delivery callbacks and an authority response dashboard are not connected. The user-triggered SOS submission automatically sends both configured channels; simply opening the app or detecting a nearby hazard never sends an SOS.

## 5. Enable location and relocation guidance

- Open the app over HTTPS when hosted, or on localhost for development. Allow the browser's location prompt. The application requests one location reading on opening; it does not continuously track movement. **Use my location** refreshes the reading.
- If access is denied or unavailable, use **Choose location** or enter a landmark in the SOS form. A browser setting may need to be changed manually before GPS can be retried.
- Coordinates are sent to the application's existing geocoding and local-intelligence services to retrieve the location name, alerts, weather and nearby facilities. They are shared in an emergency report only when the user explicitly submits the SOS form with consent.
- The home page and Weather page show the local safety brief. Nearby OpenStreetMap facilities have unverified opening status and shelter suitability.
- Relocation recommendations use accessible records from the existing relocation workflow. Sign in with an assigned workflow role (or use the existing localhost prototype roles) and add actual, dated site assessments. Sites must be verified, assessed within 30 days, within 50 km, have hazard intensity at most 1/5, and have remaining capacity after existing commitments. Public visitors without access to these records see an honest empty state. No demo site is invented as a safe destination.
- Published, public shelter coverage needs an approved public data feed or publication workflow. Existing private assessment records are not exposed to anonymous users by this change.

## Hosting limitation

This implementation follows the project's existing Node.js and SQLite prototype architecture. Emergency receipt hashes and channel states are stored in `.local/emergency.sqlite` for seven days to prevent duplicate submissions, including after a restart. Names, phone numbers, coordinates and message bodies are not stored in that database. They are transmitted to configured providers when submitted and are subject to those providers' retention settings.

Use persistent disk and a single application instance for this version. Before moving to ephemeral/serverless or multiple instances, migrate this receipt store and the request limiter to a shared durable database. Confirmed failures and ambiguous provider timeouts are not automatically resent; the same reference can be checked again without generating another SMS. Keep the call option available.

## Verification

Automated tests exercise request validation, disabled delivery, provider acceptance/failure/timeouts, duplicate and concurrent submissions, and relocation eligibility. They mock email/SMS providers and never send actual messages. Real end-to-end email/SMS receipt still requires the manual test above.
