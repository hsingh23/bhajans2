#!/usr/bin/env python3
"""Beat-cycle (taal family) classifier + tempo, from audio rhythm features and sheet meter.

  python taal_model.py cv      # grouped cross-validation report (held out by Box folder)
  python taal_model.py final   # also writes features/taal.json (+ features/taal_eval.json)

Classes: beats_class 8 (4/4, 2/4), 6 (3/4, 6/8), 7 (7/8, 7/4), 5 (5/8, 5/4).
The model predicts the finer sheet meter group {4, 3, 68, 7, 5} so that 3/4 vs 6/8 gives
the subdivision; probabilities are summed to beats_class.
"""
import json
import os
import pickle
import sys
from collections import Counter, defaultdict
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "4")
import numpy as np  # noqa: E402

import taal_features as tf  # noqa: E402

HERE = Path(__file__).parent
CACHE = HERE / "features" / "taal_cache"
FEATS = CACHE / "_feats.pkl"
GROUPS = ["4", "3", "68", "7", "5"]
G2CLASS = {"4": 8, "3": 6, "68": 6, "7": 7, "5": 5}
CLASSES = [8, 6, 7, 5]
SIG2G = {"4/4": "4", "2/4": "4", "2/2": "4", "3/4": "3", "6/8": "68", "12/8": "68",
         "7/8": "7", "7/4": "7", "5/8": "5", "5/4": "5", "3/8": "3"}
SEED = 0
EVAL = {}
TRUSTED = {"trusted", "trusted-unique"}
HIGH_CONF = 0.8
UNVALIDATED = ("Amma Bhajans 2020", "Amma Bhajans 2021", "Amma Bhajans 2025")
TEMPER = 0.35
TRIP_T = 0.15  # set from the trip_op distribution (see report)
PRIOR_W = {"trusted": 0.92, "trusted-unique": 0.92, "unverified": 0.6}


def load_meta():
    bm = json.loads((HERE / "box-matches-verified.json").read_text())
    sheet = json.loads((HERE / "features" / "sheet_meter.json").read_text())
    rub = json.loads((HERE / "rubric.json").read_text())
    acc = {s: c[0] for s, c in bm.items() if c and c[0].get("accept")}
    # sheet links were fuzzy-matched; some point at another song's PDF (sheet_trust.py)
    tp = HERE / "features" / "sheet_trust.json"
    trust = json.loads(tp.read_text()) if tp.exists() else {}
    for name in list(sheet):
        t = trust.get(name, {}).get("trust", "unverified")
        if t == "mismatch":
            del sheet[name]  # not this song's sheet: treat as no sheet at all
        else:
            sheet[name] = dict(sheet[name], trust=t)
    return acc, sheet, rub


def sheet_label(m):
    """-> (group or None, {group: weight}) ; None group when meters of different classes mix."""
    sigs = m.get("time_signatures") or ([m["first"]] if m.get("first") else [])
    gs = [SIG2G.get(s) for s in sigs if SIG2G.get(s)]
    if not gs:
        return None, {}
    w = Counter(gs)
    # the first signature usually governs most of the song
    w[gs[0]] += 1
    tot = sum(w.values())
    w = {g: v / tot for g, v in w.items()}
    classes = {G2CLASS[g] for g in w}
    if len(w) == 1:
        return gs[0], w
    if len(classes) == 1:  # e.g. 3/4 + 6/8 or 4/4 + 2/4: same beat class
        return max(w, key=w.get), w
    return None, w


def _feat_one(bid):
    p = CACHE / f"{bid}.npz"
    try:
        x = tf.features(np.load(p))
    except Exception as e:  # noqa: BLE001
        print("feat fail", bid, e)
        x = None
    return bid, ((p.stat().st_mtime, tf.VERSION), x)


def build_feats(ids):
    from concurrent.futures import ProcessPoolExecutor

    cache = pickle.loads(FEATS.read_bytes()) if FEATS.exists() else {}
    need = [b for b in ids
            if not (b in cache and cache[b][0] == ((CACHE / f"{b}.npz").stat().st_mtime, tf.VERSION))]
    if need:
        with ProcessPoolExecutor(4) as pool:  # at most 4 CPU workers on this machine
            for bid, v in pool.map(_feat_one, need, chunksize=8):
                cache[bid] = v
        FEATS.write_bytes(pickle.dumps(cache))
    return {b: cache[b][1] for b in ids if cache.get(b) and cache[b][1] is not None}


