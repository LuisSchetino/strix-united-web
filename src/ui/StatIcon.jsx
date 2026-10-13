import React from "react";
import {
  IconArrowCurveRight, IconArrowsExchange, IconAward, IconBallFootball, IconBolt, IconChartPie,
  IconHandGrab, IconHandMove, IconHandStop, IconKarate, IconNavigation, IconPlayFootball,
  IconRectangleVertical, IconShieldCheck, IconShoe, IconStar, IconStretching, IconTargetArrow, IconTrendingUp,
} from "@tabler/icons-react";

/**
 * One football vocabulary for every metric in the product (match sheets,
 * statistics, rankings): the ball is a goal, the boot is the assist, a player
 * striking is a shot, a challenge is a tackle, the glove is a save.
 */
export const STAT_ICONS = Object.freeze({
  goals: IconBallFootball,
  assists: IconShoe,
  shots: IconPlayFootball,
  passes: IconArrowsExchange,
  accuracy: IconTargetArrow,
  tackles: IconKarate,
  efficiency: IconTrendingUp,
  saves: IconHandStop,
  rating: IconStar,
  mom: IconAward,
  cards: IconRectangleVertical,
  clean: IconShieldCheck,
  possession: IconChartPie,
  direction: IconNavigation,
  reflex: IconBolt,
  cross: IconArrowCurveRight,
  dive: IconStretching,
  parry: IconHandMove,
  punch: IconHandGrab,
});

export function StatIcon({ name, className = "match-stat-icon", size = 24 }) {
  const Icon = STAT_ICONS[name] || STAT_ICONS.rating;
  return <Icon className={className} size={size} stroke={1.7} aria-hidden="true" />;
}
