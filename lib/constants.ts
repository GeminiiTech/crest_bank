import { ShieldCheck, Wallet, Building2, PiggyBank, CreditCard, LineChart,
  Lock, Fingerprint, BellRing, BadgeCheck } from "lucide-react";

export const navLinks = [
  { label: "Personal", href: "#features" },
  { label: "Business", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const stats = [
  { value: "2.4M+", label: "Customers worldwide" },
  { value: "$48B", label: "Assets under management" },
  { value: "32", label: "Countries served" },
  { value: "99.99%", label: "Platform uptime" },
] as const;

export const features = [
  { icon: Wallet, title: "Personal Banking", desc: "Everyday accounts with instant transfers, smart insights, and zero hidden fees." },
  { icon: Building2, title: "Business Banking", desc: "Accounts, payroll, and multi-user controls built for growing companies." },
  { icon: PiggyBank, title: "Savings Accounts", desc: "Competitive rates and automated goals that help your money grow faster." },
  { icon: LineChart, title: "Investments", desc: "Diversified portfolios and advisory tools to build long-term wealth." },
  { icon: CreditCard, title: "Cards", desc: "Virtual and physical debit and credit cards with real-time controls." },
  { icon: ShieldCheck, title: "Loans & Credit", desc: "Transparent personal and business lending with fast decisions." },
] as const;

export const benefits = [
  { title: "Move money in seconds", desc: "Real-time internal transfers and fast external payments, 24/7." },
  { title: "See where it goes", desc: "Automatic categorization and spending insights across every account." },
  { title: "Bank from anywhere", desc: "A fast, accessible experience on web and mobile, fully in sync." },
] as const;

export const security = [
  { icon: Lock, title: "256-bit encryption", desc: "Your data is encrypted in transit and at rest." },
  { icon: Fingerprint, title: "Biometric & 2FA", desc: "Multi-factor and biometric login keep accounts safe." },
  { icon: BellRing, title: "Real-time fraud alerts", desc: "We monitor activity and flag anything unusual instantly." },
  { icon: BadgeCheck, title: "Insured deposits", desc: "Eligible deposits are protected up to regulatory limits." },
] as const;

export const testimonials = [
  { quote: "Switching to Crest Bank was the easiest financial decision we made this year. Transfers are instant and support is excellent.", name: "Amara Okafor", role: "Founder, Lumen Studio" },
  { quote: "The spending insights actually changed how I budget. Everything is clear, fast, and genuinely well designed.", name: "David Chen", role: "Product Manager" },
  { quote: "Business banking that finally keeps up with us. Multi-user controls and payroll just work.", name: "Sofia Marquez", role: "COO, Northwind Logistics" },
] as const;

export const faqs = [
  { q: "Is Crest Bank a real bank?", a: "Crest Bank provides banking services through regulated banking partners. Eligible deposits are insured up to applicable limits." },
  { q: "How long does it take to open an account?", a: "Most customers complete onboarding in under five minutes with a valid ID and basic details." },
  { q: "What does it cost?", a: "Personal accounts have no monthly maintenance fees. Business and premium plans are priced transparently with no hidden charges." },
  { q: "How do you protect my money and data?", a: "We use 256-bit encryption, multi-factor authentication, continuous fraud monitoring, and strict access controls." },
  { q: "Can I use Crest Bank for my business?", a: "Yes. Business Banking includes multi-user access, role controls, payroll, and dedicated support." },
  { q: "Which countries do you support?", a: "Crest Bank operates across 32 countries, with more added regularly. Availability of specific products varies by region." },
] as const;

export const footerColumns = [
  { title: "Products", links: ["Personal Banking", "Business Banking", "Savings", "Cards", "Investments"] },
  { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
  { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Disclosures"] },
  { title: "Support", links: ["Help Center", "Security", "Status", "Contact Support"] },
] as const;
