import { Hero } from "@/components/marketing/hero";
import { Stats } from "@/components/marketing/stats";
import { Features } from "@/components/marketing/features";
import { Benefits } from "@/components/marketing/benefits";
import { Security } from "@/components/marketing/security";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { CtaBand } from "@/components/marketing/cta-band";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <Benefits />
      <Security />
      <Testimonials />
      <Faq />
      <CtaBand />
    </>
  );
}
