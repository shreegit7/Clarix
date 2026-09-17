/**
 * Static template registry — one JSON file per template.
 *
 * Imports are static (not dynamic require) so Metro/RN bundling works.
 * To add a template: drop `my-template.json` here, import it below, and
 * append it to TEMPLATES. Run `scripts/validate-templates` to check it.
 */
import type { TaskTemplate } from '../schema';
import { FALLBACK_TEMPLATE_ID } from '../schema';

import genericFallback from './generic_fallback.json';
import blogPost from './blog-post.json';
import resumeRewrite from './resume-rewrite.json';
import collegeEssay from './college-essay.json';
import thesisPaper from './thesis-paper.json';
import novelDraft from './novel-draft.json';
import grantProposal from './grant-proposal.json';
import weddingPlanning from './wedding-planning.json';
import birthdayParty from './birthday-party.json';
import conferenceEvent from './conference-event.json';
import vacationTrip from './vacation-trip.json';
import businessTrip from './business-trip.json';
import roadTrip from './road-trip.json';
import dinnerParty from './dinner-party.json';
import mobileAppMvp from './mobile-app-mvp.json';
import websiteLaunch from './website-launch.json';
import apiBackend from './api-backend.json';
import playStoreRelease from './play-store-release.json';
import bugfixSprint from './bugfix-sprint.json';
import portfolioSite from './portfolio-site.json';
import automationScript from './automation-script.json';
import learnLanguage from './learn-language.json';
import learnInstrument from './learn-instrument.json';
import examPrep from './exam-prep.json';
import onlineCourse from './online-course.json';
import phdApplication from './phd-application.json';
import interviewPrep from './interview-prep.json';
import moveHouse from './move-house.json';
import homeRenovation from './home-renovation.json';
import springCleaning from './spring-cleaning.json';
import carMaintenance from './car-maintenance.json';
import visaApplication from './visa-application.json';
import taxFiling from './tax-filing.json';
import businessPlan from './business-plan.json';
import marketingCampaign from './marketing-campaign.json';
import productLaunch from './product-launch.json';
import hireEmployee from './hire-employee.json';
import freelanceClient from './freelance-client.json';
import startupFundraising from './startup-fundraising.json';
import emailNewsletter from './email-newsletter.json';
import youtubeVideo from './youtube-video.json';
import podcastEpisode from './podcast-episode.json';
import photoshoot from './photoshoot.json';
import musicRelease from './music-release.json';
import artPortfolio from './art-portfolio.json';
import fitnessPlan from './fitness-plan.json';
import mealPrep from './meal-prep.json';
import personalBudget from './personal-budget.json';
import debtPayoff from './debt-payoff.json';
import jobSearch from './job-search.json';
import morningRoutine from './morning-routine.json';

export const FALLBACK_TEMPLATE = genericFallback as unknown as TaskTemplate;

/** Every template including the fallback. */
export const TEMPLATES: TaskTemplate[] = [
  blogPost,
  resumeRewrite,
  collegeEssay,
  thesisPaper,
  novelDraft,
  grantProposal,
  weddingPlanning,
  birthdayParty,
  conferenceEvent,
  vacationTrip,
  businessTrip,
  roadTrip,
  dinnerParty,
  mobileAppMvp,
  websiteLaunch,
  apiBackend,
  playStoreRelease,
  bugfixSprint,
  portfolioSite,
  automationScript,
  learnLanguage,
  learnInstrument,
  examPrep,
  onlineCourse,
  phdApplication,
  interviewPrep,
  moveHouse,
  homeRenovation,
  springCleaning,
  carMaintenance,
  visaApplication,
  taxFiling,
  businessPlan,
  marketingCampaign,
  productLaunch,
  hireEmployee,
  freelanceClient,
  startupFundraising,
  emailNewsletter,
  youtubeVideo,
  podcastEpisode,
  photoshoot,
  musicRelease,
  artPortfolio,
  fitnessPlan,
  mealPrep,
  personalBudget,
  debtPayoff,
  jobSearch,
  morningRoutine,
  FALLBACK_TEMPLATE,
].map((t) => t as unknown as TaskTemplate);

if (FALLBACK_TEMPLATE.id !== FALLBACK_TEMPLATE_ID) {
  throw new Error(
    `Fallback template id must be "${FALLBACK_TEMPLATE_ID}" (got "${FALLBACK_TEMPLATE.id}").`,
  );
}

export function getTemplateById(id: string): TaskTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
