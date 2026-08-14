import React, { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  createDefaultProject,
  hydrateGameDayProject,
  STORY_SIZE,
  FEED_SIZE,
  canManageGameDay,
} from "./defaults.js";
import { GameDayCanvas, LayerControls } from "./GameDayCanvas.jsx";
import {
  clearDraft,
  deleteProject,
  listPlayerAssets,
  listProjects,
  loadDraft,
  publicAssetUrl,
  removePlayerAsset,
  savePlayerAsset,
  saveProject,
  storeDraft,
  uploadGameDayAsset,
} from "./gameday-storage.js";
import "./gameday.css";
import "./gameday-controls.css";

const sections = [
  ["match", "Informações"],
  ["schedule", "Jogos do dia"],
  ["championship", "Campeonato"],
  ["players", "Jogadores"],
  ["uniform", "Uniforme"],
  ["group", "Grupo"],
  ["visual", "Identidade"],
  ["layers", "Camadas"],
  ["projects", "Projetos"],
  ["export", "Exportação"],
];

function Icon({ name }) {
  const path =
    name === "upload"
      ? "M12 16V4m0 0L7 9m5-5 5 5M5 15v5h14v-5"
      : name === "download"
        ? "M12 4v12m0 0 5-5m-5 5-5-5M5 20h14"
        : name === "save"
          ? "M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6"
          : name === "plus"
            ? "M12 5v14M5 12h14"
            : name === "trash"
              ? "M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"
              : "M4 12h16M12 4v16";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="gd-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Toggle({ label, checked, onChange }) {
  return (
    <label className="gd-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
      <span>{label}</span>
    </label>
  );
}

async function waitForAssets(node) {
  await document.fonts.ready;
  const images = [...node.querySelectorAll("img")];
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          }),
    ),
  );
}

