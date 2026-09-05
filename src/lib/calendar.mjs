/**
 * The community calendar embed.
 *
 * What's On embedded a personal Google Calendar until v1.11. An embedded
 * calendar is public in full: anyone who has the page can download every event
 * ever put in it, including the ones that were never meant for the town. The
 * address now comes from `data/community-calendar.json`, it is empty until a
 * calendar made for the purpose exists, and a consumer mail address fails the
 * build rather than shipping.
 */
import { loadDataFile } from "./editions.mjs";

/**
 * Domains where an address is somebody's own mail, so the calendar behind it is
 * their own life. A calendar created for a community has an id under
 * `@group.calendar.google.com`.
 */
const PERSONAL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.au",
  "outlook.com",
  "outlook.com.au",
  "live.com",
  "live.com.au",
  "yahoo.com",
  "yahoo.com.au",
  "bigpond.com",
  "bigpond.net.au",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
];

/** True when the id is a person's mailbox rather than a calendar made to be shared. */
export function isPersonalCalendarId(calendarId) {
  const domain = String(calendarId || "")
    .trim()
    .toLowerCase()
    .split("@")[1];
  return Boolean(domain) && PERSONAL_DOMAINS.includes(domain);
}

/**
 * The configured calendar, or null when there is none yet.
 * Throws on a personal address so the leak cannot come back quietly.
 */
export function communityCalendar() {
  const config = loadDataFile("community-calendar.json", null);
  const calendarId = String(config?.calendarId || "").trim();
  if (!calendarId) return null;
  if (isPersonalCalendarId(calendarId)) {
    throw new Error(
      `data/community-calendar.json: "${calendarId}" is a personal mail address. ` +
        "An embedded calendar is public in full. Use a calendar created for the " +
        "community, whose id ends in @group.calendar.google.com."
    );
  }
  const params = new URLSearchParams({
    mode: "AGENDA",
    wkst: "2",
    ctz: "Australia/Melbourne",
    title: "Love Mallacoota",
    src: calendarId,
    color: "#7986cb",
  });
  return {
    calendarId,
    embedUrl: `https://calendar.google.com/calendar/embed?${params.toString()}`,
    publicUrl: String(config?.publicUrl || "").trim() || null,
  };
}

/**
 * Another organisation's calendar, embedded alongside ours.
 *
 * MDHSS keeps its programs in a calendar under a gmail.com address, which the
 * guard above refuses. The guard is right about the risk and wrong about this
 * calendar: `mallacootahealthextcal@gmail.com` is an account made to hold a
 * public calendar, not somebody's mailbox, and MDHSS already embed it on their
 * own site.
 *
 * So the exception is not "trust me". A partner on a personal domain must name
 * `publishedAt`, the page where its owner already publishes it. If the owner
 * has put it in front of the public themselves, embedding it here exposes
 * nothing new; if nobody can point at such a page, the build fails exactly as
 * it did before.
 */
export function partnerCalendars() {
  const config = loadDataFile("community-calendar.json", null);
  const partners = Array.isArray(config?.partners) ? config.partners : [];
  return partners.map((partner) => {
    const calendarId = String(partner?.calendarId || "").trim();
    if (!calendarId) throw new Error("data/community-calendar.json: a partner with no calendarId.");
    if (isPersonalCalendarId(calendarId) && !String(partner?.publishedAt || "").trim()) {
      throw new Error(
        `data/community-calendar.json: "${calendarId}" is on a personal mail domain and names no ` +
          "publishedAt. Embedding it would publish whatever is in it. Give the page where its " +
          "owner already publishes it, or use a calendar id under @group.calendar.google.com."
      );
    }
    const params = new URLSearchParams({
      mode: "AGENDA",
      wkst: "2",
      ctz: "Australia/Melbourne",
      title: partner.title || "Calendar",
      src: calendarId,
      showTitle: "0",
      showPrint: "0",
      showCalendars: "0",
    });
    return {
      calendarId,
      title: partner.title || "Calendar",
      listing: partner.listing || null,
      publishedAt: String(partner.publishedAt || "").trim() || null,
      embedUrl: `https://calendar.google.com/calendar/embed?${params.toString()}`,
    };
  });
}
