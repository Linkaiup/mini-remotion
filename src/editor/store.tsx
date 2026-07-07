import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { applyEditorPatch } from "./apply-patch";
import { withSyncedProjectDuration } from "./project-duration";
import { loadEditorProject, saveEditorProject } from "./sample-project";
import type {
  AgentChatMessage,
  EditorClip,
  EditorPatch,
  EditorProject,
  EditorSelection,
} from "./types";

type EditorState = {
  project: EditorProject;
  selection: EditorSelection;
  frame: number;
  playing: boolean;
  past: EditorProject[];
  future: EditorProject[];
  agentMessages: AgentChatMessage[];
  agentBusy: boolean;
};

type Action =
  | { type: "SET_PROJECT"; project: EditorProject; pushHistory?: boolean }
  | { type: "UPDATE_CLIP"; trackId: string; clipId: string; patch: Partial<EditorClip> }
  | { type: "SELECT"; selection: EditorSelection }
  | { type: "SET_FRAME"; frame: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "DELETE_SELECTION" }
  | { type: "SPLIT_AT_PLAYHEAD" }
  | { type: "AGENT_ADD_MESSAGE"; message: AgentChatMessage }
  | { type: "AGENT_UPDATE_MESSAGE"; id: string; patch: Partial<AgentChatMessage> }
  | { type: "AGENT_SET_BUSY"; busy: boolean }
  | { type: "APPLY_PATCH"; patch: EditorPatch }
  | { type: "ADD_CLIP"; trackId: string; clip: EditorClip };

const pushPast = (state: EditorState, project: EditorProject): EditorState => ({
  ...state,
  past: [...state.past.slice(-49), project],
  future: [],
});

const reducer = (state: EditorState, action: Action): EditorState => {
  switch (action.type) {
    case "SET_PROJECT":
      return {
        ...state,
        project: action.project,
        ...(action.pushHistory ? pushPast(state, state.project) : {}),
      };
    case "UPDATE_CLIP": {
      const next = withSyncedProjectDuration({
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id !== action.trackId
            ? t
            : {
                ...t,
                clips: t.clips.map((c) =>
                  c.id === action.clipId
                    ? ({ ...c, ...action.patch } as EditorClip)
                    : c,
                ),
              },
        ),
      });
      saveEditorProject(next);
      return { ...pushPast(state, state.project), project: next };
    }
    case "SELECT":
      return { ...state, selection: action.selection };
    case "SET_FRAME":
      return {
        ...state,
        frame: Math.max(
          0,
          Math.min(action.frame, state.project.durationInFrames - 1),
        ),
      };
    case "SET_PLAYING":
      return { ...state, playing: action.playing };
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        project: prev,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        project: next,
        past: [...state.past, state.project],
        future: rest,
      };
    }
    case "DELETE_SELECTION": {
      if (!state.selection) return state;
      const next = {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id !== state.selection!.trackId
            ? t
            : {
                ...t,
                clips: t.clips.filter((c) => c.id !== state.selection!.clipId),
              },
        ),
      };
      return {
        ...pushPast(state, state.project),
        project: next,
        selection: null,
      };
    }
    case "SPLIT_AT_PLAYHEAD": {
      if (!state.selection) return state;
      const { trackId, clipId } = state.selection;
      const f = state.frame;
      let split = false;
      const nextTracks = state.project.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const out: EditorClip[] = [];
        for (const c of t.clips) {
          if (c.id !== clipId || f <= c.from || f >= c.from + c.durationInFrames) {
            out.push(c);
            continue;
          }
          const leftDur = f - c.from;
          const rightDur = c.durationInFrames - leftDur;
          if (leftDur < 1 || rightDur < 1) {
            out.push(c);
            continue;
          }
          split = true;
          out.push({ ...c, durationInFrames: leftDur });
          out.push({
            ...c,
            id: `${c.id}-split-${f}`,
            from: f,
            durationInFrames: rightDur,
            label: `${c.label ?? c.id} (2)`,
          });
        }
        return { ...t, clips: out };
      });
      if (!split) return state;
      return {
        ...pushPast(state, state.project),
        project: { ...state.project, tracks: nextTracks },
        selection: null,
      };
    }
    case "AGENT_ADD_MESSAGE":
      return {
        ...state,
        agentMessages: [...state.agentMessages, action.message],
      };
    case "AGENT_UPDATE_MESSAGE":
      return {
        ...state,
        agentMessages: state.agentMessages.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case "AGENT_SET_BUSY":
      return { ...state, agentBusy: action.busy };
    case "APPLY_PATCH":
      return {
        ...pushPast(state, state.project),
        project: applyEditorPatch(state.project, action.patch),
      };
    case "ADD_CLIP": {
      const nextProject = withSyncedProjectDuration({
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === action.trackId
            ? { ...t, clips: [...t.clips, action.clip] }
            : t,
        ),
      });
      saveEditorProject(nextProject);
      return {
        ...pushPast(state, state.project),
        project: nextProject,
        selection: { trackId: action.trackId, clipId: action.clip.id },
        frame: action.clip.from,
      };
    }
    default:
      return state;
  }
};

type EditorStore = EditorState & {
  dispatch: React.Dispatch<Action>;
  selectedClip: EditorClip | null;
  selectedTrackId: string | null;
  updateClip: (patch: Partial<EditorClip>) => void;
  persist: () => void;
};

const EditorContext = createContext<EditorStore | null>(null);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    project: loadEditorProject(),
    selection: {
      trackId: "track-text",
      clipId: "clip-title",
    } as EditorSelection,
    frame: 0,
    playing: false,
    past: [],
    future: [],
    agentMessages: [] as AgentChatMessage[],
    agentBusy: false,
  }));

  const selectedClip = useMemo(() => {
    if (!state.selection) return null;
    const track = state.project.tracks.find(
      (t) => t.id === state.selection!.trackId,
    );
    return track?.clips.find((c) => c.id === state.selection!.clipId) ?? null;
  }, [state.project, state.selection]);

  const updateClip = useCallback(
    (patch: Partial<EditorClip>) => {
      if (!state.selection) return;
      dispatch({
        type: "UPDATE_CLIP",
        trackId: state.selection.trackId,
        clipId: state.selection.clipId,
        patch,
      });
    },
    [state.selection],
  );

  const persist = useCallback(() => {
    saveEditorProject(state.project);
  }, [state.project]);

  const value = useMemo<EditorStore>(
    () => ({
      ...state,
      dispatch,
      selectedClip,
      selectedTrackId: state.selection?.trackId ?? null,
      updateClip,
      persist,
    }),
    [state, selectedClip, updateClip, persist],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

export const useEditor = (): EditorStore => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be inside EditorProvider");
  return ctx;
};
