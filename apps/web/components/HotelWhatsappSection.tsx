"use client";

import { useEffect, useState } from "react";

type Answer = { id: string; question: string; answer: string; listingId: string | null; verifiedOnly: boolean };
type Room = { id: string; title: string; code: string; link: string | null };

const EMPTY = { question: "", answer: "", listingId: "", verifiedOnly: false };

export default function HotelWhatsappSection({ hotelId }: { hotelId: string }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/admin/hotel/${hotelId}/guest-answers`;

  useEffect(() => {
    fetch(base)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { answers: Answer[]; rooms: Room[] }) => {
        setAnswers(data.answers);
        setRooms(data.rooms);
      })
      .catch(() => setError("No se pudieron cargar las respuestas."));
  }, [base]);

  async function save() {
    setError(null);
    const body = JSON.stringify({ ...draft, listingId: draft.listingId || null });
    const res = await fetch(editingId ? `${base}/${editingId}` : base, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      setError("Revisa la pregunta y la respuesta.");
      return;
    }
    const { answer } = (await res.json()) as { answer: Answer };
    setAnswers((prev) => (editingId ? prev.map((a) => (a.id === answer.id ? answer : a)) : [...prev, answer]));
    setDraft(EMPTY);
    setEditingId(null);
  }

  async function remove(id: string) {
    const res = await fetch(`${base}/${id}`, { method: "DELETE" });
    if (res.ok) setAnswers((prev) => prev.filter((a) => a.id !== id));
  }

  const roomTitle = (id: string | null) => rooms.find((r) => r.id === id)?.title;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Respuestas del asistente de WhatsApp</h2>
          <p className="text-sm text-muted">
            El asistente responde a los huéspedes solo con esta información. Lo que no sepa te lo pregunta por WhatsApp.
          </p>
        </div>
        {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <ul className="divide-y">
          {answers.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{a.question}</p>
                <p className="whitespace-pre-line text-sm text-ink">{a.answer}</p>
                <p className="mt-1 text-xs text-muted">
                  {roomTitle(a.listingId) ?? "Todo el hotel"}
                  {a.verifiedOnly ? " · solo huéspedes verificados" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => {
                    setEditingId(a.id);
                    setDraft({ question: a.question, answer: a.answer, listingId: a.listingId ?? "", verifiedOnly: a.verifiedOnly });
                  }}
                >
                  Editar
                </button>
                <button type="button" className="text-red-700 hover:underline" onClick={() => remove(a.id)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
          {answers.length === 0 ? <li className="py-3 text-sm text-muted">Aún no hay respuestas.</li> : null}
        </ul>
        <div className="grid gap-3 border-t pt-4">
          <label className="grid gap-1 text-sm">
            Pregunta
            <input
              className="rounded border px-3 py-2"
              placeholder="¿Cuál es la contraseña del WiFi?"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Respuesta
            <textarea
              className="rounded border px-3 py-2"
              rows={3}
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Aplica a
              <select
                className="rounded border px-2 py-1"
                value={draft.listingId}
                onChange={(e) => setDraft({ ...draft, listingId: e.target.value })}
              >
                <option value="">Todo el hotel</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.verifiedOnly}
                onChange={(e) => setDraft({ ...draft, verifiedOnly: e.target.checked })}
              />
              Solo huéspedes verificados (WiFi, códigos de puerta)
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded bg-heading px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!draft.question.trim() || !draft.answer.trim()}
              onClick={save}
            >
              {editingId ? "Guardar cambios" : "Agregar respuesta"}
            </button>
            {editingId ? (
              <button type="button" className="text-sm text-muted" onClick={() => { setEditingId(null); setDraft(EMPTY); }}>
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-6 space-y-3">
        <h2 className="text-xl font-semibold">Códigos QR de habitación</h2>
        <p className="text-sm text-muted">
          Imprime un QR por habitación con este enlace. Al escanearlo, el huésped abre WhatsApp con el código de su habitación y el asistente lo reconoce.
        </p>
        <ul className="divide-y text-sm">
          {rooms.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{r.title}</span>
              <span className="font-mono">{r.code}</span>
              {r.link ? (
                <a className="text-brand hover:underline" href={r.link} target="_blank" rel="noreferrer">
                  Enlace de WhatsApp
                </a>
              ) : (
                <span className="text-muted">Enlace disponible al conectar el número</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
