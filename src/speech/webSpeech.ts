/**
 * Web Speech API(iOS Safari の無料音声認識)ラッパー。
 * フェーズ1で Whisper との比較ベースラインとして使う(design.md §6)。
 * TypeScript の DOM 型定義に SpeechRecognition が含まれないため、必要最小限の型を自前で持つ。
 */

interface MinimalRecognitionAlternative {
  transcript: string;
}

interface MinimalRecognitionResult {
  readonly length: number;
  [index: number]: MinimalRecognitionAlternative;
}

interface MinimalRecognitionEvent {
  results: {
    readonly length: number;
    [index: number]: MinimalRecognitionResult;
  };
}

interface MinimalRecognitionErrorEvent {
  error: string;
}

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: MinimalRecognitionEvent) => void) | null;
  onerror: ((event: MinimalRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isWebSpeechAvailable(): boolean {
  return getConstructor() !== null;
}

export interface WebSpeechResult {
  text: string;
  /** 認識開始から結果確定までの時間 */
  durationMs: number;
}

export interface WebSpeechHandle {
  /** 認識を打ち切る(それまでの結果があれば onResult が呼ばれる) */
  stop(): void;
}

/**
 * 1 回分の認識を開始する。結果確定・エラー・無音終了のいずれかで必ず終わる。
 */
export function startWebSpeech(
  onResult: (result: WebSpeechResult) => void,
  onError: (message: string) => void
): WebSpeechHandle | null {
  const Ctor = getConstructor();
  if (Ctor === null) return null;

  const recognition = new Ctor();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;

  const start = performance.now();
  let settled = false;

  recognition.onresult = (event) => {
    settled = true;
    let text = "";
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }
    onResult({ text: text.trim(), durationMs: performance.now() - start });
  };
  recognition.onerror = (event) => {
    settled = true;
    onError(`Web Speech エラー: ${event.error}`);
  };
  recognition.onend = () => {
    if (!settled) onError("Web Speech: 認識結果が得られませんでした(無音?)");
  };

  recognition.start();
  return { stop: () => recognition.stop() };
}
