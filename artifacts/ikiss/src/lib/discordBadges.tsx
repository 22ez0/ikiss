// Real Discord user flag bits (public_flags), per Discord's official API docs:
// https://discord.com/developers/docs/resources/user#user-object-user-flags
export const DISCORD_FLAG = {
  STAFF: 1 << 0,
  PARTNER: 1 << 1,
  HYPESQUAD_EVENTS: 1 << 2,
  BUG_HUNTER_LEVEL_1: 1 << 3,
  HYPESQUAD_BRAVERY: 1 << 6,
  HYPESQUAD_BRILLIANCE: 1 << 7,
  HYPESQUAD_BALANCE: 1 << 8,
  EARLY_SUPPORTER: 1 << 9,
  BUG_HUNTER_LEVEL_2: 1 << 14,
  VERIFIED_BOT: 1 << 16,
  EARLY_VERIFIED_BOT_DEVELOPER: 1 << 17,
  CERTIFIED_MODERATOR: 1 << 18,
  ACTIVE_DEVELOPER: 1 << 22,
} as const;

export interface DiscordBadge {
  key: string;
  label: string;
  icon: string;
}

import staffIcon from "../assets/discord-badges/discord-staff.svg";
import partnerIcon from "../assets/discord-badges/discord-partner.svg";
import hypesquadEventsIcon from "../assets/discord-badges/hype-squad-events.svg";
import braveryIcon from "../assets/discord-badges/hype-squad-bravery.svg";
import brillianceIcon from "../assets/discord-badges/hype-squad-brilliance.svg";
import balanceIcon from "../assets/discord-badges/hype-squad-balance.svg";
import bugHunter1Icon from "../assets/discord-badges/discord-bug-hunter-green.svg";
import bugHunter2Icon from "../assets/discord-badges/discord-bug-hunter-gold.svg";
import earlySupporterIcon from "../assets/discord-badges/discord-early-supporter.svg";
import activeDeveloperIcon from "../assets/discord-badges/active-developer.svg";
import certifiedModIcon from "../assets/discord-badges/discord-mod.svg";
import nitroIcon from "../assets/discord-badges/discord-nitro.svg";
import boostIcon from "../assets/discord-badges/discord-boost-1.svg";

export { nitroIcon, boostIcon };

/** Decodes a Discord `public_flags` bitfield into the real badges the account has. */
export function decodeDiscordBadges(publicFlags: number | null | undefined): DiscordBadge[] {
  if (!publicFlags) return [];
  const badges: DiscordBadge[] = [];
  const add = (flag: number, key: string, label: string, icon: string) => {
    if ((publicFlags & flag) === flag) badges.push({ key, label, icon });
  };
  add(DISCORD_FLAG.STAFF, "staff", "Discord Staff", staffIcon);
  add(DISCORD_FLAG.PARTNER, "partner", "Discord Partner", partnerIcon);
  add(DISCORD_FLAG.CERTIFIED_MODERATOR, "certified_mod", "Certified Moderator", certifiedModIcon);
  add(DISCORD_FLAG.HYPESQUAD_EVENTS, "hypesquad", "HypeSquad Events", hypesquadEventsIcon);
  add(DISCORD_FLAG.HYPESQUAD_BRAVERY, "bravery", "HypeSquad Bravery", braveryIcon);
  add(DISCORD_FLAG.HYPESQUAD_BRILLIANCE, "brilliance", "HypeSquad Brilliance", brillianceIcon);
  add(DISCORD_FLAG.HYPESQUAD_BALANCE, "balance", "HypeSquad Balance", balanceIcon);
  add(DISCORD_FLAG.BUG_HUNTER_LEVEL_2, "bug_hunter_2", "Bug Hunter Gold", bugHunter2Icon);
  add(DISCORD_FLAG.BUG_HUNTER_LEVEL_1, "bug_hunter_1", "Bug Hunter", bugHunter1Icon);
  add(DISCORD_FLAG.EARLY_SUPPORTER, "early_supporter", "Early Supporter", earlySupporterIcon);
  add(DISCORD_FLAG.ACTIVE_DEVELOPER, "active_developer", "Active Developer", activeDeveloperIcon);
  return badges;
}

// Discord's exact status colors (from the client design tokens).
export const DISCORD_STATUS_COLOR: Record<string, string> = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f42",
  offline: "#80848e",
};

/** Renders the real Discord presence indicator shape (notch for idle, dash for dnd, ring for offline). */
export function DiscordStatusIcon({ status, size = 10 }: { status: string; size?: number }) {
  const color = DISCORD_STATUS_COLOR[status] || DISCORD_STATUS_COLOR.offline;
  const s = size;
  if (status === "idle") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <mask id="idle-mask">
          <rect width="16" height="16" fill="white" />
          <circle cx="11" cy="5" r="5.2" fill="black" />
        </mask>
        <circle cx="8" cy="8" r="8" fill={color} mask="url(#idle-mask)" />
      </svg>
    );
  }
  if (status === "dnd") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" fill={color} />
        <rect x="3.2" y="6.4" width="9.6" height="3.2" rx="1.2" fill="#111214" />
      </svg>
    );
  }
  if (status === "offline") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" fill={color} />
        <circle cx="8" cy="8" r="4.2" fill="#111214" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="8" fill={color} />
    </svg>
  );
}
