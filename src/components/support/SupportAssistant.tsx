"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import "./support-assistant.css";

type Message = { id: string; role: "user" | "assistant"; content: string };
type ChatReply = { reply: string };
type ChatError = { message: string };

const MAX_MESSAGE_LENGTH = 2_000;
const WHATSAPP_HREF = "https://wa.me/212614505090";

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

function parseReply(value: unknown): ChatReply | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.reply !== "string" || !candidate.reply.trim() || candidate.reply.length > 6_000 || !["ai", "knowledge"].includes(String(candidate.mode))) return null;
  return { reply: candidate.reply.trim() };
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><path d="M20.4 3.6A11.7 11.7 0 0 0 12.1.2C5.6.2.3 5.5.3 12c0 2.1.6 4.1 1.6 5.9L.2 24l6.3-1.6a11.8 11.8 0 0 0 5.6 1.4c6.5 0 11.8-5.3 11.8-11.8a11.7 11.7 0 0 0-3.5-8.4ZM12.1 21.8a9.7 9.7 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.3-.4a9.8 9.8 0 1 1 8.4 4.6Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.2-.1-.4-.1-.6.2s-.7.9-.9 1c-.1.2-.3.2-.6.1a8 8 0 0 1-2.3-1.4 8.6 8.6 0 0 1-1.6-2c-.2-.3 0-.4.1-.6l.4-.4.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.3.3-.7.3-1.2.2-1.3-.1-.2-.3-.2-.6-.4Z" /></svg>;
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
    inputRef.current?.focus({ preventScroll: true });
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
          setError({ message: "Un instant, puis réessayez." });
        } else if (response.status === 400 || response.status === 413) {
          setError({ message: "Reformulez votre question, puis réessayez." });
        } else {
          setError({ message: "L’assistant est indisponible. Réessayez." });
        }
        return;
      }
      const reply = parseReply(await response.json());
      if (requestRef.current?.id !== id) return;
      if (!reply) throw new Error("Invalid support response");
      setMessages([...conversation, { id: createMessageId(), role: "assistant", content: reply.reply }]);
    } catch {
      if (requestRef.current?.id !== id) return;
      setError({ message: currentRequest.reason === "stopped" ? "La réponse a été interrompue." : currentRequest.reason === "timeout" ? "La réponse tarde. Réessayez." : "Connexion interrompue. Réessayez." });
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
      <div className="felexia-support__dock" data-open={open}>
        <button ref={launcherRef} type="button" className="felexia-support__launcher felexia-support__launcher--ai" aria-label="Ouvrir IA Felexia" aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} tabIndex={open ? -1 : 0} onClick={() => setOpen(true)}>
          <span className="felexia-support__launcher-icon"><Sparkles size={23} strokeWidth={1.7} aria-hidden="true" /></span><span>IA Felexia</span>
        </button>
        <a className="felexia-support__launcher felexia-support__launcher--team" href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" aria-label="Felexia Team sur WhatsApp" tabIndex={open ? -1 : 0}>
          <span className="felexia-support__launcher-icon"><WhatsAppIcon /></span><span>Felexia Team</span>
        </a>
      </div>
      <dialog ref={dialogRef} id={panelId} className="felexia-support__panel" aria-labelledby={titleId} aria-modal="true" onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setOpen(false); }}>
        <header className="felexia-support__header">
          <span className="felexia-support__avatar" aria-hidden="true"><Sparkles size={18} strokeWidth={1.7} /></span>
          <h2 id={titleId}>IA Felexia</h2>
          {messages.length > 0 || error || pending ? <button type="button" className="felexia-support__icon-button" onClick={startNewConversation} aria-label="Commencer une nouvelle conversation" title="Nouvelle conversation"><RotateCcw size={17} aria-hidden="true" /></button> : null}
          <button type="button" className="felexia-support__icon-button" onClick={() => setOpen(false)} aria-label="Fermer l’assistant"><X size={19} aria-hidden="true" /></button>
        </header>
        <div ref={historyRef} className="felexia-support__history" tabIndex={messages.length > 0 ? 0 : -1} aria-label="Conversation avec l’assistant">
          <div className="felexia-support__messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages">
            {messages.map((message) => <article key={message.id} className={`felexia-support__message felexia-support__message--${message.role}`} aria-label={message.role === "user" ? "Votre message" : "Réponse de IA Felexia"}>
              <div className="felexia-support__message-text" dir="auto"><ReplyText text={message.content} /></div>
            </article>)}
          </div>
          {pending ? <div className="felexia-support__thinking" role="status" aria-label="Réponse en cours"><span aria-hidden="true"><i /><i /><i /></span></div> : null}
          {error ? <div className="felexia-support__error" role="alert"><p>{error.message}</p>{lastMessage?.role === "user" ? <button type="button" onClick={() => void requestReply(messages)} disabled={retrySeconds > 0}><RotateCcw size={13} aria-hidden="true" />{retrySeconds > 0 ? `Réessayer dans ${retrySeconds} s` : "Réessayer"}</button> : null}</div> : null}
          {!error && retrySeconds > 0 ? <p className="felexia-support__cooldown" role="status">Réessayez dans {retrySeconds} s.</p> : null}
        </div>
        <form className="felexia-support__composer" onSubmit={(event) => { event.preventDefault(); sendMessage(draft); }} aria-busy={pending}>
          <label className="felexia-support__sr-only" htmlFor={inputId}>Votre question à IA Felexia</label>
          <textarea ref={inputRef} id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(draft); } }} placeholder="Votre message…" maxLength={MAX_MESSAGE_LENGTH} rows={1} dir="auto" enterKeyHint="send" />
          {pending ? <button type="button" className="felexia-support__send" aria-label="Interrompre la réponse" title="Interrompre" onClick={() => { if (requestRef.current) { requestRef.current.reason = "stopped"; requestRef.current.controller.abort(); } }}><Square size={14} fill="currentColor" aria-hidden="true" /></button> : <button type="submit" className="felexia-support__send" disabled={!draft.trim() || retrySeconds > 0} aria-label="Envoyer votre question"><Send size={17} strokeWidth={1.8} aria-hidden="true" /></button>}
        </form>
      </dialog>
    </div>
  );
}
