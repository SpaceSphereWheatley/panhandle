import { ShareIllustration, MealsIllustration, OfflineIllustration, NotifyIllustration } from "./illustrations.jsx";

// Slide content lives here as data, not JSX, so adding/reordering/removing a
// slide is a one-line change to this array rather than a structural edit to
// OnboardingFlow. Title/body are plain English, not i18n dictionary keys —
// deliberately not translated, same as the illustrations' in-frame UI text
// (see illustrations.jsx's header comment): this intro is shown once, before
// a first-time user has even picked a language, so it stays English
// regardless of the device's UI language.
export const ONBOARDING_SLIDES = [
  {
    id: "share",
    Illustration: ShareIllustration,
    title: "One list, everyone's phone",
    body: "Add milk from the store and your household sees it update instantly – no more texting the list back and forth.",
  },
  {
    id: "meals",
    Illustration: MealsIllustration,
    title: "Plan meals for the week",
    body: "Assign who's cooking each day, and turn the ingredients straight into shopping list items.",
  },
  {
    id: "offline",
    Illustration: OfflineIllustration,
    title: "Works without a signal",
    body: "Keep checking things off in the store's dead zone – everything syncs the moment you're back online.",
  },
  {
    id: "notify",
    Illustration: NotifyIllustration,
    title: "Never miss what's needed",
    body: "Turn on notifications and get a nudge when tomorrow's meal isn't planned yet.",
  },
];