async function removeSimpleBackground(file, onStatus) {
  onStatus("Preparando imagem");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  onStatus("Removendo fundo");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const corners = [
    [0, 0],
    [canvas.width - 1, 0],
    [0, canvas.height - 1],
    [canvas.width - 1, canvas.height - 1],
  ];
  const bg = corners
    .reduce(
      (sum, [x, y]) => {
        const i = (y * canvas.width + x) * 4;
        return [sum[0] + data[i], sum[1] + data[i + 1], sum[2] + data[i + 2]];
      },
      [0, 0, 0],
    )
    .map((v) => v / 4);
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.sqrt(
      (data[i] - bg[0]) ** 2 +
        (data[i + 1] - bg[1]) ** 2 +
        (data[i + 2] - bg[2]) ** 2,
    );
    if (distance < 42) data[i + 3] = 0;
    else if (distance < 78)
      data[i + 3] = Math.round(255 * ((distance - 42) / 36));
  }
  context.putImageData(image, 0, 0);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png", 1),
  );
  if (!blob) throw new Error("Não foi possível processar o recorte local.");
  onStatus("Concluído");
  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "")}-recortado.png`,
    { type: "image/png" },
  );
}

function UploadButton({
  label,
  accept = "image/png,image/jpeg,image/webp",
  onFile,
  disabled,
}) {
  const id = useMemo(() => `upload-${crypto.randomUUID()}`, []);
  return (
    <label className={`gd-upload ${disabled ? "disabled" : ""}`} htmlFor={id}>
      <Icon name="upload" />
      <span>{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function PlayerLibrary({ client, profile, players, refresh, onPick, close }) {
  const [draft, setDraft] = useState({
    display_name: "",
    nickname: "",
    position: "MC",
    original_path: null,
    cutout_path: null,
    uniform_path: null,
    poses: [],
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const upload = async (file, key) => {
    setBusy("Enviando imagem");
    setError("");
    try {
      const asset = await uploadGameDayAsset(client, profile, file, "players");
      setDraft((value) => ({ ...value, [key]: asset.path }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    if (!draft.display_name.trim())
      return setError("Informe o nome do jogador.");
    setBusy("Salvando jogador");
    try {
      await savePlayerAsset(client, profile, draft);
      setDraft({
        display_name: "",
        nickname: "",
        position: "MC",
        original_path: null,
        cutout_path: null,
        uniform_path: null,
        poses: [],
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="gd-modal-layer">
      <section
        className="gd-library-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca de jogadores"
      >
        <header>
          <div>
            <small>BIBLIOTECA INTERNA</small>
            <h2>Jogadores preparados</h2>
            <p>
              Original, recorte e versão uniformizada ficam disponíveis em todos
              os GameDays.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="gd-library-body">
          <aside>
            <h3>Novo jogador</h3>
            <Field label="Nome">
              <input
                value={draft.display_name}
                onChange={(e) =>
                  setDraft({ ...draft, display_name: e.target.value })
                }
              />
            </Field>
            <Field label="Apelido">
              <input
                value={draft.nickname}
                onChange={(e) =>
                  setDraft({ ...draft, nickname: e.target.value })
                }
              />
            </Field>
            <Field label="Posição">
              <select
                value={draft.position}
                onChange={(e) =>
                  setDraft({ ...draft, position: e.target.value })
                }
              >
                {["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  ),
                )}
              </select>
            </Field>
            <UploadButton
              label={
                draft.original_path
                  ? "Original enviada"
                  : "Enviar foto original"
              }
              onFile={(file) => upload(file, "original_path")}
              disabled={!!busy}
            />
            <UploadButton
              label={
                draft.cutout_path
                  ? "PNG recortado enviado"
                  : "Enviar PNG recortado"
              }
              onFile={(file) => upload(file, "cutout_path")}
              disabled={!!busy}
            />
            <UploadButton
              label={
                draft.uniform_path
                  ? "Versão uniformizada enviada"
                  : "Enviar versão uniformizada"
              }
              onFile={(file) => upload(file, "uniform_path")}
              disabled={!!busy}
            />
            {error && <p className="gd-error">{error}</p>}
            <button
              className="gd-primary"
              type="button"
              onClick={save}
              disabled={!!busy}
            >
              <Icon name="save" />
              {busy || "Salvar na biblioteca"}
            </button>
          </aside>
          <main>
            {players.length ? (
              players.map((player) => (
                <article className="gd-library-card" key={player.id}>
                  <div>
                    {player.uniform_path ||
                    player.cutout_path ||
                    player.original_path ? (
                      <img
                        src={publicAssetUrl(
                          client,
                          player.uniform_path ||
                            player.cutout_path ||
                            player.original_path,
                        )}
                        alt={player.display_name}
                      />
                    ) : (
                      <span>{player.display_name[0]}</span>
                    )}
                  </div>
                  <section>
                    <small>{player.position}</small>
                    <h3>{player.display_name}</h3>
                    <p>{player.nickname || "Sem apelido"}</p>
                    <div>
                      <button type="button" onClick={() => onPick(player)}>
                        Usar no GameDay
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={async () => {
                          await removePlayerAsset(client, player.id);
                          await refresh();
                        }}
                        aria-label={`Excluir ${player.display_name}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </section>
                </article>
              ))
            ) : (
              <p className="gd-empty-help">
                Cadastre o primeiro jogador preparado.
              </p>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

export function GameDayEditor({ profile, client, workspace }) {
  const allowed = canManageGameDay(profile);
  const initial = useMemo(() => loadDraft(createDefaultProject()), []);
  const [project, setProject] = useState(() => hydrateGameDayProject(initial));
  const [section, setSection] = useState("match");
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 720 ? 0.26 : 0.38,
  );
  const [format, setFormat] = useState("story");
  const [busy, setBusy] = useState("");
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("Rascunho local");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [library, setLibrary] = useState([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [slotId, setSlotId] = useState("player-main");
  const canvasRef = useRef(null);
  const autosave = useRef(null);
  const history = useRef({ past: [], future: [], lastKey: "", lastAt: 0 });
  const commit = (producer, key = "project") =>
    setProject((current) => {
      const next =
        typeof producer === "function"
          ? producer(current)
          : { ...current, ...producer };
      const now = Date.now();
      const state = history.current;
      if (state.lastKey !== key || now - state.lastAt > 450) {
        state.past.push(current);
        if (state.past.length > 60) state.past.shift();
      }
      state.future = [];
      state.lastKey = key;
      state.lastAt = now;
      return { ...next, updatedAt: new Date().toISOString() };
    });
  const update = (patch, key = "project") =>
    commit((current) => ({ ...current, ...patch }), key);
  const updateVisual = (patch) =>
    commit(
      (current) => ({
        ...current,
        visualSettings: { ...current.visualSettings, ...patch },
      }),
      "visual",
    );
  const resetHistory = () => {
    history.current = { past: [], future: [], lastKey: "", lastAt: 0 };
  };
  const undo = () =>
    setProject((current) => {
      const state = history.current;
      const previous = state.past.pop();
      if (!previous) return current;
      state.future.push(current);
      state.lastKey = "";
      return { ...previous, updatedAt: new Date().toISOString() };
    });
  const redo = () =>
    setProject((current) => {
      const state = history.current;
      const next = state.future.pop();
      if (!next) return current;
      state.past.push(current);
      state.lastKey = "";
      return { ...next, updatedAt: new Date().toISOString() };
    });
  const missingSchema = (error) => ["42P01", "PGRST205"].includes(error?.code);
  const refreshProjects = async () => {
    if (!client || !allowed) return;
    try {
      setProjects(await listProjects(client));
    } catch (e) {
      if (!missingSchema(e)) setError(e.message);
    }
  };
  const refreshLibrary = async () => {
    if (!client || !allowed) return;
    try {
      setLibrary(await listPlayerAssets(client));
    } catch (e) {
      if (!missingSchema(e)) setError(e.message);
    }
  };
  useEffect(() => {
    if (allowed) {
      refreshProjects();
      refreshLibrary();
    }
  }, [client, allowed]);
  useEffect(() => {
    storeDraft(project);
    setStatus(project.id ? "Alterações pendentes" : "Rascunho local");
    clearTimeout(autosave.current);
    if (project.id && client && allowed) {
      autosave.current = setTimeout(async () => {
        setStatus("Salvando");
        try {
          const saved = await saveProject(client, profile, project);
          setProject((value) => ({ ...value, id: saved.id }));
          setStatus("Salvo");
        } catch (e) {
          setStatus("Salvo localmente");
          setError(`Não foi possível sincronizar: ${e.message}`);
        }
      }, 1100);
    }
    return () => clearTimeout(autosave.current);
  }, [project.updatedAt]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (
        ["input", "textarea", "select"].includes(tag) ||
        event.target?.isContentEditable
      )
        return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  if (!allowed)
    return (
      <section className="gd-forbidden">
        <span>MÍDIA · GAMEDAY</span>
        <h1>Acesso de criação restrito.</h1>
        <p>
          O gerador é liberado para Diretoria e Desenvolvimento. As artes
          publicadas poderão ser vistas pelas áreas autorizadas.
        </p>
      </section>
    );

  const visibleSections = sections.filter(([id]) => project.players.length > 0 || !["players", "uniform"].includes(id));
  const allLayers = [...project.players, ...Object.values(project.elements)];
  const selected = allLayers.find((layer) => layer.id === selectedId);
  const layerLabels = {
    "header-team": "Nome do time",
    championship: "Logos de campeonatos",
    season: "Temporada",
    "time-card": "Bloco de horário",
    "main-logo": "Escudo Strix",
    group: "Grupo",
    "daily-games": "Jogos do dia",
    stamp: "Selo / carimbo",
    "player-left": "Jogador esquerdo",
    "player-main": "Jogador principal",
    "player-right": "Jogador direito",
  };
  const layerGroups = [
    {
      label: "IDENTIDADE",
      ids: ["header-team", "season", "main-logo", "stamp"],
    },
    {
      label: "COMPETIÇÃO",
      ids: ["championship", project.mode === "agenda" ? "daily-games" : "group"],
    },
    { label: "CONTEÚDO", ids: ["time-card"] },
    ...(project.players.length ? [{ label: "LEGADO · JOGADORES", ids: project.players.map((item) => item.id) }] : []),
  ];
  const updateLayer = (id, patch) =>
    commit((current) => {
      const player = current.players.find((item) => item.id === id);
      if (player)
        return {
          ...current,
          players: current.players.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        };
      const key = Object.entries(current.elements).find(
        ([, value]) => value.id === id,
      )?.[0];
      return key
        ? {
            ...current,
            elements: {
              ...current.elements,
              [key]: { ...current.elements[key], ...patch },
            },
          }
        : current;
    }, `layer:${id}`);
  const uploadProjectAsset = async (file, apply, folder = "projects") => {
    setBusy("Enviando imagem");
    setError("");
    try {
      const asset = await uploadGameDayAsset(client, profile, file, folder);
      apply(asset.url, asset.path);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const choosePlayer = async (slot, file, mode = "original") => {
    let processed = file;
    try {
      if (mode === "remove")
        processed = await removeSimpleBackground(file, setBusy);
      await uploadProjectAsset(
        processed,
        (url) =>
          update({
            players: project.players.map((player) =>
              player.id === slot
                ? {
                    ...player,
                    originalUrl: mode === "original" ? url : player.originalUrl,
                    cutoutUrl: mode === "remove" ? url : player.cutoutUrl,
                    activeUrl: url,
                  }
                : player,
            ),
          }),
        "players",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const pickFromLibrary = (player) => {
    const url = publicAssetUrl(
      client,
      player.uniform_path || player.cutout_path || player.original_path,
    );
    update({
      players: project.players.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              name: player.display_name,
              originalUrl: publicAssetUrl(client, player.original_path),
              cutoutUrl: publicAssetUrl(client, player.cutout_path),
              uniformUrl: publicAssetUrl(client, player.uniform_path),
              activeUrl: url,
            }
          : slot,
      ),
    });
    setLibraryOpen(false);
  };
  const setMode = (mode) =>
    commit((current) => {
      const layout = createDefaultProject().elements;
      const isAgenda = mode === "agenda";
      return {
        ...current,
        mode,
        elements: {
          ...current.elements,
          mainLogo: {
            ...current.elements.mainLogo,
            ...(isAgenda ? { x: 650, y: 1320, scale: 0.5 } : layout.mainLogo),
          },
          timeCard: {
            ...current.elements.timeCard,
            ...(isAgenda ? { x: 88, y: 455, scale: 1.08 } : layout.timeCard),
          },
          dailyGames: { ...current.elements.dailyGames, x: 88, y: 700, scale: 1, visible: isAgenda },
          group: { ...current.elements.group, visible: !isAgenda },
          stamp: { ...current.elements.stamp, visible: true },
        },
      };
    }, "mode");
  const applyAgenda = (id) => {
    const item = workspace?.agenda?.find((entry) => entry.id === id);
    if (!item) return;
    const date = new Date(item.scheduled_at);
    const parts = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date);
    const sameDay = (workspace?.agenda || [])
      .filter(
        (entry) =>
          !["cancelled", "completed"].includes(entry.status) &&
          new Intl.DateTimeFormat("sv-SE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "America/Sao_Paulo",
          }).format(new Date(entry.scheduled_at)) === parts,
      )
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      .slice(0, 6);
    const competitionFor = (entry) =>
      workspace.competitions?.find(
        (candidate) => candidate.id === entry.competition_id,
      );
    const agendaGames = sameDay.map((entry) => {
      const competition = competitionFor(entry);
      return {
        id: entry.id,
        time: new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Sao_Paulo",
        }).format(new Date(entry.scheduled_at)),
        opponent: (entry.opponent_name || "ADVERSÁRIO").toUpperCase(),
        competition: (
          competition?.name ||
          entry.competition_name ||
          "AMISTOSO"
        ).toUpperCase(),
        opponentLogo: entry.resolved_opponent_logo_url || (entry.opponent_logos?.storage_path
          ? workspace.assetUrl(entry.opponent_logos.storage_path)
          : ""),
      };
    });
    const logoMap = new Map();
    sameDay.forEach((entry) => {
      const competition = competitionFor(entry);
      const name = (
        competition?.name ||
        entry.competition_name ||
        "AMISTOSO"
      ).toUpperCase();
      const url = competition?.logo_url || "";
      const key = entry.competition_id || name;
      if (url && !logoMap.has(key) && logoMap.size < 5)
        logoMap.set(key, { id: String(key), name, url });
    });
    const competition = competitionFor(item);
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(date);
    const logo = item.resolved_opponent_logo_url || (item.opponent_logos?.storage_path
      ? workspace.assetUrl(item.opponent_logos.storage_path)
      : "");
    commit(
      (current) => ({
        ...current,
        mode: "agenda",
        name: `GameDay · ${item.opponent_name}`,
        matchDate: parts,
        matchTime: time,
        opponentName: item.opponent_name.toUpperCase(),
        opponentLogo: logo,
        championshipName: (
          competition?.name ||
          item.competition_name ||
          "AMISTOSO"
        ).toUpperCase(),
        championshipLogo: competition?.logo_url || current.championshipLogo,
        competitionLogos: [...logoMap.values()],
        dailyGames: agendaGames,
        visualSettings: {
          ...current.visualSettings,
          primaryColor:
            competition?.accent_color || current.visualSettings.primaryColor,
        },
        elements: {
          ...current.elements,
          mainLogo: {
            ...current.elements.mainLogo,
            x: 650,
            y: 1320,
            scale: 0.5,
          },
          timeCard: { ...current.elements.timeCard, x: 88, y: 455, scale: 1.08 },
          dailyGames: { ...current.elements.dailyGames, x: 88, y: 700, scale: 1, visible: true },
          group: { ...current.elements.group, visible: false },
          stamp: { ...current.elements.stamp, visible: true },
        },
      }),
      "agenda-fill",
    );
  };
  const saveNow = async () => {
    setBusy("Salvando projeto");
    setError("");
    try {
      const saved = await saveProject(client, profile, project);
      setProject(saved);
      setStatus("Salvo");
      await refreshProjects();
    } catch (e) {
      setError(
        missingSchema(e)
          ? "A migration do Gerador de GameDay ainda precisa ser aplicada no Supabase."
          : e.message,
      );
    } finally {
      setBusy("");
    }
  };
  const exportImage = async (targetFormat) => {
    if (!canvasRef.current || busy) return;
    setBusy("Preparando PNG");
    setExporting(true);
    setError("");
    const previous = format;
    setFormat(targetFormat);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    try {
      await waitForAssets(canvasRef.current);
      const size = targetFormat === "feed" ? FEED_SIZE : STORY_SIZE;
      const dataUrl = await toPng(canvasRef.current, {
        width: size.width,
        height: size.height,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: "#e9e8e2",
        style: { transform: "none", transformOrigin: "top left" },
      });
      const link = document.createElement("a");
      link.download = `strix-gameday-${project.matchDate}-${targetFormat}.png`;
      link.href = dataUrl;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError(`Falha ao exportar: ${e.message}`);
    } finally {
      setFormat(previous);
      setExporting(false);
      setBusy("");
    }
  };
  const reset = () => {
    const fresh = createDefaultProject();
    resetHistory();
    setProject(fresh);
    clearDraft();
    setSelectedId("");
    setStatus("Padrão restaurado");
  };

  return (
    <section className="gameday-editor-page page-enter">
      <header className="gd-page-title">
        <div>
          <span>MÍDIA · GAMEDAY</span>
          <h1>Gerador de GameDay</h1>
          <p>Colagem editorial 2026 em camadas reais, pronta para Story.</p>
        </div>
        <div className="gd-save-state">
          <i className={status === "Salvo" ? "saved" : ""} />
          <span>{status}</span>
          <div className="gd-history-actions">
            <button
              type="button"
              className="gd-secondary"
              onClick={undo}
              disabled={!history.current.past.length}
              title="Desfazer (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className="gd-secondary"
              onClick={redo}
              disabled={!history.current.future.length}
              title="Refazer (Ctrl+Shift+Z)"
            >
              ↷
            </button>
          </div>
          <button
            type="button"
            className="gd-secondary"
            onClick={saveNow}
            disabled={!!busy}
          >
            <Icon name="save" />
            Salvar projeto
          </button>
        </div>
      </header>
      <div className="gd-workbench">
        <aside className="gd-editor-panel">
          <nav>
            {visibleSections.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={section === id ? "active" : ""}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="gd-editor-scroll">
            {section === "match" && (
              <>
                <h2>Informações do jogo</h2>
                <div className="gd-mode-picker">
                  <button
                    type="button"
                    className={project.mode === "group" ? "active" : ""}
                    onClick={() => setMode("group")}
                  >
                    <b>Corujão / Grupo</b>
                    <small>Escudos e grupo da competição</small>
                  </button>
                  <button
                    type="button"
                    className={project.mode === "agenda" ? "active" : ""}
                    onClick={() => setMode("agenda")}
                  >
                    <b>Agenda do dia</b>
                    <small>Até 6 jogos em ordem cronológica</small>
                  </button>
                </div>
                {workspace?.agenda?.length > 0 && (
                  <Field
                    label="Preencher com a Agenda"
                    hint="No modo Agenda do dia, todos os jogos da data entram automaticamente."
                  >
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        applyAgenda(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Selecionar data pelo próximo jogo
                      </option>
                      {workspace.agenda
                        .filter(
                          (item) =>
                            !["cancelled", "completed"].includes(item.status),
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {new Date(item.scheduled_at).toLocaleDateString(
                              "pt-BR",
                            )}{" "}
                            · {item.opponent_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                <Field label="Nome do projeto">
                  <input
                    value={project.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </Field>
                <Field label="Adversário">
                  <input
                    value={project.opponentName || ""}
                    onChange={(e) =>
                      update({ opponentName: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <UploadButton
                  label={
                    project.opponentLogo
                      ? "Trocar logo do adversário"
                      : "Enviar logo do adversário"
                  }
                  onFile={(file) =>
                    uploadProjectAsset(
                      file,
                      (url) => update({ opponentLogo: url }),
                      "opponents",
                    )
                  }
                  disabled={!!busy}
                />
                <div className="gd-two">
                  <Field label="Data">
                    <input
                      type="date"
                      value={project.matchDate}
                      onChange={(e) => update({ matchDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Horário">
                    <input
                      type="time"
                      value={project.matchTime}
                      onChange={(e) => update({ matchTime: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Prefixo do horário">
                  <input
                    value={project.timePrefix}
                    onChange={(e) =>
                      update({ timePrefix: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Texto superior">
                  <textarea
                    rows="2"
                    value={project.topTeamName}
                    onChange={(e) =>
                      update({ topTeamName: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Temporada">
                  <input
                    value={project.season}
                    onChange={(e) => update({ season: e.target.value })}
                  />
                </Field>
              </>
            )}
            {section === "schedule" && (
              <>
                <h2>Jogos do dia</h2>
                <p className="gd-section-note">
                  O preenchimento pela Agenda traz até 6 partidas da mesma data,
                  ordenadas pelo horário. Use estes campos apenas para o ajuste
                  final da arte.
                </p>
                {project.dailyGames.length ? (
                  project.dailyGames.map((game, index) => (
                    <article className="gd-schedule-row" key={game.id || index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <input
                          type="time"
                          aria-label={`Horário do jogo ${index + 1}`}
                          value={game.time}
                          onChange={(e) =>
                            update({
                              dailyGames: project.dailyGames.map((item, i) =>
                                i === index
                                  ? { ...item, time: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label={`Adversário do jogo ${index + 1}`}
                          value={game.opponent}
                          onChange={(e) =>
                            update({
                              dailyGames: project.dailyGames.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      opponent: e.target.value.toUpperCase(),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                        <input
                          aria-label={`Competição do jogo ${index + 1}`}
                          value={game.competition}
                          onChange={(e) =>
                            update({
                              dailyGames: project.dailyGames.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      competition: e.target.value.toUpperCase(),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="danger"
                        aria-label={`Remover jogo ${index + 1}`}
                        onClick={() =>
                          update({
                            dailyGames: project.dailyGames.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="gd-empty-help">
                    Escolha “Preencher com a Agenda” para montar a lista
                    automaticamente.
                  </p>
                )}
                <button
                  type="button"
                  className="gd-dashed"
                  disabled={project.dailyGames.length >= 6}
                  onClick={() =>
                    update({
                      dailyGames: [
                        ...project.dailyGames,
                        {
                          id: crypto.randomUUID(),
                          time: "22:00",
                          opponent: "ADVERSÁRIO",
                          competition: "AMISTOSO",
                          opponentLogo: "",
                        },
                      ],
                    })
                  }
                >
                  <Icon name="plus" />
                  Adicionar ajuste manual
                </button>
              </>
            )}
            {section === "championship" && (
              <>
                <h2>Campeonatos</h2>
                <Field label="Nome principal">
                  <input
                    value={project.championshipName}
                    onChange={(e) =>
                      update({ championshipName: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <p className="gd-section-note">
                  As logos abaixo formam um único bloco movível na arte. O
                  preenchimento pela Agenda agrupa automaticamente até 5
                  competições.
                </p>
                <UploadButton
                  label={
                    project.competitionLogos.length >= 5
                      ? "Limite de 5 logos atingido"
                      : "Adicionar logo de competição"
                  }
                  onFile={(file) =>
                    uploadProjectAsset(
                      file,
                      (url) =>
                        commit(
                          (current) => ({
                            ...current,
                            competitionLogos: [
                              ...current.competitionLogos,
                              {
                                id: crypto.randomUUID(),
                                name: `COMPETIÇÃO ${current.competitionLogos.length + 1}`,
                                url,
                              },
                            ].slice(0, 5),
                          }),
                          "competition-logo",
                        ),
                      "championships",
                    )
                  }
                  disabled={!!busy || project.competitionLogos.length >= 5}
                />
                {project.competitionLogos.map((logo, index) => (
                  <article className="gd-logo-row" key={logo.id}>
                    <span>
                      {logo.url ? (
                        <img src={logo.url} alt="" />
                      ) : (
                        String(index + 1)
                      )}
                    </span>
                    <input
                      value={logo.name}
                      aria-label={`Nome da competição ${index + 1}`}
                      onChange={(e) =>
                        update({
                          competitionLogos: project.competitionLogos.map(
                            (item) =>
                              item.id === logo.id
                                ? {
                                    ...item,
                                    name: e.target.value.toUpperCase(),
                                  }
                                : item,
                          ),
                        })
                      }
                    />
                    <div>
                      <button
                        type="button"
                        disabled={!index}
                        onClick={() =>
                          update({
                            competitionLogos: project.competitionLogos.map(
                              (_, i, a) =>
                                i === index
                                  ? a[index - 1]
                                  : i === index - 1
                                    ? a[index]
                                    : a[i],
                            ),
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === project.competitionLogos.length - 1}
                        onClick={() =>
                          update({
                            competitionLogos: project.competitionLogos.map(
                              (_, i, a) =>
                                i === index
                                  ? a[index + 1]
                                  : i === index + 1
                                    ? a[index]
                                    : a[i],
                            ),
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          update({
                            competitionLogos: project.competitionLogos.filter(
                              (item) => item.id !== logo.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
                <Toggle
                  label="Exibir nome do time"
                  checked={project.elements.headerTeam.visible}
                  onChange={(visible) =>
                    updateLayer("header-team", { visible })
                  }
                />
                <Toggle
                  label="Exibir campeonatos"
                  checked={project.elements.championship.visible}
                  onChange={(visible) =>
                    updateLayer("championship", { visible })
                  }
                />
                <Toggle
                  label="Exibir temporada"
                  checked={project.elements.season.visible}
                  onChange={(visible) => updateLayer("season", { visible })}
                />
              </>
            )}
            {section === "players" && (
              <>
                <h2>Colagem dos jogadores</h2>
                <p className="gd-section-note">
                  Use uma foto já uniformizada para o melhor acabamento. O
                  recorte automático local funciona melhor em fundos lisos.
                </p>
                {project.players.map((player) => (
                  <article className="gd-player-editor" key={player.id}>
                    <header>
                      <div>
                        <small>
                          {player.role === "main" ? "DESTAQUE" : "APOIO"}
                        </small>
                        <b>{player.name}</b>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSlotId(player.id);
                          setLibraryOpen(true);
                        }}
                      >
                        Biblioteca
                      </button>
                    </header>
                    <Field label="Identificação">
                      <input
                        value={player.name}
                        onChange={(e) =>
                          updateLayer(player.id, { name: e.target.value })
                        }
                      />
                    </Field>
                    <div className="gd-upload-row">
                      <UploadButton
                        label="Imagem original"
                        onFile={(file) =>
                          choosePlayer(player.id, file, "original")
                        }
                        disabled={!!busy}
                      />
                      <UploadButton
                        label="Remover fundo localmente"
                        onFile={(file) =>
                          choosePlayer(player.id, file, "remove")
                        }
                        disabled={!!busy}
                      />
                    </div>
                    {player.activeUrl && (
                      <div className="gd-photo-modes">
                        <button
                          type="button"
                          onClick={() =>
                            updateLayer(player.id, {
                              activeUrl: player.originalUrl,
                            })
                          }
                          disabled={!player.originalUrl}
                        >
                          Original
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateLayer(player.id, {
                              activeUrl: player.cutoutUrl,
                            })
                          }
                          disabled={!player.cutoutUrl}
                        >
                          Recorte
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateLayer(player.id, {
                              activeUrl: player.uniformUrl,
                            })
                          }
                          disabled={!player.uniformUrl}
                        >
                          Uniformizada
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() =>
                            updateLayer(player.id, {
                              activeUrl: "",
                              originalUrl: "",
                              cutoutUrl: "",
                              uniformUrl: "",
                            })
                          }
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </>
            )}
            {section === "uniform" && (
              <>
                <h2>Ajuste de uniforme</h2>
                <div className="gd-recommendation">
                  <b>Modo recomendado</b>
                  <p>
                    Use a versão já uniformizada salva na biblioteca. O ajuste
                    abaixo é uma camada manual; ele não finge substituir a roupa
                    sozinho.
                  </p>
                </div>
                <Toggle
                  label="Ativar camada de uniforme"
                  checked={project.uniform.enabled}
                  onChange={(enabled) =>
                    update({ uniform: { ...project.uniform, enabled } })
                  }
                />
                <UploadButton
                  label={
                    project.uniform.assetUrl
                      ? "Trocar PNG do uniforme"
                      : "Enviar PNG do uniforme oficial"
                  }
                  onFile={(file) =>
                    uploadProjectAsset(
                      file,
                      (url) =>
                        update({
                          uniform: {
                            ...project.uniform,
                            assetUrl: url,
                            enabled: true,
                          },
                        }),
                      "uniforms",
                    )
                  }
                  disabled={!!busy}
                />
                {[
                  ["Posição X", "x", 0, 1080],
                  ["Posição Y", "y", 0, 1500],
                  ["Escala", "scale", 0.2, 3],
                  ["Rotação", "rotation", -30, 30],
                  ["Perspectiva horizontal", "skewX", -30, 30],
                  ["Perspectiva vertical", "skewY", -30, 30],
                  ["Opacidade", "opacity", 0, 100],
                ].map(([label, key, min, max]) => (
                  <Field key={key} label={label}>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={key === "scale" ? 0.01 : 1}
                      value={project.uniform[key]}
                      onChange={(e) =>
                        update({
                          uniform: {
                            ...project.uniform,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </>
            )}
            {section === "group" && (
              <>
                <h2>Nosso grupo</h2>
                <Field label="Título">
                  <input
                    value={project.groupTitle}
                    onChange={(e) =>
                      update({ groupTitle: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                {project.groupTeams.map((team, index) => (
                  <article className="gd-team-row" key={team.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <input
                      value={team.name}
                      onChange={(e) =>
                        update({
                          groupTeams: project.groupTeams.map((item) =>
                            item.id === team.id
                              ? { ...item, name: e.target.value.toUpperCase() }
                              : item,
                          ),
                        })
                      }
                    />
                    <UploadButton
                      label={team.logoUrl ? "Trocar escudo" : "Escudo"}
                      onFile={(file) =>
                        uploadProjectAsset(
                          file,
                          (url) =>
                            update({
                              groupTeams: project.groupTeams.map((item) =>
                                item.id === team.id
                                  ? { ...item, logoUrl: url }
                                  : item,
                              ),
                            }),
                          "teams",
                        )
                      }
                      disabled={!!busy}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          index &&
                          update({
                            groupTeams: project.groupTeams.map((_, i, a) =>
                              i === index
                                ? a[index - 1]
                                : i === index - 1
                                  ? a[index]
                                  : a[i],
                            ),
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          index < project.groupTeams.length - 1 &&
                          update({
                            groupTeams: project.groupTeams.map((_, i, a) =>
                              i === index
                                ? a[index + 1]
                                : i === index + 1
                                  ? a[index]
                                  : a[i],
                            ),
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        className="danger"
                        type="button"
                        disabled={project.groupTeams.length <= 2}
                        onClick={() =>
                          update({
                            groupTeams: project.groupTeams.filter(
                              (item) => item.id !== team.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
                <button
                  className="gd-dashed"
                  type="button"
                  disabled={project.groupTeams.length >= 8}
                  onClick={() =>
                    update({
                      groupTeams: [
                        ...project.groupTeams,
                        {
                          id: crypto.randomUUID(),
                          name: "NOVO TIME",
                          logoUrl: "",
                        },
                      ],
                    })
                  }
                >
                  <Icon name="plus" />
                  Adicionar time
                </button>
              </>
            )}
            {section === "visual" && (
              <>
                <h2>Identidade visual</h2>
                <div className="gd-two">
                  <Field label="Azul principal">
                    <input
                      type="color"
                      value={project.visualSettings.primaryColor}
                      onChange={(e) =>
                        updateVisual({ primaryColor: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Azul secundário">
                    <input
                      type="color"
                      value={project.visualSettings.secondaryColor}
                      onChange={(e) =>
                        updateVisual({ secondaryColor: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {[
                  ["Textura", "textureIntensity"],
                  ["Pinceladas", "brushIntensity"],
                  ["Ruído de impressão", "noiseIntensity"],
                ].map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={project.visualSettings[key]}
                      onChange={(e) =>
                        updateVisual({ [key]: Number(e.target.value) })
                      }
                    />
                  </Field>
                ))}
                <Toggle
                  label="Exibir carimbo"
                  checked={project.visualSettings.showStamp}
                  onChange={(showStamp) => updateVisual({ showStamp })}
                />
                <Toggle
                  label="Exibir GAME DAY vertical"
                  checked={project.visualSettings.showVerticalText}
                  onChange={(showVerticalText) =>
                    updateVisual({ showVerticalText })
                  }
                />
                <Toggle
                  label="Exibir fitas"
                  checked={project.visualSettings.showTape}
                  onChange={(showTape) => updateVisual({ showTape })}
                />
                <Field label="Rodapé esquerdo">
                  <textarea
                    rows="2"
                    value={project.footerLeft}
                    onChange={(e) =>
                      update({ footerLeft: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Centro">
                  <input
                    value={project.footerCenter}
                    onChange={(e) => update({ footerCenter: e.target.value })}
                  />
                </Field>
                <Field label="Rodapé direito">
                  <textarea
                    rows="2"
                    value={project.footerRight}
                    onChange={(e) =>
                      update({ footerRight: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <button className="gd-secondary" type="button" onClick={reset}>
                  Restaurar composição Strix
                </button>
              </>
            )}
            {section === "layers" && (
              <>
                <h2>Camadas da arte</h2>
                <div className="gd-layer-list">
                  {layerGroups.map((group) => (
                    <section key={group.label}>
                      <small>{group.label}</small>
                      {group.ids.map((id) => {
                        const item = allLayers.find((layer) => layer.id === id);
                        if (!item) return null;
                        return (
                          <div
                            className={`${selectedId === id ? "active" : ""} ${!item.visible ? "muted" : ""}`}
                            key={id}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedId(id)}
                            >
                              <span>{layerLabels[id] || id}</span>
                              <small>
                                {item.locked ? "TRAVADA" : "EDITÁVEL"}
                              </small>
                            </button>
                            <button
                              type="button"
                              title={item.visible ? "Ocultar" : "Exibir"}
                              aria-label={`${item.visible ? "Ocultar" : "Exibir"} ${layerLabels[id] || id}`}
                              onClick={() =>
                                updateLayer(id, { visible: !item.visible })
                              }
                            >
                              {item.visible ? "◉" : "○"}
                            </button>
                            <button
                              type="button"
                              title={item.locked ? "Destravar" : "Travar"}
                              aria-label={`${item.locked ? "Destravar" : "Travar"} ${layerLabels[id] || id}`}
                              onClick={() =>
                                updateLayer(id, { locked: !item.locked })
                              }
                            >
                              {item.locked ? "▣" : "◇"}
                            </button>
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>
                <h3>Camada selecionada</h3>
                <LayerControls
                  layer={selected}
                  onChange={(patch) => updateLayer(selectedId, patch)}
                  onReset={() => {
                    const fresh = createDefaultProject();
                    const original = [
                      ...fresh.players,
                      ...Object.values(fresh.elements),
                    ].find((item) => item.id === selectedId);
                    if (original) updateLayer(selectedId, original);
                  }}
                />
                <Toggle
                  label="Guias de alinhamento"
                  checked={project.visualSettings.showGuides}
                  onChange={(showGuides) => updateVisual({ showGuides })}
                />
                <Toggle
                  label="Snap ao centro"
                  checked={project.visualSettings.snap}
                  onChange={(snap) => updateVisual({ snap })}
                />
              </>
            )}
            {section === "projects" && (
              <>
                <h2>Projetos salvos</h2>
                <button
                  className="gd-primary"
                  type="button"
                  onClick={() => {
                    resetHistory();
                    setProject(createDefaultProject());
                    setSelectedId("");
                  }}
                >
                  <Icon name="plus" />
                  Novo projeto
                </button>
                {projects.length ? (
                  projects.map((item) => (
                    <article className="gd-project-row" key={item.id}>
                      <div>
                        <small>
                          {new Date(item.updated_at).toLocaleString("pt-BR")}
                        </small>
                        <b>{item.name}</b>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          resetHistory();
                          setProject(
                            hydrateGameDayProject({
                              ...item.project,
                              id: item.id,
                              name: item.name,
                            }),
                          );
                        }}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetHistory();
                          setProject(
                            hydrateGameDayProject({
                              ...item.project,
                              id: null,
                              name: `Cópia de ${item.name}`,
                              updatedAt: new Date().toISOString(),
                            }),
                          );
                        }}
                      >
                        Duplicar
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={async () => {
                          await deleteProject(client, item.id);
                          await refreshProjects();
                        }}
                      >
                        Excluir
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="gd-empty-help">
                    Nenhum projeto salvo no banco.
                  </p>
                )}
              </>
            )}
            {section === "export" && (
              <>
                <h2>Exportação</h2>
                <p className="gd-section-note">
                  O Story é a composição principal. A versão Feed reorganiza o
                  mesmo projeto para 1080 × 1350.
                </p>
                <button
                  className="gd-primary gd-export-button"
                  type="button"
                  onClick={() => exportImage("story")}
                  disabled={!!busy}
                >
                  <Icon name="download" />
                  Baixar Story em PNG <small>1080 × 1920</small>
                </button>
                <button
                  className="gd-secondary gd-export-button"
                  type="button"
                  onClick={() => exportImage("feed")}
                  disabled={!!busy}
                >
                  <Icon name="download" />
                  Baixar adaptação para Feed <small>1080 × 1350</small>
                </button>
                <button
                  className="gd-secondary"
                  type="button"
                  onClick={saveNow}
                  disabled={!!busy}
                >
                  <Icon name="save" />
                  Salvar projeto
                </button>
              </>
            )}
            {error && (
              <div className="gd-error" role="alert">
                {error}
                <button type="button" onClick={() => setError("")}>
                  ×
                </button>
              </div>
            )}
            {busy && (
              <div className="gd-busy">
                <i />
                <span>{busy}</span>
              </div>
            )}
          </div>
        </aside>
        <main className="gd-preview-panel">
          <header>
            <div>
              <small>PREVIEW REAL</small>
              <strong>
                {format === "story" ? "1080 × 1920" : "1080 × 1350"}
              </strong>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setZoom((v) => Math.max(0.2, v - 0.05))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((v) => Math.min(0.7, v + 0.05))}
              >
                +
              </button>
            </div>
          </header>
          <div className="gd-preview-viewport">
            <div
              className="gd-preview-scale"
              style={{
                width:
                  (format === "story" ? STORY_SIZE.width : FEED_SIZE.width) *
                  zoom,
                height:
                  (format === "story" ? STORY_SIZE.height : FEED_SIZE.height) *
                  zoom,
              }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <GameDayCanvas
                  ref={canvasRef}
                  project={project}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onLayerChange={updateLayer}
                  format={format}
                  exportMode={exporting}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      {libraryOpen && (
        <PlayerLibrary
          client={client}
          profile={profile}
          players={library}
          refresh={refreshLibrary}
          onPick={pickFromLibrary}
          close={() => setLibraryOpen(false)}
        />
      )}
    </section>
  );
}
