// Call state built only from backend events. Nothing here is invented: a value the backend
// hasn't sent is shown as absent, never guessed.

import type { Alert, Coercion, Entity, Envelope, Hit, Level, Risk, StatusPayload, Utterance } from "./types";

export interface CallState {
  sessionId: string | null;
  utterances: Utterance[]; // newest first
  hits: Record<string, Hit[]>;
  risk: Risk | null;
  history: { t: number; score: number; level: Level }[];
  stages: number[];
  chainTactics: Record<number, string[]>;
  mode: string | null;
  alert: Alert | null;
  claims: Entity[];
  status: Record<string, StatusPayload>;
  ended: boolean;
}

export const initialState: CallState = {
  sessionId: null,
  utterances: [],
  hits: {},
  risk: null,
  history: [],
  stages: [],
  chainTactics: {},
  mode: null,
  alert: null,
  claims: [],
  status: {},
  ended: false,
};

export type Action = { type: "reset"; sessionId: string } | { type: "event"; event: Envelope };

export function reduce(state: CallState, action: Action): CallState {
  if (action.type === "reset") return { ...initialState, sessionId: action.sessionId };
  const e = action.event;
  switch (e.type) {
    case "utterance": {
      const u = e.payload as Utterance;
      return { ...state, utterances: [u, ...state.utterances.filter((x) => x.utterance_id !== u.utterance_id)] };
    }
    case "coercion": {
      const c = e.payload as Coercion;
      const chainTactics: Record<number, string[]> = {};
      for (const step of c.chain) (chainTactics[step.stage] ??= []).push(step.tactic);
      return {
        ...state,
        hits: { ...state.hits, [c.utterance_id]: c.hits },
        stages: c.stages_reached,
        chainTactics,
        mode: c.mode,
      };
    }
    case "risk": {
      const r = e.payload as Risk;
      return { ...state, risk: r, history: [...state.history, { t: r.t_s, score: r.score, level: r.level }] };
    }
    case "entities":
      return { ...state, claims: (e.payload as { claims_so_far: Entity[] }).claims_so_far };
    case "alert":
      return { ...state, alert: e.payload as Alert };
    case "status": {
      const s = e.payload as StatusPayload;
      if (s.component === "session") return { ...state, ended: s.status === "ended" };
      return { ...state, status: { ...state.status, [s.component]: s } };
    }
    default:
      return state;
  }
}
