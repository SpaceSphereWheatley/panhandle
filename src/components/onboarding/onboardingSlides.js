import { ShareIllustration, MealsIllustration, OfflineIllustration, NotifyIllustration } from "./illustrations.jsx";

// Slide content lives here as data, not JSX, so adding/reordering/removing a
// slide is a one-line change to this array rather than a structural edit to
// OnboardingFlow. Text is looked up through the i18n dictionaries (keys added
// under "onboarding.*" in en.js/nb.js) rather than hardcoded, same as every
// other user-facing string in the app.
export const ONBOARDING_SLIDES = [
  { id: "share", Illustration: ShareIllustration, titleKey: "onboarding.slide.share.title", bodyKey: "onboarding.slide.share.body" },
  { id: "meals", Illustration: MealsIllustration, titleKey: "onboarding.slide.meals.title", bodyKey: "onboarding.slide.meals.body" },
  { id: "offline", Illustration: OfflineIllustration, titleKey: "onboarding.slide.offline.title", bodyKey: "onboarding.slide.offline.body" },
  { id: "notify", Illustration: NotifyIllustration, titleKey: "onboarding.slide.notify.title", bodyKey: "onboarding.slide.notify.body" },
];
