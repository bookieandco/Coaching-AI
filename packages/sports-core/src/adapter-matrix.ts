import type { SportCapabilities, SportCode } from "./index";

export const SPORT_CAPABILITIES: Record<SportCode, SportCapabilities> = {
  basketball: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  american_football: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  soccer: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  baseball: {
    hasTeams: true, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: false, hasSets: false,
    hasRounds: false, hasInnings: true, hasContinuousPlay: false,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  ice_hockey: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  tennis: {
    hasTeams: false, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: true,
    hasRounds: false, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: false, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  volleyball: {
    hasTeams: true, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: false, hasSets: true,
    hasRounds: false, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  rugby: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  cricket: {
    hasTeams: true, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: false, hasPeriods: false, hasSets: false,
    hasRounds: false, hasInnings: true, hasContinuousPlay: false,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  golf: {
    hasTeams: false, hasPossession: false, hasClock: false, hasSpatialModel: true,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: false,
    hasRounds: true, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: false, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  lacrosse: {
    hasTeams: true, hasPossession: true, hasClock: true, hasSpatialModel: true,
    hasLineups: true, hasSubstitutions: true, hasPeriods: true, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: true, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  combat_sports: {
    hasTeams: false, hasPossession: false, hasClock: true, hasSpatialModel: true,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: false,
    hasRounds: true, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: false, supportsPlayerTracking: true, supportsObjectTracking: true,
  },
  motorsports: {
    hasTeams: true, hasPossession: false, hasClock: true, hasSpatialModel: true,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: false,
    hasRounds: true, hasInnings: false, hasContinuousPlay: true,
    supportsTacticalFormation: false, supportsPlayerTracking: false, supportsObjectTracking: true,
  },
  other: {
    hasTeams: false, hasPossession: false, hasClock: false, hasSpatialModel: false,
    hasLineups: false, hasSubstitutions: false, hasPeriods: false, hasSets: false,
    hasRounds: false, hasInnings: false, hasContinuousPlay: false,
    supportsTacticalFormation: false, supportsPlayerTracking: false, supportsObjectTracking: false,
  },
};