def make_model(kind="hgb"):
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    if kind == "lr":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.05, max_iter=4000, class_weight="balanced"))
    return HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=8,
        l2_regularization=1.0, class_weight="balanced", random_state=SEED)


class Ensemble:
    """Average of gradient boosting and logistic regression probabilities."""

    def __init__(self):
        self.ms = [make_model("hgb"), make_model("lr")]

    def fit(self, X, y):
        for m in self.ms:
            m.fit(X, y)
        self.classes_ = self.ms[0].classes_
        return self

    def predict_proba(self, X):
        return np.mean([m.predict_proba(X) for m in self.ms], 0)


def to_class_probs(P, classes):
    """group probabilities (columns = classes) -> beats_class probabilities (CLASSES order)."""
    out = np.zeros((len(P), len(CLASSES)))
    for j, g in enumerate(classes):
        out[:, CLASSES.index(G2CLASS[g])] += P[:, j]
    return out


def full_proba(model, X):
    P = model.predict_proba(X)
    full = np.zeros((len(X), len(GROUPS)))
    for j, g in enumerate(model.classes_):
        full[:, GROUPS.index(g)] = P[:, j]
    return full


def dataset():
    acc, sheet, rub = load_meta()
    have = {b for b in (p.stem for p in CACHE.glob("*.npz")) if not b.endswith(".part")}
    songs = [s for s in acc if acc[s]["id"] in have]
    feats = build_feats(sorted({acc[s]["id"] for s in songs}))
    keys = None
    for x in feats.values():
        keys = sorted(x)
        break
    return acc, sheet, rub, songs, feats, keys


def oof_predictions(rows, feats, keys, n_splits=5):
    """rows: list of (song, bid, group, folder). Returns oof group probs (len(rows) x 5)."""
    from sklearn.model_selection import StratifiedGroupKFold

    X = np.array([[feats[b][k] for k in keys] for _, b, _, _ in rows])
    y = np.array([g for _, _, g, _ in rows])
    groups = np.array([fo for _, _, _, fo in rows])
    P = np.zeros((len(rows), len(GROUPS)))
    skf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=SEED)
    for tr, te in skf.split(X, y, groups):
        m = Ensemble().fit(X[tr], y[tr])
        P[te] = full_proba(m, X[te])
    return X, y, P


def confusion(true, pred, labels):
    M = np.zeros((len(labels), len(labels)), int)
    for t, p in zip(true, pred):
        M[labels.index(t), labels.index(p)] += 1
    return M


def fmt_conf(M, labels, name="true\\pred"):
    w = max(6, max(len(str(x)) for x in labels) + 1)
    s = f"{name:>10}" + "".join(f"{str(l):>{w}}" for l in labels) + f"{'n':>6}{'acc':>7}\n"
    for i, l in enumerate(labels):
        n = M[i].sum()
        s += f"{str(l):>10}" + "".join(f"{v:>{w}}" for v in M[i]) + f"{n:>6}{(M[i, i] / n if n else 0):>7.2f}\n"
    return s


def train_rows(acc, sheet, songs, feats):
    rows, seen = [], set()
    for s in songs:
        if s not in sheet or sheet[s]["trust"] not in TRUSTED:
            continue
        g, _ = sheet_label(sheet[s])
        b = acc[s]["id"]
        if g is None or b not in feats or b in seen:
            continue
        seen.add(b)  # one recording counts once
        rows.append((s, b, g, acc[s]["folder"]))
    return rows


def choose_threshold(conf, correct, target=0.90):
    """Lowest confidence threshold whose accepted set reaches `target` accuracy."""
    order = np.argsort(-conf)
    c = np.cumsum(correct[order]) / np.arange(1, len(order) + 1)
    best = 1.0
    for k in range(len(order)):
        if c[k] >= target and k >= 9:
            best = conf[order[k]]
    return float(best)


def unvalidated(folder):
    """Folder families (2020/2021/2025 Amma Bhajans sets, 'Amma and Little Children') with
    <=6 trusted training songs where audio agrees with unverified sheets only ~52% of the
    time (vs ~92% elsewhere)."""
    return any(k in folder for k in UNVALIDATED)


