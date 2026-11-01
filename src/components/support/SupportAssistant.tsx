"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, Mail, MessageCircle, Plus, RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import { LEGAL_CONFIG } from "@/lib/legal/legal-config";
import { getProQuoteHref } from "@/lib/subscriptions/quote-contact";
import "./support-assistant.css";

type Source = { id: string; title: string; href: string };
type Message = { id: string; role: "user" | "assistant"; content: string; sources?: Source[]; suggestions?: string[]; mode?: "ai" | "knowledge" };
type ChatReply = { reply: string; sources: Source[]; suggestions: string[]; mode: "ai" | "knowledge" };
type ChatError = { message: string };

const MAX_MESSAGE_LENGTH = 2_000;
const CONTACT_EMAIL = LEGAL_CONFIG.legalEmail.trim() || "contact@felexia.pro";
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Felexia — une question pour votre équipe")}`;
const STARTERS = [
  { label: "Découvrir ESSENTIEL", question: "Que puis-je gérer avec ESSENTIEL ?", detail: "Ventes, achats, trésorerie" },
  { label: "Comprendre PRO", question: "Qu’apporte PRO par rapport à ESSENTIEL ?", detail: "L’ERP pour aller plus loin" },
  { label: "Faire mes premiers pas", question: "Comment commencer à utiliser Felexia ?", detail: "Un essai, simplement" },
  { label: "La facture électronique", question: "La facturation électronique est-elle incluse ?", detail: "Ce que Felexia permet" },
];

function createMessageId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Keep complete recent turns and the current question within the public API limits. */
function requestMessages(messages: Message[]) {
  const current = messages.at(-1);
  if (!current || current.role !== "user" || !current.content.trim() || current.content.length > MAX_MESSAGE_LENGTH) return [];
  const recent = [{ role: current.role, content: current.content } as { role: Message["role"]; content: string }];
  let length = current.content.length;
  for (let index = messages.length - 2; index >= 1 && recent.length < 11; index -= 2) {
    const answer = messages[index];
    const question = messages[index - 1];
    if (answer.role !== "assistant" || question.role !== "user" || !answer.content.trim() || !question.content.trim() || answer.content.length > 6_000 || question.content.length > MAX_MESSAGE_LENGTH) break;
    const turnLength = question.content.length + answer.content.length;
    if (length + turnLength > 16_000) break;
    recent.unshift({ role: question.role, content: question.content }, { role: answer.role, content: answer.content });
    length += turnLength;
  }
  return recent;
}

function safeSourceHref(href: unknown): string | null {
  if (typeof href !== "string" || /[\u0000-\u001f\\]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  if (href === CONTACT_HREF || href === getProQuoteHref()) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && ["felexia.pro", "www.felexia.pro"].includes(url.hostname)) return url.pathname + url.search + url.hash;
  } catch { /* An invalid source is simply omitted. */ }
  return null;
}

function parseReply(value: unknown): ChatReply | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.reply !== "string" || !candidate.reply.trim() || candidate.reply.length > 6_000 || !["ai", "knowledge"].includes(String(candidate.mode))) return null;
  const sources: Source[] = [];
  if (Array.isArray(candidate.sources)) {
    for (const source of candidate.sources.slice(0, 6)) {
      if (!source || typeof source !== "object") continue;
      const href = safeSourceHref(source.href);
      if (href && typeof source.title === "string" && source.title.trim() && !sources.some((item) => item.href === href)) sources.push({ id: typeof source.id === "string" ? source.id : href, title: source.title.slice(0, 120), href });
      if (sources.length === 4) break;
    }
  }
  return {
    reply: candidate.reply.trim(),
    sources,
    suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions.filter((item): item is string => typeof item === "string" && Boolean(item.trim()) && item.length <= MAX_MESSAGE_LENGTH).slice(0, 3) : [],
    mode: candidate.mode as ChatReply["mode"],
  };
}

function InlineText({ children }: { children: string }) {
  return children.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("`") && part.endsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part);
}

function ReplyText({ text }: { text: string }) {
  return text.split(/\n\s*\n/).map((block, index) => {
    const lines = block.trim().split("\n");
    const isList = lines.every((line) => /^(?:[-*•]\s+|\d+[.)]\s+)/.test(line.trim()));
    if (isList) {
      const List = /^\d+[.)]\s+/.test(lines[0].trim()) ? "ol" : "ul";
      return <List key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}><InlineText>{line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "")}</InlineText></li>)}</List>;
    }
    return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 ? <br /> : null}<InlineText>{line.replace(/^#{1,4}\s+/, "")}</InlineText></span>)}</p>;
  });
}

