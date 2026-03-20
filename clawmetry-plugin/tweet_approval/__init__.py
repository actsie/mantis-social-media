"""
ClawMetry Tweet Approval Plugin — Agent Card Social
Adds a /tweets approval UI to ClawMetry.

Flow:
  MantisCAW writes drafts → drafts.json
  This plugin serves the approval UI → reads drafts.json
  Stacy approves/edits/rejects → writes decisions.json
  feedback-patterns.md is auto-updated after every decision
  MantisCAW reads feedback-patterns.md on next session start
"""

import json
import os
import datetime
from pathlib import Path
from flask import Blueprint, jsonify, request, render_template_string

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

def _workspace() -> Path:
    profile = os.environ.get("OPENCLAW_PROFILE", "")
    if profile and profile != "default":
        base = Path.home() / f".openclaw/workspace-{profile}"
    else:
        custom = os.environ.get("OPENCLAW_WORKSPACE")
        base = Path(custom) if custom else Path.home() / ".openclaw/workspace"
    return base

def _drafts_path():   return _workspace() / "drafts.json"
def _decisions_path(): return _workspace() / "decisions.json"
def _feedback_path():  return _workspace() / "feedback-patterns.md"


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def _read(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default

def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

bp = Blueprint("tweet_approval", __name__)


@bp.route("/tweets")
def tweets_page():
    return render_template_string(APPROVAL_HTML)


@bp.route("/api/tweets/drafts")
def get_drafts():
    drafts = _read(_drafts_path(), [])
    pending = [d for d in drafts if d.get("status") == "pending"]
    return jsonify(pending)


@bp.route("/api/tweets/approve", methods=["POST"])
def approve():
    data = request.json or {}
    draft_id = data.get("id")
    edited_text = data.get("edited_text")

    drafts = _read(_drafts_path(), [])
    decisions = _read(_decisions_path(), [])
    original_text = None

    for d in drafts:
        if d.get("id") == draft_id:
            original_text = d.get("text")
            d["status"] = "approved"
            d["reviewed_at"] = _now()
            break

    was_edited = bool(edited_text and edited_text != original_text)
    decisions.append({
        "id": draft_id,
        "action": "approved",
        "original_text": original_text,
        "final_text": edited_text if was_edited else original_text,
        "was_edited": was_edited,
        "timestamp": _now(),
    })

    _write(_drafts_path(), drafts)
    _write(_decisions_path(), decisions)
    _rebuild_feedback(decisions)
    return jsonify({"success": True})


@bp.route("/api/tweets/reject", methods=["POST"])
def reject():
    data = request.json or {}
    draft_id = data.get("id")
    reason = data.get("reason", "")
    category = data.get("category", "other")

    drafts = _read(_drafts_path(), [])
    decisions = _read(_decisions_path(), [])
    original_text = None

    for d in drafts:
        if d.get("id") == draft_id:
            original_text = d.get("text")
            d["status"] = "rejected"
            d["reviewed_at"] = _now()
            break

    decisions.append({
        "id": draft_id,
        "action": "rejected",
        "original_text": original_text,
        "reason": reason,
        "category": category,
        "timestamp": _now(),
    })

    _write(_drafts_path(), drafts)
    _write(_decisions_path(), decisions)
    _rebuild_feedback(decisions)
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Feedback pattern regeneration
# ---------------------------------------------------------------------------

def _now():
    return datetime.datetime.now().isoformat()

def _rebuild_feedback(decisions):
    rejected = [d for d in decisions if d.get("action") == "rejected"]
    edited   = [d for d in decisions if d.get("action") == "approved" and d.get("was_edited")]

    cats = {}
    for d in rejected:
        c = d.get("category", "other")
        cats[c] = cats.get(c, 0) + 1

    lines = [
        "# Feedback Patterns",
        "",
        "> Auto-generated from approval decisions. Read this every session before drafting.",
        "",
        f"Updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
        f"Total decisions: {len(decisions)} | Rejections: {len(rejected)} | Edits on approval: {len(edited)}",
        "",
        "---",
        "",
        "## Rejection Patterns",
        "",
    ]

    if rejected:
        for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
            rule = " ← **treat as hard rule**" if count >= 3 else ""
            lines.append(f"- **{cat}** — {count}x{rule}")
        lines += ["", "### Recent rejection reasons", ""]
        for d in reversed(rejected[-5:]):
            lines.append(f'- "{d.get("reason", "")}" `[{d.get("category")}]`')
    else:
        lines.append("No rejections yet.")

    lines += ["", "---", "", "## Edit Patterns", ""]

    if edited:
        lines.append(f"{len(edited)} tweets edited before approval. Study the diffs:\n")
        for d in reversed(edited[-5:]):
            lines += [
                f"**Before:** {d.get('original_text', '')}  ",
                f"**After:**  {d.get('final_text', '')}",
                "",
            ]
    else:
        lines.append("No edits yet.")

    lines += [
        "",
        "---",
        "",
        "## Rules for MantisCAW",
        "",
        "1. Read rejection patterns above before every draft.",
        "2. Any category with 3+ rejections is a hard rule — do not violate it.",
        "3. Study edit diffs — they show exactly what needs to change.",
        "4. When in doubt, write shorter and more direct.",
        "5. After 10+ decisions, summarise the main pattern in one sentence at the top of this file.",
    ]

    with open(_feedback_path(), "w") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Entry point — runs as standalone Flask app on port 8901
# ClawMetry's extension system is event-based, not blueprint-based.
# The approval UI runs independently at http://localhost:8901/tweets
# ---------------------------------------------------------------------------

def register_handlers():
    """Called by ClawMetry extension system on startup — starts standalone server."""
    import threading
    from flask import Flask
    standalone = Flask(__name__)
    standalone.register_blueprint(bp)
    t = threading.Thread(
        target=lambda: standalone.run(host="127.0.0.1", port=8901, debug=False),
        daemon=True
    )
    t.start()
    print("[tweet_approval] Approval UI running at http://localhost:8901/tweets")


def run_standalone():
    """Run directly: python -m tweet_approval"""
    from flask import Flask
    standalone = Flask(__name__)
    standalone.register_blueprint(bp)
    print("[tweet_approval] Approval UI at http://localhost:8901/tweets")
    standalone.run(host="127.0.0.1", port=8901, debug=False)


# ---------------------------------------------------------------------------
# Approval UI HTML
# ---------------------------------------------------------------------------

APPROVAL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tweet Approvals — Agent Card</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0f0f0f; color: #e8e8e8; min-height: 100vh; padding: 24px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .header h1 { font-size: 18px; font-weight: 600; color: #fff; }
  .badge { background: #1a1a2e; border: 1px solid #2a2a4a; color: #7c8cf8;
           font-size: 11px; padding: 3px 8px; border-radius: 20px; }
  .empty { text-align: center; padding: 80px 20px; color: #555; font-size: 14px; }
  .cards { display: flex; flex-direction: column; gap: 16px; max-width: 680px; margin: 0 auto; }

  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px;
          padding: 20px; transition: border-color .2s; }
  .card:hover { border-color: #3a3a3a; }
  .card-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .tag { font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; }
  .tag-reply    { background: #1a2a1a; color: #4ade80; border: 1px solid #2a4a2a; }
  .tag-original { background: #1a1a2e; color: #7c8cf8; border: 1px solid #2a2a4a; }
  .tag-thread   { background: #2a1a1a; color: #f97316; border: 1px solid #4a2a1a; }
  .source-link  { font-size: 11px; color: #555; text-decoration: none; margin-left: auto; }
  .source-link:hover { color: #888; }

  .tweet-text { font-size: 15px; line-height: 1.6; color: #ddd; white-space: pre-wrap; }
  .tweet-edit { width: 100%; background: #111; border: 1px solid #333; border-radius: 8px;
                color: #ddd; font-size: 15px; line-height: 1.6; padding: 10px 12px;
                resize: vertical; min-height: 80px; font-family: inherit; }
  .tweet-edit:focus { outline: none; border-color: #7c8cf8; }
  .char-count { font-size: 11px; color: #555; text-align: right; margin-top: 4px; }
  .char-count.over { color: #ef4444; }

  .context { margin-top: 10px; font-size: 12px; color: #555; font-style: italic;
             padding: 8px 10px; background: #111; border-radius: 6px; border-left: 2px solid #2a2a2a; }

  .source-post { margin-top: 10px; padding: 10px 12px; background: #111;
                 border-radius: 8px; border: 1px solid #222; }
  .source-post-label { font-size: 11px; color: #555; margin-bottom: 4px; }
  .source-post-text  { font-size: 13px; color: #888; }

  .actions { display: flex; gap: 8px; margin-top: 16px; align-items: center; flex-wrap: wrap; }
  .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
         border: none; cursor: pointer; transition: opacity .15s, transform .1s; }
  .btn:hover { opacity: .85; }
  .btn:active { transform: scale(.97); }
  .btn-approve { background: #16a34a; color: #fff; }
  .btn-edit    { background: #1d4ed8; color: #fff; }
  .btn-save    { background: #7c3aed; color: #fff; }
  .btn-reject  { background: #1a1a1a; color: #ef4444; border: 1px solid #3a1a1a; }

  .reject-panel { margin-top: 12px; display: none; flex-direction: column; gap: 8px; }
  .reject-panel.open { display: flex; }
  select { background: #111; border: 1px solid #333; color: #ddd; border-radius: 8px;
           padding: 8px 10px; font-size: 13px; font-family: inherit; width: 100%; }
  select:focus { outline: none; border-color: #ef4444; }
  textarea.reject-reason { width: 100%; background: #111; border: 1px solid #333;
    border-radius: 8px; color: #ddd; font-size: 13px; padding: 8px 10px;
    resize: none; height: 60px; font-family: inherit; }
  textarea.reject-reason:focus { outline: none; border-color: #ef4444; }
  .btn-confirm-reject { background: #7f1d1d; color: #fca5a5; width: 100%;
                        border: 1px solid #991b1b; margin-top: 4px; }

  .done-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.6);
                  border-radius: 12px; display: flex; align-items: center;
                  justify-content: center; font-size: 18px; font-weight: 600; }
  .card { position: relative; }
</style>
</head>
<body>

<div class="header" style="max-width:680px;margin:0 auto 28px;">
  <h1>Tweet Approvals</h1>
  <span class="badge" id="count">loading...</span>
  <button class="btn" style="margin-left:auto;background:#111;border:1px solid #333;color:#888;font-size:12px;"
          onclick="loadDrafts()">Refresh</button>
</div>

<div id="cards" class="cards"></div>
<div id="empty" class="empty" style="display:none;">No pending drafts. MantisCAW is still cooking.</div>

<script>
async function loadDrafts() {
  const res = await fetch('/api/tweets/drafts');
  const drafts = await res.json();
  document.getElementById('count').textContent = drafts.length + ' pending';
  const container = document.getElementById('cards');
  const empty = document.getElementById('empty');
  if (!drafts.length) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  container.innerHTML = drafts.map(d => cardHTML(d)).join('');
}

function cardHTML(d) {
  const tagClass = d.type === 'reply' ? 'tag-reply' : d.type === 'thread' ? 'tag-thread' : 'tag-original';
  const sourceLink = d.source_post_url ? `<a class="source-link" href="${d.source_post_url}" target="_blank">View post ↗</a>` : '';
  const sourcePost = d.source_post_text ? `<div class="source-post"><div class="source-post-label">Replying to</div><div class="source-post-text">${esc(d.source_post_text)}</div></div>` : '';
  const context = d.context ? `<div class="context">${esc(d.context)}</div>` : '';
  const charCount = d.text ? d.text.length : 0;

  return `
  <div class="card" id="card-${d.id}">
    <div class="card-meta">
      <span class="tag ${tagClass}">${d.type || 'original'}</span>
      ${sourceLink}
    </div>
    ${sourcePost}
    <div class="tweet-text" id="text-${d.id}">${esc(d.text)}</div>
    <textarea class="tweet-edit" id="edit-${d.id}" style="display:none"
      oninput="updateCount('${d.id}')">${esc(d.text)}</textarea>
    <div class="char-count" id="count-${d.id}" style="display:none">${charCount}/280</div>
    ${context}
    <div class="actions">
      <button class="btn btn-approve" onclick="approve('${d.id}')">Approve</button>
      <button class="btn btn-edit" id="editbtn-${d.id}" onclick="startEdit('${d.id}')">Edit</button>
      <button class="btn btn-save" id="savebtn-${d.id}" style="display:none" onclick="approveEdited('${d.id}')">Approve edited</button>
      <button class="btn btn-reject" onclick="toggleReject('${d.id}')">Reject</button>
    </div>
    <div class="reject-panel" id="reject-${d.id}">
      <select id="cat-${d.id}">
        <option value="too_long">Too long</option>
        <option value="wrong_tone">Wrong tone</option>
        <option value="too_promotional">Too promotional</option>
        <option value="off_topic">Off topic</option>
        <option value="inaccurate">Inaccurate</option>
        <option value="timing">Bad timing</option>
        <option value="other" selected>Other</option>
      </select>
      <textarea class="reject-reason" id="reason-${d.id}" placeholder="Add more detail (optional)..."></textarea>
      <button class="btn btn-confirm-reject" onclick="confirmReject('${d.id}')">Confirm reject</button>
    </div>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateCount(id) {
  const ta = document.getElementById('edit-' + id);
  const el = document.getElementById('count-' + id);
  const n = ta.value.length;
  el.textContent = n + '/280';
  el.className = 'char-count' + (n > 280 ? ' over' : '');
}

function startEdit(id) {
  document.getElementById('text-' + id).style.display = 'none';
  document.getElementById('edit-' + id).style.display = 'block';
  document.getElementById('count-' + id).style.display = 'block';
  document.getElementById('editbtn-' + id).style.display = 'none';
  document.getElementById('savebtn-' + id).style.display = 'inline-block';
  updateCount(id);
}

function toggleReject(id) {
  const panel = document.getElementById('reject-' + id);
  panel.classList.toggle('open');
}

async function approve(id) {
  await fetch('/api/tweets/approve', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id })
  });
  markDone(id, '✓ Approved');
}

async function approveEdited(id) {
  const edited_text = document.getElementById('edit-' + id).value;
  await fetch('/api/tweets/approve', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, edited_text })
  });
  markDone(id, '✓ Approved with edits');
}

async function confirmReject(id) {
  const reason = document.getElementById('reason-' + id).value;
  const category = document.getElementById('cat-' + id).value;
  await fetch('/api/tweets/reject', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ id, reason, category })
  });
  markDone(id, '✗ Rejected');
}

function markDone(id, label) {
  const card = document.getElementById('card-' + id);
  const overlay = document.createElement('div');
  overlay.className = 'done-overlay';
  overlay.textContent = label;
  overlay.style.color = label.startsWith('✓') ? '#4ade80' : '#ef4444';
  card.appendChild(overlay);
  setTimeout(() => { card.remove(); updatePendingCount(); }, 1200);
}

function updatePendingCount() {
  const remaining = document.querySelectorAll('.card').length;
  document.getElementById('count').textContent = remaining + ' pending';
  if (!remaining) {
    document.getElementById('empty').style.display = 'block';
  }
}

loadDrafts();
</script>
</body>
</html>"""