def tempo_info(f, group, sheet_sig=None):
    """Pulse a musician would clap, from the Beat This! beat rate.

    Measured on trusted sheet songs: Beat This! follows quarters in 4/4 and 3/4
    (median ~130 and ~125 BPM) but *eighths* in 6/8 (median ~143 BPM, beats grouped in
    threes), and eighths in 7/8 and 5/8 (~165 BPM).  So for 6/8 the clap pulse is the
    dotted quarter = tracked BPM / 3, unless the tracker already sits on the dotted
    quarter (slow, < 100 BPM).
    """
    bpm = f["bpm"]
    trip = f["trip_op"]
    if group == "68":
        if bpm >= 100:
            return dict(bpm=round(bpm / 3), pulse="dotted-quarter", subdivision=3, tracked="eighth")
        return dict(bpm=round(bpm), pulse="dotted-quarter", subdivision=3, tracked="dotted-quarter")
    if group in ("7", "5"):
        if sheet_sig in ("7/4", "5/4"):
            return dict(bpm=round(bpm), pulse="quarter", subdivision=2, tracked="quarter")
        return dict(bpm=round(bpm), pulse="eighth", subdivision=2, tracked="eighth")
    if group == "3" and bpm > 210:  # tracker on eighths
        return dict(bpm=round(bpm / 2), pulse="quarter", subdivision=2, tracked="eighth")
    if group == "4" and bpm > 180:  # 90% of trusted 4/4 songs track at <=158 BPM
        return dict(bpm=round(bpm / 2), pulse="quarter", subdivision=2, tracked="eighth")
    # 4/4 with a strong triplet feel inside the beat (12/8-like / swung keherwa)
    sub = 3 if trip > TRIP_T else 2
    return dict(bpm=round(bpm), pulse="quarter", subdivision=sub, tracked="quarter")


def cycle_beat_bpm(t, beats_class):
    """BPM of the counted beat of the cycle: quarter for 8 (2 bars of 4/4) and 6 in 3/4
    (2 bars), eighth for 6 in 6/8 and for 7 and 5 in x/8."""
    if t.get("bpm") is None:
        return None
    if t["pulse"] == "dotted-quarter":
        return t["bpm"] * 3
    return t["bpm"]


def report_cv():
    acc, sheet, rub, songs, feats, keys = dataset()
    rows = train_rows(acc, sheet, songs, feats)
    print(f"songs with audio features: {len(songs)}; training recordings: {len(rows)}")
    print("groups:", Counter(r[2] for r in rows))
    X, y, P = oof_predictions(rows, feats, keys)
    pg = [GROUPS[i] for i in P.argmax(1)]
    print("\n5-way meter group (OOF):  acc %.3f" % np.mean(np.array(pg) == y))
    print(fmt_conf(confusion(list(y), pg, GROUPS), GROUPS))
    C = to_class_probs(P, GROUPS)
    yc = np.array([G2CLASS[g] for g in y])
    pc = np.array([CLASSES[i] for i in C.argmax(1)])
    conf = C.max(1)
    print("beats_class (OOF): acc %.3f" % np.mean(pc == yc))
    print(fmt_conf(confusion(list(yc), list(pc), CLASSES), CLASSES))
    cov = {}
    for t in (0.5, 0.6, 0.7, 0.8, 0.9):
        m = conf >= t
        cov[t] = (float(m.mean()), float(np.mean(pc[m] == yc[m])), int(m.sum()))
        print(f"conf>={t}: coverage {m.mean():.2f} acc {np.mean(pc[m] == yc[m]):.3f} (n={m.sum()})")
    folders = np.array([r[3] for r in rows])
    big = Counter(folders).most_common(1)[0][0]
    for name, m in ((big, folders == big), ("all other folders", folders != big)):
        print(f"  {name}: n={m.sum()} acc {np.mean(pc[m] == yc[m]):.3f}")
    errs = []
    for i in np.where(pc != yc)[0]:
        s_, b_, g_, fo_ = rows[i]
        errs.append(dict(song=s_, box_id=b_, sheet_group=g_, pred_group=GROUPS[int(P[i].argmax())],
                         pred_class=int(pc[i]), conf=round(float(conf[i]), 3),
                         bpm=round(feats[b_]["bpm"], 1), folder=fo_))
    errs.sort(key=lambda e: -e["conf"])
    print("misclassified (beats_class):")
    for e in errs:
        print("  ", e)
    EVAL.update(
        n_train=len(rows), groups=dict(Counter(y)),
        acc_group=float(np.mean(np.array(pg) == y)), acc_class=float(np.mean(pc == yc)),
        conf_group=confusion(list(y), pg, GROUPS).tolist(),
        conf_class=confusion(list(yc), list(pc), CLASSES).tolist(),
        coverage={str(k): v for k, v in cov.items()}, errors=errs, n_songs_with_audio=len(songs))
    return rows, X, y, P


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "cv"
    rows, X, y, P = report_cv()
    if mode != "final":
        return
    write_final(rows, X, y, P)


