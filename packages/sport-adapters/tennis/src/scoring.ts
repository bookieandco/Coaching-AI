import type { TennisMatchState, TennisScore } from "./index";

export type TennisGamePoint = 0 | 15 | 30 | 40;

export interface TennisPointTransition {
  state: TennisMatchState;
  gameWon: boolean;
  setWon: boolean;
  matchWon: boolean;
  winnerParticipantId?: string;
}

function scoreFor(state: TennisMatchState, id: string): TennisScore {
  return state.attributes.tennisScore[id] ?? { points: 0, games: 0, sets: 0, tiebreakPoints: 0 };
}

function withScore(state: TennisMatchState, id: string, score: TennisScore): TennisMatchState {
  return { ...state, attributes: { ...state.attributes, tennisScore: { ...state.attributes.tennisScore, [id]: score } } };
}

function setTiebreakFlag(state: TennisMatchState, enabled: boolean): TennisMatchState {
  return { ...state, attributes: { ...state.attributes, currentSetTiebreak: enabled } };
}

function targetSets(state: TennisMatchState): number {
  return Math.floor(state.attributes.bestOfSets / 2) + 1;
}

function finishSet(state: TennisMatchState, winnerId: string, loserId: string, winnerGames: number, loserGames: number): TennisMatchState {
  const winner = scoreFor(state, winnerId);
  const loser = scoreFor(state, loserId);
  const completedSets = [...state.attributes.completedSets, {
    winnerParticipantId: winnerId,
    loserParticipantId: loserId,
    gamesWinner: winnerGames,
    gamesLoser: loserGames,
  }];
  const nextWinner = { ...winner, points: 0, games: 0, sets: winner.sets + 1, tiebreakPoints: 0 };
  const nextLoser = { ...loser, points: 0, games: 0, sets: loser.sets, tiebreakPoints: 0 };
  const next = withScore(withScore(setTiebreakFlag(state, false), winnerId, nextWinner), loserId, nextLoser);
  return {
    ...next,
    attributes: { ...next.attributes, completedSets },
    score: {
      values: Object.fromEntries(state.participants.map((p) => [p.participantId, scoreFor(next, p.participantId).sets])),
      leaderParticipantId: nextWinner.sets >= targetSets(state) ? winnerId : undefined,
    },
  };
}

function maybeFinishSet(state: TennisMatchState, winnerId: string, loserId: string): TennisPointTransition {
  const winner = scoreFor(state, winnerId);
  const loser = scoreFor(state, loserId);
  const gameWon = winner.games !== loser.games && winner.games >= 6 && winner.games - loser.games >= 2;
  const tiebreakWon = state.attributes.currentSetTiebreak === true && winner.games === 7;
  if (!gameWon && !tiebreakWon) return { state, gameWon: false, setWon: false, matchWon: false };
  const finished = finishSet(state, winnerId, loserId, winner.games, loser.games);
  const matchWon = scoreFor(finished, winnerId).sets >= targetSets(state);
  return { state: finished, gameWon: true, setWon: true, matchWon, winnerParticipantId: matchWon ? winnerId : undefined };
}

function completeGameOrEnterTiebreak(state: TennisMatchState, winnerId: string, loserId: string): TennisPointTransition {
  const withTiebreak = enterTiebreakIfRequired(state);
  if (withTiebreak.attributes.currentSetTiebreak) return { state: withTiebreak, gameWon: true, setWon: false, matchWon: false };
  return maybeFinishSet(withTiebreak, winnerId, loserId);
}

export function applyTennisPoint(state: TennisMatchState, winnerId: string): TennisPointTransition {
  const ids = state.participants.map((p) => p.participantId);
  if (ids.length !== 2 || !ids.includes(winnerId)) return { state, gameWon: false, setWon: false, matchWon: false };
  if (state.attributes.completedSets.length >= targetSets(state)) return { state, gameWon: false, setWon: false, matchWon: true, winnerParticipantId: winnerId };

  const loserId = ids[0] === winnerId ? ids[1] : ids[0];
  let winner = { ...scoreFor(state, winnerId) };
  let loser = { ...scoreFor(state, loserId) };

  if (state.attributes.currentSetTiebreak) {
    winner.tiebreakPoints += 1;
    const next = withScore(withScore(state, winnerId, winner), loserId, loser);
    const a = scoreFor(next, winnerId);
    const b = scoreFor(next, loserId);
    if (a.tiebreakPoints >= 7 && a.tiebreakPoints - b.tiebreakPoints >= 2) {
      winner.games = 7;
      const scored = withScore(withScore(next, winnerId, winner), loserId, loser);
      return maybeFinishSet(scored, winnerId, loserId);
    }
    return { state: next, gameWon: false, setWon: false, matchWon: false };
  }

  const advantage = state.attributes.advantageParticipantId;
  if (winner.points === 40 && loser.points === 40) {
    if (advantage === winnerId) {
      winner.games += 1; winner.points = 0; loser.points = 0;
      const next = withScore(withScore({ ...state, attributes: { ...state.attributes, advantageParticipantId: undefined } }, winnerId, winner), loserId, loser);
      return completeGameOrEnterTiebreak(next, winnerId, loserId);
    }
    if (advantage === loserId) {
      const next = { ...state, attributes: { ...state.attributes, advantageParticipantId: undefined } };
      return { state: next, gameWon: false, setWon: false, matchWon: false };
    }
    return { state: { ...state, attributes: { ...state.attributes, advantageParticipantId: winnerId } }, gameWon: false, setWon: false, matchWon: false };
  }

  if (advantage === winnerId) {
    winner.games += 1; winner.points = 0; loser.points = 0;
    const next = withScore(withScore({ ...state, attributes: { ...state.attributes, advantageParticipantId: undefined } }, winnerId, winner), loserId, loser);
    return completeGameOrEnterTiebreak(next, winnerId, loserId);
  }

  if (advantage === loserId) {
    const next = { ...state, attributes: { ...state.attributes, advantageParticipantId: undefined } };
    return { state: next, gameWon: false, setWon: false, matchWon: false };
  }

  if (winner.points < 40) {
    winner.points = winner.points === 0 ? 15 : winner.points === 15 ? 30 : 40;
  } else if (loser.points < 40) {
    winner.games += 1; winner.points = 0; loser.points = 0;
    const next = withScore(withScore(state, winnerId, winner), loserId, loser);
    return completeGameOrEnterTiebreak(next, winnerId, loserId);
  }

  const next = withScore(withScore(state, winnerId, winner), loserId, loser);
  return { state: next, gameWon: false, setWon: false, matchWon: false };
}

export function enterTiebreakIfRequired(state: TennisMatchState): TennisMatchState {
  const ids = state.participants.map((p) => p.participantId);
  if (ids.length !== 2) return state;
  const a = scoreFor(state, ids[0]);
  const b = scoreFor(state, ids[1]);
  if (a.games === 6 && b.games === 6) {
    return { ...setTiebreakFlag(state, true), attributes: { ...state.attributes, advantageParticipantId: undefined } };
  }
  return state;
}
