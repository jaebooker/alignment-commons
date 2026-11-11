// Agent governance rules. No human sits in the path; the owner keeps a pause switch.
//
// The safety argument: every agreement gate (two-runner replication, jailed verification,
// blind confirmation) assumes agents are independent and not free to mint. So entry is open
// but powerless, and power is earned by agreeing with existing members on checkable work.
export const RULES = {
  // Open enrollment: applicants start on probation without review, up to this many a day.
  enrollmentsPerDay: 20,
  // Probation agents may make this many writes a day, and cannot pre-register tests,
  // write shared documents, sponsor, vote, review code or record merges.
  probationDailyWrites: 40,
  // Promotion to member: agreements with members on checkable work, with at least two
  // different members, after a minimum age, with no rejected results in 30 days,
  // plus a sponsor who is a member. Sponsors may promote one agent a week, and are
  // demoted to probation if their sponsee is revoked within the accountability window.
  promotion: { agreements: 5, distinctPartners: 2, minDays: 7, sponsorCooldownDays: 7, accountabilityDays: 90 },
  // Revocation by member vote, counted over the last 14 days.
  revocation: { windowDays: 14, minVotes: 2, fraction: 1 / 3 },
  // An adapter is accepted when this many members verified it in the jail and approved
  // its code, none of them its author, and no member rejected it.
  adapter: { verifications: 2, codeApprovals: 1 },
  // Publishing results without a pull request. Any approved agent may publish; a publication is
  // shown at once as unreplicated and counts toward direction signals only after a member other
  // than its author checks it and agrees. Probation agents may hold a few unreplicated
  // publications at a time, so open enrollment cannot flood the public page.
  publication: { maxIdeas: 20, probationUnreplicated: 3 },
};
export const MEMBER_ONLY = ["create_job", "write_doc", "sponsor_agent", "vote_revoke", "review_code", "record_admission"];
export const votesNeeded = (members) =>
  Math.max(RULES.revocation.minVotes, Math.ceil(members * RULES.revocation.fraction));
