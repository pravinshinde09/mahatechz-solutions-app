import { useEventListener } from "expo";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { createElement, useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ProgressUpdate } from "@/contracts/learning";
import { api } from "@/api/client";
import { colors, radius } from "@/theme/tokens";
import { sendBeat } from "./heartbeats";

/** expo-video seeks by assigning `currentTime` — an imperative player API, not React state. */
function seek(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

/** Spec §15.5: every 30 s while playing, and on pause / end. */
const INTERVAL_MS = 30_000;
const MIN_GAP_MS = 8_000;

interface Tracked {
  lessonId: string;
  watchSessionId: string | null;
  resumeAt: number;
  onUpdate: (u: ProgressUpdate) => void;
}

/** Heartbeat scheduling shared by the native and embedded players. */
function useBeats({ lessonId, watchSessionId, onUpdate }: Omit<Tracked, "resumeAt">, read: () => { position: number; rate: number; playing: boolean }) {
  const last = useRef(0);
  const readRef = useRef(read);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    readRef.current = read;
    onUpdateRef.current = onUpdate;
  });
  const pulse = useCallback(
    async (force = false) => {
      if (!watchSessionId) return;
      if (!force && Date.now() - last.current < MIN_GAP_MS) return;
      last.current = Date.now();
      const res = await sendBeat({ lessonId, watchSessionId, ...readRef.current() });
      if (res) onUpdateRef.current(res);
    },
    [lessonId, watchSessionId],
  );
  useEffect(() => {
    if (!watchSessionId) return;
    const timer = setInterval(() => {
      if (readRef.current().playing) void pulse(true);
    }, INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // Leaving the lesson: report where the student stopped.
      void pulse(true);
    };
  }, [watchSessionId, pulse]);
  return pulse;
}

/** Hosted video (file or HLS) with expo-video: fullscreen, resume, speed via native controls (spec §23.6). */
export function NativeVideoPlayer({ url, ...tracked }: Tracked & { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.timeUpdateEventInterval = 1;
  });
  const resumed = useRef(false);
  const pulse = useBeats(tracked, () => ({ position: player.currentTime, rate: player.playbackRate, playing: player.playing }));
  const resumeAt = tracked.resumeAt;
  const lessonId = tracked.lessonId;

  useEventListener(player, "statusChange", ({ status }) => {
    // Resume where the student stopped (server-side position, so it follows them across devices).
    if (status === "readyToPlay" && !resumed.current) {
      resumed.current = true;
      if (resumeAt > 0 && (!player.duration || resumeAt < player.duration - 5)) seek(player, resumeAt);
    }
    // Signed URLs expire after a while (spec §23.6): fetch a fresh one and continue at the same spot.
    if (status === "error") {
      const at = player.currentTime;
      void api<{ url: string }>(`/lessons/${lessonId}/playback`).then(async (fresh) => {
        await player.replaceAsync(fresh.url);
        seek(player, at);
      });
    }
  });
  useEventListener(player, "playingChange", ({ isPlaying }) => {
    if (!isPlaying) void pulse();
  });
  useEventListener(player, "playToEnd", () => void pulse(true));

  return <VideoView player={player} style={s.video} nativeControls fullscreenOptions={{ enable: true }} allowsPictureInPicture contentFit="contain" />;
}

/**
 * Bunny's player in a WebView. The wrapper page iframes the embed and speaks the player.js
 * postMessage protocol with it, forwarding play/pause/time events to the app.
 */
export function EmbedVideoPlayer({ url, ...tracked }: Tracked & { url: string }) {
  const state = useRef({ position: tracked.resumeAt, rate: 1, playing: false });
  const pulse = useBeats(tracked, () => state.current);
  const origin = new URL(url).origin;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body>
<iframe id="p" src="${url.replace(/"/g, "&quot;")}" allow="encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe>
<script>
var f=document.getElementById('p'),o=${JSON.stringify(origin)},resume=${Number(tracked.resumeAt) || 0},done=false;
function post(m,v){f.contentWindow.postMessage(JSON.stringify({context:'player.js',version:'0.0.11',method:m,value:v}),o);}
window.addEventListener('message',function(e){if(e.origin!==o)return;var d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch(_){return}
if(!d||d.context!=='player.js')return;
if(d.event==='ready'){['play','pause','ended','timeupdate'].forEach(function(n){post('addEventListener',n)});if(!done&&resume>0)post('setCurrentTime',resume);done=true;}
window.ReactNativeWebView.postMessage(JSON.stringify({event:d.event,seconds:d.value&&d.value.seconds}));});
</script></body></html>`;

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { event?: string; seconds?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.event === "timeupdate" && typeof msg.seconds === "number") state.current.position = msg.seconds;
    else if (msg.event === "play") state.current.playing = true;
    else if (msg.event === "pause" || msg.event === "ended") {
      state.current.playing = false;
      void pulse(msg.event === "ended");
    }
  };

  if (Platform.OS === "web") return <WebFrame url={url} />;
  return (
    <View style={s.video}>
      <WebView source={{ html, baseUrl: "https://app.mahatecz.local/" }} onMessage={onMessage} allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} originWhitelist={["https://*"]} style={s.web} />
    </View>
  );
}

/** YouTube / Vimeo / Drive: no trustworthy events, completion is manual (spec §15.2). */
export function ExternalPlayer({ url }: { url: string }) {
  if (Platform.OS === "web") return <WebFrame url={url} />;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${url.replace(/"/g, "&quot;")}" allow="encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe></body></html>`;
  return (
    <View style={s.video}>
      <WebView source={{ html, baseUrl: "https://app.mahatecz.local/" }} allowsFullscreenVideo allowsInlineMediaPlayback originWhitelist={["https://*"]} style={s.web} />
    </View>
  );
}

/** Article HTML is sanitised by the API; shown with the app's colours. */
export function ArticleView({ html }: { html: string }) {
  const page = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:${colors.surface};color:${colors.foreground};font:16px/1.6 -apple-system,Roboto,sans-serif}a{color:${colors.primary}}h2,h3{line-height:1.3}pre,code{font-family:monospace}</style></head><body>${html}</body></html>`;
  if (Platform.OS === "web") return createElement("div", { style: { padding: 16, background: colors.surface, color: colors.foreground, borderRadius: radius.md, lineHeight: 1.6 }, dangerouslySetInnerHTML: { __html: html } });
  return (
    <View style={s.article}>
      <WebView source={{ html: page }} originWhitelist={["about:*", "https://*"]} style={s.web} />
    </View>
  );
}

/** react-native-webview has no web build; the web export (smoke tests) uses a plain iframe. */
function WebFrame({ url }: { url: string }) {
  return (
    <View style={s.video}>
      {createElement("iframe", { src: url, style: { border: 0, width: "100%", height: "100%" }, allow: "encrypted-media; picture-in-picture; fullscreen", sandbox: "allow-scripts allow-same-origin allow-presentation" })}
    </View>
  );
}

const s = StyleSheet.create({
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: radius.md, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "#000" },
  article: { height: 480, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
});
