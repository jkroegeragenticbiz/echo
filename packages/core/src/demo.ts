import type { PersonaId } from "./personas";
import type { Domain, KeyMetric, Platform, Rewrite, Structured } from "./schemas";

/**
 * Sample content used by the seed script, the landing-page live demo and the
 * iOS onboarding preview. Authors are fictional. Every number in a rewrite
 * appears in its source post, matching the voice engine's "no invented facts" rule.
 */
export interface DemoSave {
  key: string;
  platform: Platform;
  source_url: string;
  author: string;
  verbatim_text: string;
  domain: Domain;
  structured: Structured;
  summary: string;
  key_metric: KeyMetric | null;
  topics: string[];
  rewrites: Partial<Record<PersonaId, Rewrite>>;
}

export const DEMO_SAVES: DemoSave[] = [
  {
    key: "cold-email",
    platform: "linkedin",
    source_url: "https://www.linkedin.com/posts/maya-okafor_cold-email-activity-7180000000000000001",
    author: "Maya Okafor",
    verbatim_text: `Stop asking "Do you have 15 minutes this week?"

I rewrote our cold email opener and reply rate went from 9% to 31% in 6 weeks.

The rule: lead with their problem, not your calendar.

Before: "Hi Sam, do you have 15 minutes this week to learn about our platform?"
After: "Hi Sam, noticed your team posted 4 SDR roles in March. Most teams that hire that fast see ramp time slip past 90 days. Worth comparing notes on how we cut it to 45?"

Three rules I now follow:
1. One observation they can verify in 10 seconds.
2. One problem it usually causes.
3. One question that's easy to say yes to.

No links. No attachments. Under 80 words.`,
    domain: "career_sales",
    structured: {
      domain: "career_sales",
      data: {
        core_mechanism: "Open with a verifiable observation about the prospect's problem instead of asking for their time.",
        scripts: [
          "Hi Sam, noticed your team posted 4 SDR roles in March. Most teams that hire that fast see ramp time slip past 90 days. Worth comparing notes on how we cut it to 45?",
        ],
        rules: [
          "One observation they can verify in 10 seconds.",
          "One problem it usually causes.",
          "One question that's easy to say yes to.",
          "No links. No attachments. Under 80 words.",
        ],
        before_after: {
          before: "Hi Sam, do you have 15 minutes this week to learn about our platform?",
          after:
            "Hi Sam, noticed your team posted 4 SDR roles in March. Most teams that hire that fast see ramp time slip past 90 days. Worth comparing notes on how we cut it to 45?",
        },
      },
    },
    summary: "Cold emails that open with a verifiable problem instead of a meeting request lifted reply rate from 9% to 31%.",
    key_metric: { label: "Reply rate", value: "9% → 31%" },
    topics: ["cold email", "prospecting", "copywriting"],
    rewrites: {
      sales_exec: {
        headline: "Lead with their problem, not my calendar",
        paraphrase:
          "My openers ask for 15 minutes before I've earned them. Maya took reply rate from 9% to 31% in 6 weeks by opening with something the prospect can verify in 10 seconds, naming the problem it causes, then asking an easy-yes question.",
        action_steps: [
          "Rewrite my top 3 sequences' first line as: observation, problem, easy-yes question.",
          "Strip links and attachments from first touches and keep them under 80 words.",
          "Track reply rate on the new opener for 6 weeks against the old one.",
        ],
      },
      founder: {
        headline: "Our outbound should sound like we did the homework",
        paraphrase:
          "Asking for a meeting is about us. Opening with a signal the buyer can check in 10 seconds is about them, and it moved one team's reply rate from 9% to 31%. That's the bar I want for every email we send under the company name.",
        action_steps: [
          "Audit the outbound templates the team uses this week against the three rules.",
          "Make 'one verifiable observation' a required field in our prospecting workflow.",
          "Ask the GTM lead to report reply rate on old vs new openers after 6 weeks.",
        ],
      },
      markets_analyst: {
        headline: "Open with the signal, then the thesis",
        paraphrase:
          "This is a pitch structure I already use on the desk: a data point anyone can verify, what it usually implies, and a low-friction ask. Applied to cold email it lifted replies from 9% to 31%. Worth using for outreach to management teams and expert calls.",
        action_steps: [
          "Draft IR and expert-network requests as: observable data point, implication, easy question.",
          "Keep first-touch notes under 80 words with no attachments.",
          "Log response rates on outreach so I can compare formats.",
        ],
      },
      yoga_instructor: {
        headline: "Invite people in by noticing them first",
        paraphrase:
          "Instead of asking for someone's time, start with something true about where they are, gently name what that usually brings up, and offer a question that's easy to say yes to. A sales team saw replies rise from 9% to 31% doing exactly that.",
        action_steps: [
          "Rewrite my studio-partnership emails to open with one thing I noticed about their space.",
          "Name one challenge it often brings, then offer a simple yes-or-no invitation.",
          "Keep messages under 80 words, with no links or attachments in the first note.",
        ],
      },
      fitness_coach: {
        headline: "Coach the outreach like a cue: short and specific",
        paraphrase:
          "Asking for 15 minutes is a weak cue. Point at something real the person can see in 10 seconds, name the problem, and give them an easy yes. That shift took one team's replies from 9% to 31%. Same principle as good coaching: specific beats generic.",
        action_steps: [
          "Rewrite my DM to prospective clients: one thing I noticed, the issue it causes, one easy question.",
          "Cut every first message to under 80 words with no links.",
          "Check replies after 6 weeks and keep whichever version wins.",
        ],
      },
      software_engineer: {
        headline: "Treat the opener like a well-scoped PR description",
        paraphrase:
          "Observation, impact, a small ask. A sales team used that structure in cold emails and went from 9% to 31% replies. It's the same shape that gets reviews and cross-team help: give people something verifiable before asking for their time.",
        action_steps: [
          "Write my next cross-team request as: what I observed, what it breaks, one easy question.",
          "Keep the message under 80 words and link nothing in the first note.",
          "Use it for the next recruiter or open-source maintainer outreach and compare replies.",
        ],
      },
      creator: {
        headline: "The best hook is something they can check",
        paraphrase:
          "Maya's cold email works like a great hook: a specific observation readers can verify in 10 seconds, the tension it creates, then a question that's easy to answer. It moved replies from 9% to 31%. I can use the same structure for brand pitches and collab DMs.",
        action_steps: [
          "Rewrite my brand pitch opener around one specific, checkable detail about the brand.",
          "Follow it with the problem it creates and a single easy-yes question.",
          "Keep pitches under 80 words with no media kit attached on first touch.",
        ],
      },
      student: {
        headline: "Ask for help with a specific, checkable reason",
        paraphrase:
          "Generic 'do you have 15 minutes?' asks get ignored. Leading with a concrete observation, the problem it causes and an easy-yes question took one team's replies from 9% to 31%. Same applies when I email a PI or a resident for a research spot.",
        action_steps: [
          "Open my next research-position email with one specific thing about their recent paper.",
          "Name the question it raised for me, then ask one easy-yes question.",
          "Keep it under 80 words and skip the CV attachment on the first email.",
        ],
      },
    },
  },
  {
    key: "costco-thesis",
    platform: "x",
    source_url: "https://x.com/compounding_cal/status/1790000000000000002",
    author: "@compounding_cal",
    verbatim_text: `$COST thesis, quick thread 🧵

Membership fees are ~half of operating income and renewal rates sit at 90%+ in US/Canada. That's the moat.

Bull case:
- Fee hike cycle (every ~5.5 yrs) adds high-margin revenue with almost no churn
- International warehouses still under 30% of the base
- Gas + e-commerce drive trip frequency

Bear case:
- Trades at ~50x earnings, priced for perfection
- Comps slow if gas prices fall

Catalyst: next fee increase + monthly comp prints.
What would make me wrong: renewal rate drops below 88% for two quarters.

Long, 3-5 year horizon.`,
    domain: "markets_thesis",
    structured: {
      domain: "markets_thesis",
      data: {
        tickers: ["COST"],
        direction: "long",
        bull_case: [
          "Fee hike cycle (every ~5.5 yrs) adds high-margin revenue with almost no churn",
          "International warehouses still under 30% of the base",
          "Gas + e-commerce drive trip frequency",
        ],
        bear_case: ["Trades at ~50x earnings, priced for perfection", "Comps slow if gas prices fall"],
        catalysts: ["Next fee increase", "Monthly comp prints"],
        key_metrics: [
          { label: "Renewal rate", value: "90%+" },
          { label: "Membership share of operating income", value: "~half" },
          { label: "P/E", value: "~50x" },
        ],
        invalidation_triggers: ["Renewal rate drops below 88% for two quarters"],
        time_horizon: "3-5 years",
      },
    },
    summary: "Long Costco on membership-fee economics and 90%+ renewals; main risk is a ~50x multiple.",
    key_metric: { label: "COST", value: "Long · 3-5 yr" },
    topics: ["COST", "retail", "membership model"],
    rewrites: {
      markets_analyst: {
        headline: "$COST: long the membership annuity, watch renewals",
        paraphrase:
          "Membership fees are roughly half of operating income with 90%+ renewals, so the fee-hike cycle every ~5.5 years is the core driver. The risk is valuation at ~50x earnings. Thesis breaks if renewals fall below 88% for two quarters.",
        action_steps: [
          "Add the renewal rate to my tracker with an alert below 88%.",
          "Mark the expected fee-increase window and monthly comp release dates.",
          "Size the position for a 3-5 year hold given the ~50x multiple.",
        ],
      },
      founder: {
        headline: "Recurring fees with 90%+ renewal is the moat to copy",
        paraphrase:
          "Costco makes about half its operating income from memberships that renew at 90%+, then raises fees every ~5.5 years with almost no churn. That's the business model lesson: earn the right to a recurring fee, then price it up slowly.",
        action_steps: [
          "Calculate what share of our gross margin is truly recurring.",
          "Define the renewal-rate number that would tell us our moat is weakening.",
          "Plan when we could next revisit pricing for existing customers.",
        ],
      },
    },
  },
  {
    key: "split-squat",
    platform: "tiktok",
    source_url: "https://www.tiktok.com/@liftwithrae/video/7300000000000000003",
    author: "@liftwithrae",
    verbatim_text: `Leg day that actually grows glutes (save this):

1. Bulgarian split squat: 4 sets x 8 reps each leg, 3-1-1 tempo, 90 sec rest
2. Romanian deadlift: 3 x 10, 2 min rest
3. Hip thrust: 3 x 12, pause 2 sec at the top
4. Walking lunges: 2 x 20 steps

Add weight when you hit the top of the rep range with 2 reps left in the tank.`,
    domain: "fitness_nutrition",
    structured: {
      domain: "fitness_nutrition",
      data: {
        exercises: [
          { name: "Bulgarian split squat", sets: 4, reps: "8 each leg", rest: "90 sec", tempo: "3-1-1", notes: null },
          { name: "Romanian deadlift", sets: 3, reps: "10", rest: "2 min", tempo: null, notes: null },
          { name: "Hip thrust", sets: 3, reps: "12", rest: null, tempo: null, notes: "Pause 2 sec at the top" },
          { name: "Walking lunges", sets: 2, reps: "20 steps", rest: null, tempo: null, notes: null },
        ],
        macros: null,
        ingredients: [],
        timing: null,
      },
    },
    summary: "A four-exercise glute-focused leg day with progression when you hit the top of the rep range with 2 reps in reserve.",
    key_metric: { label: "Split squat", value: "4×8 · 3-1-1" },
    topics: ["leg day", "glutes", "progressive overload"],
    rewrites: {
      fitness_coach: {
        headline: "Leg day: split squats 4×8 at 3-1-1, then hinge and thrust",
        paraphrase:
          "Start with Bulgarian split squats, 4 sets of 8 each leg on a 3-1-1 tempo with 90 sec rest. Follow with RDLs 3×10, hip thrusts 3×12 with a 2 sec pause, and 2×20 walking lunges. Load goes up once you hit the top of the range with 2 reps in reserve.",
        action_steps: [
          "Program this as Thursday's session: split squat 4×8, RDL 3×10, hip thrust 3×12, lunges 2×20.",
          "Film one split-squat set to check the 3-1-1 tempo.",
          "Log RIR on each set and add weight when I have 2 left at the top of the range.",
        ],
      },
      yoga_instructor: {
        headline: "A slow, strong leg sequence that respects the tempo",
        paraphrase:
          "The anchor is a Bulgarian split squat done slowly, 4 rounds of 8 per side at a 3-1-1 tempo with 90 seconds to breathe between. Romanian deadlifts, paused hip thrusts and walking lunges round it out. Progress only when you finish with 2 reps still in reserve.",
        action_steps: [
          "Try the split squat on a 3-1-1 count, breathing out on the way up.",
          "Use the 90 sec rest for slow nasal breathing before the next set.",
          "Add load only when the last set still leaves 2 reps in the tank.",
        ],
      },
      student: {
        headline: "One efficient leg session for a packed week",
        paraphrase:
          "Four moves: split squats 4×8 each leg (3-1-1 tempo, 90 sec rest), Romanian deadlifts 3×10 (2 min rest), hip thrusts 3×12 with a 2 sec pause, walking lunges 2×20. Progress when you reach the top of the range with 2 reps left.",
        action_steps: [
          "Book one gym slot this week around exams for this exact session.",
          "Save the four exercises with sets and reps in my notes app.",
          "Add weight next time I finish a set with 2 reps left at the top of the range.",
        ],
      },
    },
  },
  {
    key: "overnight-oats",
    platform: "instagram",
    source_url: "https://www.instagram.com/reel/C7abc123XYZ/",
    author: "@proteinpantry",
    verbatim_text: `High-protein overnight oats, 5 min prep:

½ cup oats
1 scoop vanilla whey (30g)
¾ cup Greek yogurt
½ cup milk
1 tbsp chia seeds
Berries on top

Macros: 520 cal | 48g protein | 58g carbs | 11g fat

Mix, fridge overnight, eat within 45 min of your morning workout.`,
    domain: "fitness_nutrition",
    structured: {
      domain: "fitness_nutrition",
      data: {
        exercises: [],
        macros: { calories: 520, protein_g: 48, carbs_g: 58, fat_g: 11 },
        ingredients: [
          { item: "oats", quantity: "½ cup" },
          { item: "vanilla whey", quantity: "1 scoop (30g)" },
          { item: "Greek yogurt", quantity: "¾ cup" },
          { item: "milk", quantity: "½ cup" },
          { item: "chia seeds", quantity: "1 tbsp" },
          { item: "berries", quantity: null },
        ],
        timing: "Within 45 min of a morning workout",
      },
    },
    summary: "5-minute overnight oats with 48g protein and 520 calories, eaten after a morning workout.",
    key_metric: { label: "Protein", value: "48g" },
    topics: ["meal prep", "breakfast", "protein"],
    rewrites: {
      fitness_coach: {
        headline: "48g protein breakfast I can prep in 5 minutes",
        paraphrase:
          "Oats, a 30g scoop of whey, Greek yogurt, milk and chia, mixed the night before. It lands at 520 cal with 48g protein, 58g carbs and 11g fat, and it's meant for within 45 min of a morning session.",
        action_steps: [
          "Prep three jars on Sunday night for my training days.",
          "Log it once in my tracker as 520 cal / 48P / 58C / 11F.",
          "Eat it within 45 min after morning lifts.",
        ],
      },
      student: {
        headline: "A 5-minute, 48g-protein breakfast for early mornings",
        paraphrase:
          "Mix ½ cup oats, 1 scoop whey, ¾ cup Greek yogurt, ½ cup milk and 1 tbsp chia the night before. It's 520 calories and 48g protein, ready to grab before a long day of lectures or rotations.",
        action_steps: [
          "Add oats, whey, Greek yogurt and chia to this week's grocery list.",
          "Prep two jars the night before my earliest days.",
          "Keep the macros in my notes: 520 cal, 48g protein.",
        ],
      },
    },
  },
  {
    key: "readme-first",
    platform: "youtube",
    source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    author: "Systems Notebook",
    verbatim_text: `[Transcript excerpt] Before I write any code for a new service, I write the README. What it does, how you call it, what it will never do. Last quarter our team did this for 12 internal services and design review time dropped from about two weeks to three days, because reviewers argued about the README instead of the implementation. If you can't explain the interface in one page, the design isn't done.`,
    domain: "tech",
    structured: {
      domain: "tech",
      data: {
        key_ideas: [
          "Write the README before the code: purpose, interface, non-goals.",
          "Reviewers can debate the interface before implementation exists.",
          "If the interface doesn't fit on one page, the design isn't done.",
        ],
        quotes: ["If you can't explain the interface in one page, the design isn't done."],
      },
    },
    summary: "Writing the README before the code cut one team's design review time from about two weeks to three days across 12 services.",
    key_metric: { label: "Design review", value: "~2 wks → 3 days" },
    topics: ["documentation", "system design", "code review"],
    rewrites: {
      software_engineer: {
        headline: "README first, code second",
        paraphrase:
          "Before building a service, write what it does, how to call it and what it will never do. One team did this for 12 services and design review went from about two weeks to three days, because the debate happened on one page instead of in the diff.",
        action_steps: [
          "Write a one-page README for my next service before opening an editor.",
          "Include an explicit 'will never do' section for non-goals.",
          "Send the README for review before any implementation PR.",
        ],
      },
      founder: {
        headline: "Make the team write the README before the build",
        paraphrase:
          "A team that wrote READMEs first for 12 services cut design review from about two weeks to three days. For us it's a cheap way to force clarity on scope and non-goals before engineering time is spent.",
        action_steps: [
          "Make a one-page README a requirement for any new service or major feature.",
          "Ask for a 'will never do' section to protect scope.",
          "Review the README, not the code, in the next planning meeting.",
        ],
      },
    },
  },
  {
    key: "two-minute-rule",
    platform: "x",
    source_url: "https://x.com/slowbuild/status/1800000000000000006",
    author: "@slowbuild",
    verbatim_text: `The habit advice that finally worked for me:

Make the first version so small it takes under 2 minutes.

Not "run 5k." Put on running shoes.
Not "read 30 pages." Read one page.
Not "meditate 20 min." Sit down and take 3 breaths.

You're not building the habit yet. You're building the identity of someone who shows up. Scale it after 21 days of not missing.`,
    domain: "mindset",
    structured: {
      domain: "mindset",
      data: {
        key_ideas: [
          "Shrink the first version of a habit to under 2 minutes.",
          "Early on you're building the identity of someone who shows up.",
          "Scale the habit only after 21 days of not missing.",
        ],
        quotes: ["You're not building the habit yet. You're building the identity of someone who shows up."],
      },
    },
    summary: "Start habits at under two minutes and only scale after 21 unbroken days.",
    key_metric: { label: "Rule", value: "< 2 min · 21 days" },
    topics: ["habits", "identity", "consistency"],
    rewrites: {
      yoga_instructor: {
        headline: "Three breaths is enough to begin",
        paraphrase:
          "Make the first version so small it takes under 2 minutes: three breaths instead of twenty minutes of meditation. The goal at first is simply becoming someone who shows up. Grow the practice only after 21 days without missing.",
        action_steps: [
          "Offer students a 2-minute home practice: sit and take 3 breaths.",
          "Ask them to track 21 days in a row before adding anything.",
          "Model it myself with a 2-minute morning practice this month.",
        ],
      },
      creator: {
        headline: "Publish the 2-minute version every day",
        paraphrase:
          "The trick is making the first version so small it takes under 2 minutes, then scaling only after 21 days of not missing. For writing, that's one sentence a day until showing up is who I am.",
        action_steps: [
          "Write one sentence every day for 21 days, no word count goal.",
          "Track the streak somewhere I'll see it each morning.",
          "Scale to a full draft session only after day 21.",
        ],
      },
      sales_exec: {
        headline: "Two-minute prospecting before the inbox",
        paraphrase:
          "Make the habit so small it takes under 2 minutes, then scale after 21 days without missing. For prospecting, that's one personalized first line every morning before I open email.",
        action_steps: [
          "Write one personalized opener every morning before checking email.",
          "Keep the streak for 21 days without missing.",
          "Scale to five openers a day after day 21.",
        ],
      },
    },
  },
];

/** The save the landing-page demo rewrites live across every persona. */
export const LANDING_DEMO_SAVE = DEMO_SAVES[0]!;
