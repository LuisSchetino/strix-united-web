import React, { useMemo } from "react";
import { canManageCompetitions } from "../../access.js";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { saoPauloDay, todayAgendaMatches } from "../agenda/agenda-time.js";
import { endedEditions } from "../competitions/ended-editions.js";
import { myNight } from "../home/home-core.js";
import { libraryGlance } from "../library/library-glance.js";
import { clubMilestones } from "../players/milestones.js";
import { rosterProfiles } from "../players/roster-profiles.js";
import { NotificationBell } from "./NotificationBell.jsx";
import { buildNotifications } from "./notifications-core.js";
import { problemNotices } from "../support/problem-core.js";
import { writeRemembered } from "../../ui/useRemembered.js";

const WEEK = 7 * 86_400_000;

/** Gathers what the shell already knows into the member's notices and hands them to the bell. */
export function NotificationCenter({ workspace, profile, ownPlayer, library, navigate, lineupsLocked = false }) {
  const now = useMinuteClock();
  const day = saoPauloDay(now);
  const mine = useMemo(
    () => myNight({ player: ownPlayer, tonight: todayAgendaMatches(workspace.agenda, now) }),
    [ownPlayer, workspace.agenda, day],
  );
  const milestones = useMemo(
    () => (ownPlayer ? clubMilestones(rosterProfiles({ matches: workspace.statMatches, players: workspace.players, aliases: workspace.aliases }).filter((entry) => String(entry.playerId) === String(ownPlayer.id)), { since: now.getTime() - WEEK }) : []),
    [ownPlayer, workspace.statMatches, workspace.players, workspace.aliases, day],
  );
  const ended = useMemo(
    () => (canManageCompetitions(profile) ? endedEditions({ editions: workspace.competitionEditions, competitions: workspace.competitions, sources: workspace.competitionSources, fixtures: workspace.competitionFixtures }) : []),
    [profile, workspace.competitionEditions, workspace.competitions, workspace.competitionSources, workspace.competitionFixtures],
  );
  const glance = useMemo(
    () => libraryGlance({ items: library?.items, progress: library?.progress, userId: profile?.user_id, player: ownPlayer, now }),
    [library?.items, library?.progress, profile?.user_id, ownPlayer, day],
  );
  const notices = useMemo(
    () => buildNotifications({
      // While the day's required plays are owed, the bell does not say where he plays either.
      now, player: ownPlayer, mine: lineupsLocked ? null : mine, agenda: workspace.agenda, matches: workspace.matches,
      library: glance, milestones, notice: workspace.notice, endedEditions: ended, canArchive: canManageCompetitions(profile),
      problems: problemNotices({ reports: workspace.problemReports, profile, now }),
    }),
    [now, ownPlayer, mine, lineupsLocked, workspace.agenda, workspace.matches, glance, milestones, workspace.notice, ended, profile, workspace.problemReports],
  );
  const open = (target) => {
    if (!target?.page) return;
    // a notice may open its page on a given tab (the Desenvolvedor's "Problemas")
    if (Array.isArray(target.remember)) writeRemembered(target.remember[0], target.remember[1]);
    navigate(target.page, target.id ? { id: target.id, params: target.params } : undefined);
  };
  return <NotificationBell notices={notices} onOpen={open} />;
}
