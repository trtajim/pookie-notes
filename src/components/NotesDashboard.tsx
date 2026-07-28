import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
  LogOut,
  Trash2,
  Edit3,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

type Note = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  content: string;
  color: string;
  created_at: string;
  updated_at?: string;
  creator?: { display_name: string };
  editor?: { display_name: string };
};

type Couple = {
  id: string;
  user1_id: string;
  user2_id: string | null;
  pending_user2_id?: string | null;
  pairing_code: string;
  pending?: { display_name: string };
};

const COLORS = [
  { hex: "#ffe5ec", name: "Blush Pink" },
  { hex: "#e2f0cb", name: "Matcha Cream" },
  { hex: "#d4f0f0", name: "Baby Blue" },
  { hex: "#fce1e4", name: "Peach Sorbet" },
  { hex: "#f3c4fb", name: "Lavender Cloud" },
  { hex: "#fff3b0", name: "Buttercup Yellow" },
];

const NOTE_SELECT =
  "*, creator:profiles!created_by(display_name), editor:profiles!last_edited_by(display_name)";

export default function NotesDashboard({ user }: { user: User }) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const [couple, setCouple] = useState<Couple | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);

  const [partnerCodeInput, setPartnerCodeInput] = useState("");
  const [pairingMsg, setPairingMsg] = useState("");
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  useEffect(() => {
    checkProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Realtime: couples table (pairing / approval / rejection) ---
  // We listen broadly (no couple_id filter, since we may not have one yet
  // while waiting/pending). RLS still restricts which rows we can see.
  useEffect(() => {
    const channel = supabase
      .channel(`user-couples-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "couples" },
        () => {
          // Couples changes are infrequent (pairing/approval), so a light
          // background refetch is fine here — just don't show the spinner.
          fetchCoupleAndNotes(false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // --- Realtime: notes table (targeted patches, no refetch/flicker) ---
  useEffect(() => {
    if (!couple) return;

    const channel = supabase
      .channel(`notes-${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notes",
          filter: `couple_id=eq.${couple.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from("notes")
            .select(NOTE_SELECT)
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setNotes((prev) =>
              prev.some((n) => n.id === data.id) ? prev : [data, ...prev],
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `couple_id=eq.${couple.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from("notes")
            .select(NOTE_SELECT)
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setNotes((prev) =>
              prev.map((n) => (n.id === data.id ? data : n)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notes",
          filter: `couple_id=eq.${couple.id}`,
        },
        (payload) => {
          setNotes((prev) => prev.filter((n) => n.id !== payload.old.id));
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Realtime notes channel issue:", status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [couple?.id]);

  async function checkProfile() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        setHasProfile(false);
      } else {
        setHasProfile(true);
        fetchCoupleAndNotes(true);
      }
    } catch (err) {
      setHasProfile(false);
    }
  }

  const handleSetupProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicknameInput.trim()) return;
    setSetupLoading(true);

    try {
      await supabase
        .from("profiles")
        .insert([{ id: user.id, display_name: nicknameInput.trim() }]);

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      await supabase
        .from("couples")
        .insert([{ user1_id: user.id, pairing_code: code }]);

      setHasProfile(true);
      fetchCoupleAndNotes(true);
    } catch (err) {
      console.error("Failed to setup profile:", err);
      alert("Oops! Something went wrong setting up your profile.");
    } finally {
      setSetupLoading(false);
    }
  };

  // isInitial controls whether we show the full-page loading state.
  // Realtime-triggered refreshes pass false so the UI doesn't flash/reload.
  const fetchCoupleAndNotes = useCallback(async (isInitial: boolean) => {
    try {
      if (isInitial) setLoading(true);

      const { data: waitingRoom } = await supabase
        .from("couples")
        .select("*")
        .eq("pending_user2_id", user.id)
        .maybeSingle();

      if (waitingRoom) {
        setIsWaitingForApproval(true);
        if (isInitial) setLoading(false);
        return;
      }

      setIsWaitingForApproval(false);

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("*, pending:profiles!pending_user2_id(display_name)")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .single();

      if (coupleError) throw coupleError;
      setCouple(coupleData);

      if (coupleData) {
        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select(NOTE_SELECT)
          .eq("couple_id", coupleData.id)
          .order("created_at", { ascending: false });

        if (notesError) throw notesError;
        if (notesData) setNotes(notesData);
      }
    } catch (error) {
      console.error("Error fetching data:", (error as Error).message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user.id]);

  const handleLinkPartner = async () => {
    if (!partnerCodeInput.trim() || !couple) return;
    try {
      const { data: targetCouple, error: findErr } = await supabase
        .from("couples")
        .select("*")
        .eq("pairing_code", partnerCodeInput.trim().toUpperCase())
        .single();

      if (findErr || !targetCouple) {
        setPairingMsg("Could not find that code! 🥺");
        return;
      }

      if (targetCouple.user2_id) {
        setPairingMsg("That room is already full! 🥺");
        return;
      }

      const { error: updateErr } = await supabase
        .from("couples")
        .update({ pending_user2_id: user.id })
        .eq("id", targetCouple.id);

      if (updateErr) throw updateErr;

      setPairingMsg("Request sent! 💖");
      fetchCoupleAndNotes(true); // deliberate transition -> ok to show loading
    } catch (err) {
      setPairingMsg("Something went wrong linking! 🥺");
    }
  };

  const handleApprove = async () => {
    if (!couple || !couple.pending_user2_id) return;
    try {
      await supabase
        .from("couples")
        .update({
          user2_id: couple.pending_user2_id,
          pending_user2_id: null,
        })
        .eq("id", couple.id);

      await supabase
        .from("couples")
        .delete()
        .eq("user1_id", couple.pending_user2_id)
        .is("user2_id", null);

      fetchCoupleAndNotes(true); // deliberate transition -> ok to show loading
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!couple) return;
    await supabase
      .from("couples")
      .update({ pending_user2_id: null })
      .eq("id", couple.id);
    fetchCoupleAndNotes(false);
  };

  const cancelRequest = async () => {
    const { data: waitingRoom } = await supabase
      .from("couples")
      .select("id")
      .eq("pending_user2_id", user.id)
      .maybeSingle();

    if (waitingRoom) {
      await supabase
        .from("couples")
        .update({ pending_user2_id: null })
        .eq("id", waitingRoom.id);
    }
    fetchCoupleAndNotes(true); // deliberate transition -> ok to show loading
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) {
      alert("Oopsie! Write down a title or content first! 🎀");
      return;
    }
    if (!couple) return;

    try {
      if (editingNote) {
        const { data, error } = await supabase
          .from("notes")
          .update({
            title,
            content,
            color: selectedColor,
            last_edited_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingNote.id)
          .select(NOTE_SELECT)
          .single();
        if (error) throw error;
        // Patch locally immediately — don't wait for the realtime echo,
        // so the editor's own UI updates instantly with no flicker.
        if (data) {
          setNotes((prev) => prev.map((n) => (n.id === data.id ? data : n)));
        }
      } else {
        const { data, error } = await supabase
          .from("notes")
          .insert([
            {
              couple_id: couple.id,
              created_by: user.id,
              last_edited_by: user.id,
              title,
              content,
              color: selectedColor,
            },
          ])
          .select(NOTE_SELECT)
          .single();
        if (error) throw error;
        if (data) {
          setNotes((prev) =>
            prev.some((n) => n.id === data.id) ? prev : [data, ...prev],
          );
        }
      }

      resetForm();
    } catch (error) {
      console.error("Error saving note:", (error as Error).message);
    }
  };

  const deleteNote = async (id: string) => {
    // Optimistic local removal; the realtime DELETE handler is a no-op
    // once the row is already gone from state.
    const prevNotes = notes;
    setNotes((cur) => cur.filter((n) => n.id !== id));
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting note:", (error as Error).message);
      setNotes(prevNotes); // roll back on failure
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title || "");
    setContent(note.content || "");
    setSelectedColor(note.color || COLORS[0].hex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setSelectedColor(COLORS[0].hex);
  };

  // --- RENDER INITIAL SETUP IF NO PROFILE ---
  if (hasProfile === false) {
    return (
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <div className="floating-decor decor-1">🎀</div>
        <div className="floating-decor decor-2">🍓</div>
        <div
          className="glass-panel"
          style={{
            padding: "3rem",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              marginBottom: "1rem",
              color: "var(--primary)",
              fontFamily: "'Fredoka', cursive",
              fontSize: "2rem",
            }}
          >
            Welcome, Pookie!{" "}
            <Sparkles
              size={24}
              style={{ display: "inline", verticalAlign: "middle" }}
            />
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: "2rem",
              fontWeight: "bold",
            }}
          >
            Before you enter the room, what should we call you?
          </p>
          <form onSubmit={handleSetupProfile} className="input-group">
            <input
              type="text"
              placeholder="Your cute nickname"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              required
            />
            <button
              className="btn-primary"
              type="submit"
              disabled={setupLoading}
              style={{ marginTop: "1rem", width: "100%" }}
            >
              {setupLoading ? "Saving..." : "Enter the Room 💕"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER NULL (Loading) ---
  if (hasProfile === null) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "4rem",
          color: "var(--primary)",
          fontWeight: "bold",
        }}
      >
        Loading your room... 🎀
      </div>
    );
  }

  // --- RENDER WAITING FOR APPROVAL ---
  if (isWaitingForApproval) {
    return (
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <div className="floating-decor decor-1">🎀</div>
        <div className="floating-decor decor-2">🍓</div>
        <div
          className="glass-panel"
          style={{
            padding: "3rem",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              marginBottom: "1rem",
              color: "var(--primary)",
              fontFamily: "'Fredoka', cursive",
              fontSize: "2rem",
            }}
          >
            Request Sent! 💌
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: "2rem",
              fontWeight: "bold",
            }}
          >
            Waiting for your partner to open the door... 🚪💕
          </p>
          <button
            className="btn-secondary"
            onClick={cancelRequest}
            style={{ width: "100%" }}
          >
            Cancel Request
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN DASHBOARD ---
  return (
    <div className="container">
      <div className="floating-decor decor-1">🎀</div>
      <div className="floating-decor decor-2">🍓</div>

      <header>
        <h1>
          <span>🌸</span> Pookie Notes <span>🎀</span>
        </h1>
        <div className="branding-badge">Couples Edition 💕</div>
        <p className="subtitle">
          Share secret thoughts, soft reminders & cute ideas!
        </p>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => supabase.auth.signOut()}
            style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
          >
            <LogOut
              size={16}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: "4px",
              }}
            />{" "}
            Log Out
          </button>
        </div>
      </header>

      {/* Pending Approval Request Section */}
      {couple && couple.pending_user2_id && !couple.user2_id && (
        <div
          className="glass-panel"
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
            border: "3px solid var(--primary)",
            backgroundColor: "#fff0f5",
          }}
        >
          <h3
            style={{
              color: "var(--primary)",
              marginBottom: "1rem",
              fontSize: "1.5rem",
            }}
          >
            💌 Knock Knock!
          </h3>
          <p
            style={{
              marginBottom: "1.5rem",
              color: "var(--text-main)",
              fontWeight: "bold",
              fontSize: "1.1rem",
            }}
          >
            <span style={{ color: "#ff5c83" }}>
              {couple.pending?.display_name || "Someone"}
            </span>{" "}
            wants to join your room!
          </p>
          <div
            style={{ display: "flex", justifyContent: "center", gap: "1rem" }}
          >
            <button className="btn-secondary" onClick={handleReject}>
              Reject
            </button>
            <button className="btn-primary" onClick={handleApprove}>
              Let them in! 💕
            </button>
          </div>
        </div>
      )}

      {/* Pairing / Partner Section */}
      {couple && !couple.user2_id && !couple.pending_user2_id && (
        <div
          className="glass-panel"
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
            border: "3px dashed #ffb6c1",
          }}
        >
          <h3 style={{ color: "var(--primary)", marginBottom: "1rem" }}>
            Link with your Partner! 💌
          </h3>
          <p style={{ marginBottom: "1rem", color: "var(--text-muted)" }}>
            Your Pairing Code is:{" "}
            <strong
              style={{
                fontSize: "1.2rem",
                color: "#ff5c83",
                letterSpacing: "2px",
                background: "#fff0f5",
                padding: "4px 12px",
                borderRadius: "8px",
              }}
            >
              {couple.pairing_code}
            </strong>
          </p>
          <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
            Give this code to your partner, or enter their code below:
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Partner's Code"
              value={partnerCodeInput}
              onChange={(e) => setPartnerCodeInput(e.target.value)}
              style={{ width: "200px", margin: 0, padding: "0.6rem 1rem" }}
            />
            <button
              className="btn-primary"
              onClick={handleLinkPartner}
              style={{ padding: "0.6rem 1.5rem", fontSize: "1rem" }}
            >
              <LinkIcon size={16} /> Link
            </button>
          </div>
          {pairingMsg && (
            <p
              style={{
                color: "#ff5c83",
                marginTop: "1rem",
                fontWeight: "bold",
              }}
            >
              {pairingMsg}
            </p>
          )}
        </div>
      )}

      {/* Note Creator Box */}
      <form className="create-card" onSubmit={handleSave}>
        <div className="input-group">
          <input
            type="text"
            placeholder="Title (e.g., Grocery List 🧸)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Write something adorable for your partner here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="controls">
          <div>
            <div className="palette-label">Card Color</div>
            <div className="palette">
              {COLORS.map((c) => (
                <div
                  key={c.hex}
                  className={`color-option ${selectedColor === c.hex ? "selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={() => setSelectedColor(c.hex)}
                ></div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {editingNote && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn-add">
              <span>{editingNote ? "Update Note" : "Save Note"}</span> 💕
            </button>
          </div>
        </div>
      </form>

      {/* Display Area */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--primary)",
            fontWeight: "bold",
          }}
        >
          Loading your shared notes...
        </div>
      ) : (
        <div className="notes-grid">
          {notes.length === 0 ? (
            <div className="empty-state">
              <span>🧺</span>
              <p>Your shared room is empty, Pookie!</p>
            </div>
          ) : (
            notes.map((note) => {
              const formattedDate = new Date(
                note.created_at,
              ).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const authorName = note.creator?.display_name || "Someone";
              const editorName = note.editor?.display_name;
              const wasEdited =
                note.updated_at && note.updated_at !== note.created_at;

              return (
                <div
                  key={note.id}
                  className="note-card"
                  style={{ backgroundColor: note.color || COLORS[0].hex }}
                >
                  <div>
                    {note.title && <h3>{note.title}</h3>}
                    <p>{note.content}</p>
                  </div>
                  <div className="note-footer">
                    <div>
                      <div>✨ {formattedDate}</div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          marginTop: "4px",
                          opacity: 0.8,
                        }}
                      >
                        ✍️ Written by {authorName}
                      </div>
                      {wasEdited && editorName && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            marginTop: "2px",
                            opacity: 0.7,
                          }}
                        >
                          ✏️ Edited by {editorName}
                        </div>
                      )}
                    </div>
                    <div className="note-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleEdit(note)}
                        title="Edit Note"
                      >
                        <Edit3 size={14} color="#6b4355" />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-delete"
                        onClick={() => deleteNote(note.id)}
                        title="Delete Note"
                      >
                        <Trash2 size={14} color="#ff4757" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}