def write_final(rows, X, y, P):
    acc, sheet, rub, songs, feats, keys = dataset()
    yc = np.array([G2CLASS[g] for g in y])
    C = to_class_probs(P, GROUPS)
    pc = np.array([CLASSES[i] for i in C.argmax(1)])
    conf = C.max(1)
    # the >=90% point on OOF is ~0.4 (nearly everything); training songs (trusted sheets)
    # are easier than the unlabeled pool, so use the stricter 0.8 (~99% OOF, ~95% coverage)
    thr = max(HIGH_CONF, choose_threshold(conf, (pc == yc).astype(float)))
    print("high-confidence threshold (audio-only, >=90% OOF):", round(thr, 3))
    model = Ensemble().fit(X, y)
    oof = {r[1]: P[i] for i, r in enumerate(rows)}
    out = {}
    for s in sorted(acc):
        b = acc[s]["id"]
        sm = sheet.get(s)
        sg, sw = sheet_label(sm) if sm else (None, {})
        f = feats.get(b)
        rec = {}
        if f is not None:
            pg = oof[b] if b in oof else full_proba(model, np.array([[f[k] for k in keys]]))[0]
            if unvalidated(acc[s]["folder"]):
                # almost no trusted training songs here and only ~52% agreement with the
                # (unverified) sheets: flatten the audio posterior before using it
                pg = pg ** TEMPER
                pg = pg / pg.sum()
            pcl = to_class_probs(pg[None], GROUPS)[0]
            ap = {str(CLASSES[i]): round(float(pcl[i]), 3) for i in range(4)}
            a_cls = CLASSES[int(pcl.argmax())]
            a_conf = float(pcl.max())
        else:
            pg = pcl = None
        if sm is None and f is None:
            continue
        if sw:
            # sheet prior: 0.92 on a trusted sheet meter (sheet agrees with human labels ~95%),
            # 0.6 on an unverified sheet link
            pw = PRIOR_W[sm["trust"]]
            prior = np.full(len(GROUPS), (1 - pw) / len(GROUPS))
            for g, w in sw.items():
                prior[GROUPS.index(g)] += pw * w
        else:
            prior = np.full(len(GROUPS), 1 / len(GROUPS))
        post = prior * (pg if pg is not None else 1.0)
        post = post / post.sum()
        postc = to_class_probs(post[None], GROUPS)[0]
        ci = int(postc.argmax())
        # best meter group inside the chosen beats_class (for pulse / subdivision)
        grp_best = max((g for g in GROUPS if G2CLASS[g] == CLASSES[ci]), key=lambda g: post[GROUPS.index(g)])
        if sw and pg is not None:
            src = "sheet+audio"
        elif sw:
            src = "sheet"
        else:
            src = "audio"
        rec["beats_class"] = CLASSES[ci]
        rec["confidence"] = round(float(postc[ci]), 3)
        if f is not None:
            # meter group for tempo: sheet group if the class matches, else best audio group
            tg = grp_best
            if sg and G2CLASS[sg] == CLASSES[ci]:
                tg = sg
            rec.update(tempo_info(f, tg, (sm or {}).get("first")))
            rec["cycle_beat_bpm"] = cycle_beat_bpm(rec, rec["beats_class"])
            rec["beat_tracker_bpm"] = round(f["bpm"], 1)
        else:
            rec.update(bpm=None, pulse={"68": "dotted-quarter", "7": "eighth", "5": "eighth"}.get(sg, "quarter"),
                       subdivision=3 if sg == "68" else 2)
        rec["source"] = src
        if sm:
            rec["sheet_trust"] = sm["trust"]
        rec["sheet_meter"] = (sm.get("time_signatures") if sm and sm.get("changes") else (sm or {}).get("first"))
        rec["audio_pred"] = (dict(beats_class=a_cls, confidence=round(a_conf, 3), probs=ap,
                                  meter_group=GROUPS[int(pg.argmax())]) if f is not None else None)
        rec["alternatives"] = [{"beats_class": CLASSES[i], "p": round(float(postc[i]), 3)}
                               for i in np.argsort(-postc)[1:] if postc[i] >= 0.05]
        flags = []
        if sw and f is not None:
            sheet_cls = G2CLASS[max(sw, key=sw.get)]
            if a_cls != sheet_cls:
                flags.append("audio_disagrees_with_sheet" + ("_strongly" if a_conf >= thr else ""))
        if sm and sm.get("changes") and sg is None:
            flags.append("sheet_meter_changes_class")
        if f is not None and unvalidated(acc[s]["folder"]):
            flags.append("audio_model_unvalidated_for_this_folder")
        if src == "audio":
            rec["high_confidence"] = bool(a_conf >= thr and not unvalidated(acc[s]["folder"]))
        else:
            rec["high_confidence"] = bool(rec["confidence"] >= 0.9)
        if b in oof:
            rec["audio_pred_is_held_out"] = True
        if flags:
            rec["flags"] = flags
        rec["box_id"] = b
        out[s] = rec
    # sheet songs whose recording is not accepted / not available: sheet only
    for s, sm in sheet.items():
        if s in out:
            continue
        sg, sw = sheet_label(sm)
        if not sw:
            continue
        g = sg or max(sw, key=sw.get)
        out[s] = dict(beats_class=G2CLASS[g], confidence=PRIOR_W[sm["trust"]] if sg else 0.5, bpm=None,
                      pulse={"68": "dotted-quarter", "7": "eighth", "5": "eighth"}.get(g, "quarter"),
                      subdivision=3 if g == "68" else 2, source="sheet",
                      sheet_meter=sm.get("time_signatures") if sm.get("changes") else sm.get("first"),
                      audio_pred=None, alternatives=[], high_confidence=bool(sg) and sm["trust"] in TRUSTED,
                      sheet_trust=sm["trust"], no_accepted_recording=True)
    (HERE / "features" / "taal.json").write_text(json.dumps(out, indent=1, ensure_ascii=False, sort_keys=True))
    print("wrote features/taal.json:", len(out), Counter(v["source"] for v in out.values()))
    human_check(out, rub, sheet)
    EVAL["threshold_audio_only"] = thr
    EVAL["output"] = dict(n=len(out), source=dict(Counter(v["source"] for v in out.values())),
                          beats_class=dict(Counter(str(v["beats_class"]) for v in out.values())),
                          flags=dict(Counter(f for v in out.values() for f in v.get("flags", []))),
                          high_conf_by_source={k: [sum(1 for v in out.values() if v["source"] == k and v["high_confidence"]),
                                                   sum(1 for v in out.values() if v["source"] == k)]
                                               for k in ("audio", "sheet", "sheet+audio")})
    (HERE / "features" / "taal_eval.json").write_text(json.dumps(EVAL, indent=1, ensure_ascii=False))


