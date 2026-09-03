import type { TennisMatchState } from "./index";
import { applyTennisPoint, enterTiebreakIfRequired } from "./scoring";

export interface TennisScoringInvariantResult {
  name: string;
  passed: boolean;
  detail?: string;
}

function stateWithScores(base: TennisMatchState, a: Partial<TennisMatchState["attributes"]["tennisScore"][string]>, b: Partial<TennisMatchState["attributes"]["tennisScore"][string]>): TennisMatchState {
  const ids = base.participants.map((p) => p.participantId);
  return {
    ...base,
    attributes: {
      ...base.attributes,
      tennisScore: {
        [ids[0]]: { points: 0, games: 0, sets: 0, tiebreakPoints: 0, ...a },
        [ids[1]]: { points: 0, games: 0, sets: 0, tiebreakPoints: 0, ...b },
      },
    },
  };
}

export function runTennisScoringInvariants(base: TennisMatchState): TennisScoringInvariantResult[] {
  const ids = base.participants.map((p) => p.participantId);
  if (ids.length !== 2) return [{ name: "two-participant-precondition", passed: false, detail: "Reference scoring vectors require two participants." }];
  const [a, b] = ids;
  const results: TennisScoringInvariantResult[] = [];

  const tiebreakEntry = enterTiebreakIfRequired(stateWithScores(base, { games: 6 }, { games: 6 }));
  results.push({ name: "six-six-enters-tiebreak", passed: tiebreakEntry.attributes.currentSetTiebreak === true });

  const deuce = stateWithScores(base, { points: 40 }, { points: 40 });
  const advantage = applyTennisPoint(deuce, a);
  results.push({ name: "deuce-awards-advantage", passed: advantage.state.attributes.advantageParticipantId === a });

  const backToDeuce = applyTennisPoint(advantage.state, b);
  results.push({ name: "advantage-lost-returns-to-deuce", passed: backToDeuce.state.attributes.advantageParticipantId === undefined && backToDeuce.state.attributes.tennisScore[a].games === 0 });

  const tieStart = tiebreakEntry;
  let tieState = tieStart;
  for (let i = 0; i < 7; i += 1) tieState = applyTennisPoint(tieState, a).state;
  const setScore = tieState.attributes.completedSets[0];
  results.push({ name: "seven-zero-tiebreak-completes-set", passed: setScore?.winnerParticipantId === a && setScore.gamesWinner === 7 && setScore.gamesLoser === 6 });

  return results;
}