export function SupportAssistant() {
  const titleId = useId();
  const inputId = useId();
  const panelId = useId();
  const privacyId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ id: string; controller: AbortController; reason?: "timeout" | "stopped" } | null>(null);
  const lastMessage = messages.at(-1);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      inputRef.current?.focus({ preventScroll: true });
    } else if (dialog.open) {
      dialog.close();
      launcherRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (open && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [open, messages, pending, error]);

  useEffect(() => () => {
    const request = requestRef.current;
    requestRef.current = null;
    request?.controller.abort();
  }, []);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  async function requestReply(conversation: Message[]) {
    if (requestRef.current || retrySeconds > 0) return;
    const outgoingMessages = requestMessages(conversation);
    if (outgoingMessages.length === 0) return;
    const id = createMessageId();
    const currentRequest = { id, controller: new AbortController(), reason: undefined as "timeout" | "stopped" | undefined };
    requestRef.current = currentRequest;
    setPending(true);
    setError(null);
    const timeout = window.setTimeout(() => { currentRequest.reason = "timeout"; currentRequest.controller.abort(); }, 45_000);
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, cache: "no-store",
        body: JSON.stringify({ messages: outgoingMessages, requestId: id }), signal: currentRequest.controller.signal,
      });
      if (requestRef.current?.id !== id) return;
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Math.min(300, Math.max(1, Number(response.headers.get("retry-after")) || 30));
          setRetrySeconds(retryAfter);
          setError({ message: "Vous avez posé plusieurs questions à la suite. Un petit instant, puis nous reprenons." });
        } else if (response.status === 400 || response.status === 413) {
          setError({ message: "Votre demande n’a pas pu être traitée. Essayez de la reformuler en quelques phrases." });
        } else {
          setError({ message: "L’assistant est momentanément indisponible. Vous pouvez réessayer ou écrire à notre équipe." });
        }
        return;
      }
      const reply = parseReply(await response.json());
      if (requestRef.current?.id !== id) return;
      if (!reply) throw new Error("Invalid support response");
      setMessages([...conversation, { id: createMessageId(), role: "assistant", content: reply.reply, sources: reply.sources, suggestions: reply.suggestions, mode: reply.mode }]);
    } catch {
      if (requestRef.current?.id !== id) return;
      setError({ message: currentRequest.reason === "stopped" ? "La réponse a été interrompue. Vous pouvez réessayer quand vous le souhaitez." : currentRequest.reason === "timeout" ? "La réponse prend plus de temps que prévu. Vous pouvez réessayer ou contacter notre équipe." : "La connexion a été interrompue. Votre question est conservée : vous pouvez réessayer." });
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current?.id === id) { requestRef.current = null; setPending(false); }
    }
  }

  function sendMessage(text: string) {
    const content = text.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH || pending || requestRef.current || retrySeconds > 0) return;
    const previous = error && lastMessage?.role === "user" ? messages.slice(0, -1) : messages;
    const conversation: Message[] = [...previous, { id: createMessageId(), role: "user", content }];
    setMessages(conversation);
    setDraft("");
    void requestReply(conversation);
  }

  function startNewConversation() {
    const previousRequest = requestRef.current;
    requestRef.current = null;
    previousRequest?.controller.abort();
    setMessages([]); setDraft(""); setError(null); setPending(false);
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className="felexia-support">
      <button ref={launcherRef} type="button" className="felexia-support__launcher" data-open={open} aria-label="Poser une question à l’assistant Felexia" aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} tabIndex={open ? -1 : 0} onClick={() => setOpen(true)}>
        <span className="felexia-support__launcher-icon"><MessageCircle size={21} strokeWidth={1.8} aria-hidden="true" /></span><span>Une question ?</span><span className="felexia-support__launcher-dot" aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} id={panelId} className="felexia-support__panel" aria-labelledby={titleId} aria-modal="true" onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setOpen(false); }}>
        <header className="felexia-support__header">
          <span className="felexia-support__avatar" aria-hidden="true"><Sparkles size={21} strokeWidth={1.6} /></span>
          <div className="felexia-support__identity"><h2 id={titleId}>Assistant Felexia</h2><p>Un peu de clarté pour avancer.</p></div>
          <button type="button" className="felexia-support__icon-button" onClick={startNewConversation} aria-label="Commencer une nouvelle conversation" title="Nouvelle conversation"><Plus size={20} aria-hidden="true" /></button>
          <button type="button" className="felexia-support__icon-button" onClick={() => setOpen(false)} aria-label="Fermer l’assistant"><X size={20} aria-hidden="true" /></button>
        </header>

        <div ref={historyRef} className="felexia-support__history" tabIndex={0} aria-label="Conversation avec l’assistant">
          {messages.length === 0 ? <div className="felexia-support__welcome">
            <div className="felexia-support__welcome-mark" aria-hidden="true"><Sparkles size={30} strokeWidth={1.3} /><span /></div>
            <p className="felexia-support__eyebrow">BIENVENUE CHEZ FELEXIA</p>
            <h3>Bonjour,<br />comment vous aider ?</h3>
            <p className="felexia-support__welcome-copy">Les offres, les fonctionnalités ou vos premiers pas : trouvons ensemble la bonne réponse.</p>
            <div className="felexia-support__starters">{STARTERS.map((starter) => <button type="button" key={starter.label} disabled={retrySeconds > 0} onClick={() => sendMessage(starter.question)}><span><strong>{starter.label}</strong><small>{starter.detail}</small></span><ChevronRight size={16} aria-hidden="true" /></button>)}</div>
            <p className="felexia-support__languages">Français, English ou العربية — à vous de choisir.</p>
          </div> : <div className="felexia-support__messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages">
            {messages.map((message) => <article key={message.id} className={`felexia-support__message felexia-support__message--${message.role}`} aria-label={message.role === "user" ? "Votre message" : "Réponse de l’assistant Felexia"}>
              {message.role === "assistant" ? <div className="felexia-support__message-author"><Sparkles size={13} aria-hidden="true" />Felexia{message.mode === "knowledge" ? <span>Réponse de la base d’aide</span> : <span>Assistant IA</span>}</div> : null}
              <div className="felexia-support__message-text" dir="auto"><ReplyText text={message.content} /></div>
              {message.sources?.length ? <nav className="felexia-support__sources" aria-label="Liens utiles pour cette réponse">{message.sources.map((source) => <a key={source.href} href={source.href} onClick={() => setOpen(false)}>{source.title}<ArrowUpRight size={12} aria-hidden="true" /></a>)}</nav> : null}
            </article>)}
          </div>}
          {pending ? <div className="felexia-support__thinking" role="status"><span aria-hidden="true"><i /><i /><i /></span>Je prépare votre réponse…</div> : null}
          {error ? <div className="felexia-support__error" role="alert"><p>{error.message}</p>{lastMessage?.role === "user" ? <button type="button" onClick={() => void requestReply(messages)} disabled={retrySeconds > 0}><RotateCcw size={13} aria-hidden="true" />{retrySeconds > 0 ? `Réessayer dans ${retrySeconds} s` : "Réessayer"}</button> : null}</div> : null}
          {!error && retrySeconds > 0 ? <p className="felexia-support__cooldown" role="status">Vous pourrez poser une nouvelle question dans {retrySeconds} s.</p> : null}
          {!pending && !error && lastMessage?.role === "assistant" && lastMessage.suggestions?.length ? <div className="felexia-support__follow-ups" aria-label="Poursuivre la conversation">{lastMessage.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)}>{suggestion}<ChevronRight size={13} aria-hidden="true" /></button>)}</div> : null}
        </div>

        <div className="felexia-support__bottom">
          <div className="felexia-support__human"><a href={CONTACT_HREF}><Mail size={13} aria-hidden="true" />Parler à notre équipe<ArrowUpRight size={12} aria-hidden="true" /></a><a href={getProQuoteHref()}>Un projet PRO ?<ArrowUpRight size={12} aria-hidden="true" /></a></div>
          <form className="felexia-support__composer" onSubmit={(event) => { event.preventDefault(); sendMessage(draft); }} aria-busy={pending}>
            <label className="felexia-support__sr-only" htmlFor={inputId}>Votre question à l’assistant Felexia</label>
            <textarea ref={inputRef} id={inputId} aria-describedby={privacyId} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(draft); } }} placeholder="Posez votre question…" maxLength={MAX_MESSAGE_LENGTH} rows={2} dir="auto" enterKeyHint="send" />
            {pending ? <button type="button" className="felexia-support__send" aria-label="Interrompre la réponse" title="Interrompre" onClick={() => { if (requestRef.current) { requestRef.current.reason = "stopped"; requestRef.current.controller.abort(); } }}><Square size={15} fill="currentColor" aria-hidden="true" /></button> : <button type="submit" className="felexia-support__send" disabled={!draft.trim() || retrySeconds > 0} aria-label="Envoyer votre question"><Send size={18} strokeWidth={1.8} aria-hidden="true" /></button>}
          </form>
          <div className="felexia-support__footnote"><p id={privacyId}>Vos messages peuvent être traités par notre service IA. Évitez les données sensibles. <a href="/confidentialite#assistant" onClick={() => setOpen(false)}>Confidentialité<ArrowUpRight size={10} aria-hidden="true" /></a></p>{draft.length >= 1_700 ? <span>{draft.length}/{MAX_MESSAGE_LENGTH}</span> : null}</div>
        </div>
      </dialog>
    </div>
  );
}