def human_check(out, rub, sheet):
    """Agreement with the 81 noisy human taal_beats labels (a hit = predicted class in the list)."""
    res = defaultdict(lambda: [0, 0])
    conf_rows = []
    for s, r in rub.items():
        hb = r.get("taal_beats")
        if not hb or s not in out:
            continue
        o = out[s]
        res["final"][0] += o["beats_class"] in hb
        res["final"][1] += 1
        if o.get("audio_pred"):
            a = o["audio_pred"]["beats_class"]
            res["audio_only"][0] += a in hb
            res["audio_only"][1] += 1
            if o["audio_pred"]["confidence"] >= 0.0 and o.get("source") == "audio":
                res["audio_only_no_sheet"][0] += a in hb
                res["audio_only_no_sheet"][1] += 1
            conf_rows.append((tuple(hb), a))
        if s in sheet:
            g, sw = sheet_label(sheet[s])
            if sw:
                res["sheet"][0] += G2CLASS[g or max(sw, key=sw.get)] in hb
                res["sheet"][1] += 1
    print("human-label agreement:", {k: f"{a}/{n} = {a / n:.2f}" for k, (a, n) in res.items() if n})
    print("human (list) -> audio pred:", Counter(conf_rows).most_common())
    EVAL["human"] = {k: [a, n] for k, (a, n) in res.items()}
    EVAL["human_vs_audio"] = [[list(k), a, n] for (k, a), n in Counter(conf_rows).most_common()]


if __name__ == "__main__":
    main()
