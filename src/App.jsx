import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sailboat, Plus, Minus, Users, ArrowRight, RotateCcw, Trophy, Edit3, Flag, Shuffle, Medal, FileText } from "lucide-react";

function Button({ children, className = "", variant = "default", size, ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    blue: "bg-[#003b73] text-white hover:bg-[#002f5c]",
    yellow: "bg-yellow-300 text-slate-950 hover:bg-yellow-400",
  };
  const sizes = { icon: "h-10 w-10 p-0", sm: "h-9 px-3 text-sm" };
  return <button className={`${base} ${variants[variant] || variants.default} ${sizes[size] || "px-4 py-2"} ${className}`} {...props}>{children}</button>;
}

function Card({ children, className = "" }) { return <div className={`bg-white ${className}`}>{children}</div>; }
function CardContent({ children, className = "" }) { return <div className={className}>{children}</div>; }

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function defaultTeams(count) { return Array.from({ length: count }, (_, index) => `Lag ${index + 1}`); }
function cleanTeams(teamNames, count) { return teamNames.slice(0, count).map((name, index) => ({ id: `T${index + 1}`, seed: index + 1, name: name.trim() || `Lag ${index + 1}` })); }
function matchesPerFlightFromBoats(boatCount) { if (boatCount >= 6) return 3; if (boatCount >= 4) return 2; return 1; }
function teamName(teams, id) { return teams.find((team) => team.id === id)?.name || "–"; }
function winPercent(row) { return row.played === 0 ? "–" : `${Math.round((row.wins / row.played) * 100)}%`; }

function addFlights(matches, matchesPerFlight, allTeams = []) {
  const flights = [];

  matches.forEach((match) => {
    let placed = false;
    for (const flight of flights) {
      const usedTeams = new Set(flight.flatMap((m) => [m.blueId, m.yellowId]));
      const canFit = flight.length < matchesPerFlight && !usedTeams.has(match.blueId) && !usedTeams.has(match.yellowId);
      if (canFit) {
        flight.push(match);
        placed = true;
        break;
      }
    }
    if (!placed) flights.push([match]);
  });

  return flights.flatMap((flightMatches, flightIndex) => {
    const sailingIds = new Set(flightMatches.flatMap((m) => [m.blueId, m.yellowId]));
    const byes = allTeams.length ? allTeams.filter((team) => !sailingIds.has(team.id)).map((team) => team.id) : [];
    return flightMatches.map((match, matchIndex) => ({
      ...match,
      flight: flightIndex + 1,
      flightMatch: matchIndex + 1,
      byeIds: byes,
    }));
  });
}

function createRoundRobinMatches(teams, boatCount) {
  const realTeamCount = teams.length;
  const list = [...teams];
  if (list.length % 2 === 1) list.push({ id: "BYE", name: "Står över" });

  const rounds = [];
  const roundsCount = list.length - 1;
  const half = list.length / 2;
  const colorScore = Object.fromEntries(teams.map((team) => [team.id, 0]));
  let matchNumber = 1;

  for (let round = 0; round < roundsCount; round++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (a.id === "BYE" || b.id === "BYE") continue;

      const optionAB = Math.abs(colorScore[a.id] + 1) + Math.abs(colorScore[b.id] - 1);
      const optionBA = Math.abs(colorScore[a.id] - 1) + Math.abs(colorScore[b.id] + 1);
      let blue = a;
      let yellow = b;
      if (optionBA < optionAB) { blue = b; yellow = a; }
      colorScore[blue.id] += 1;
      colorScore[yellow.id] -= 1;

      roundMatches.push({
        id: `RR-${matchNumber}`,
        phase: "Round robin",
        number: matchNumber,
        blueId: blue.id,
        yellowId: yellow.id,
        winnerId: null,
      });
      matchNumber += 1;
    }
    rounds.push(roundMatches);

    const fixed = list[0];
    const rotating = list.slice(1);
    rotating.unshift(rotating.pop());
    list.splice(0, list.length, fixed, ...rotating);
  }

  const maxMatchesByBoats = matchesPerFlightFromBoats(boatCount);
  const maxMatchesByTeams = Math.floor(realTeamCount / 2);
  const matchesPerFlight = Math.max(1, Math.min(maxMatchesByBoats, maxMatchesByTeams));
  const flights = [];

  rounds.forEach((roundMatches) => {
    for (let i = 0; i < roundMatches.length; i += matchesPerFlight) {
      flights.push(roundMatches.slice(i, i + matchesPerFlight));
    }
  });

  return flights.flatMap((flightMatches, flightIndex) => {
    const sailingIds = new Set(flightMatches.flatMap((match) => [match.blueId, match.yellowId]));
    const byes = teams.filter((team) => !sailingIds.has(team.id)).map((team) => team.id);
    return flightMatches.map((match, matchIndex) => ({
      ...match,
      flight: flightIndex + 1,
      flightMatch: matchIndex + 1,
      byeIds: byes,
    }));
  });
}

function winsBetween(matches, teamAId, teamBId) {
  return matches.filter((match) => [match.blueId, match.yellowId].includes(teamAId) && [match.blueId, match.yellowId].includes(teamBId) && match.winnerId === teamAId).length;
}

function buildStandings(teams, matches, manualOrder = {}) {
  const rows = teams.map((team) => {
    const played = matches.filter((match) => [match.blueId, match.yellowId].includes(team.id) && match.winnerId).length;
    const wins = matches.filter((match) => match.winnerId === team.id).length;
    return { ...team, played, wins, losses: played - wins };
  });

  const groups = new Map();
  rows.forEach((row) => { if (!groups.has(row.wins)) groups.set(row.wins, []); groups.get(row.wins).push(row); });
  const ordered = [];
  const unresolvedGroups = [];

  [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([wins, group]) => {
    if (group.length === 1) { ordered.push(group[0]); return; }
    const manualKey = group.map((team) => team.id).sort().join("|");
    const manual = manualOrder[manualKey];
    if (manual) { manual.forEach((id) => { const found = group.find((team) => team.id === id); if (found) ordered.push(found); }); return; }
    if (group.length === 2) {
      const [a, b] = group;
      const aBeatB = winsBetween(matches, a.id, b.id);
      const bBeatA = winsBetween(matches, b.id, a.id);
      if (aBeatB !== bBeatA) { ordered.push(aBeatB > bBeatA ? a : b, aBeatB > bBeatA ? b : a); return; }
    }
    unresolvedGroups.push({ wins, teams: group, key: manualKey });
    ordered.push(...group.sort((a, b) => a.seed - b.seed));
  });

  return ordered.map((row, index) => ({ ...row, rank: index + 1, unresolved: unresolvedGroups.some((group) => group.teams.some((team) => team.id === row.id)) }));
}

function createSeries(id, title, teamAId, teamBId, targetWins, higherRankYellow, standings, boatCount, startsAtMatchNumber = 1) {
  const higher = [teamAId, teamBId].sort((a, b) => (standings.find((t) => t.id === a)?.rank || 99) - (standings.find((t) => t.id === b)?.rank || 99))[0];
  const lower = higher === teamAId ? teamBId : teamAId;
  const maxMatches = targetWins * 2 - 1;
  const raw = Array.from({ length: maxMatches }, (_, index) => {
    let yellowId;
    let blueId;
    if (higherRankYellow) {
      // Högst rankad från round robin börjar alltid gul.
      // Sedan alternerar sidorna varje match.
      yellowId = index % 2 === 0 ? higher : lower;
      blueId = yellowId === higher ? lower : higher;
    } else {
      // Även i semifinaler ska högst rankad börja som gul.
      yellowId = index % 2 === 0 ? higher : lower;
      blueId = yellowId === higher ? lower : higher;
    }
    return { id: `${id}-M${index + 1}`, phase: title, number: startsAtMatchNumber + index, blueId, yellowId, winnerId: null, flight: 1, flightMatch: 1 };
  });
  return { id, title, teamAId, teamBId, targetWins, matches: addFlights(raw, matchesPerFlightFromBoats(boatCount), [standings.find((t) => t.id === teamAId), standings.find((t) => t.id === teamBId)].filter(Boolean)) };
}

function assignFlightsToSeries(seriesList, boatCount, preferredOrderIds = null) {
  const matchesPerFlight = matchesPerFlightFromBoats(boatCount);
  const orderedSeries = preferredOrderIds ? preferredOrderIds.map((id) => seriesList.find((serie) => serie.id === id)).filter(Boolean) : seriesList;
  const orderedMatches = [];
  let round = 0;
  let keepGoing = true;

  while (keepGoing) {
    keepGoing = false;
    orderedSeries.forEach((serie) => {
      const match = serie.matches[round];
      if (match) {
        keepGoing = true;
        orderedMatches.push({ ...match, serieId: serie.id });
      }
    });
    round += 1;
  }

  const withFlights = addFlights(orderedMatches, matchesPerFlight);

  return seriesList.map((serie) => {
    const nextMatches = serie.matches.map((match) => {
      const found = withFlights.find((m) => m.serieId === serie.id && m.id === match.id);
      return found ? { ...match, flight: found.flight, flightMatch: found.flightMatch, number: found.number || withFlights.findIndex((m) => m.serieId === serie.id && m.id === match.id) + 1 } : match;
    });
    return { ...serie, matches: nextMatches };
  });
}

function buildFlightView(matches) {
  const grouped = new Map();
  matches.forEach((match) => {
    if (!grouped.has(match.flight)) grouped.set(match.flight, []);
    grouped.get(match.flight).push(match);
  });
  return [...grouped.entries()].map(([flight, flightMatches]) => ({
    flight,
    matches: flightMatches.sort((a, b) => a.flightMatch - b.flightMatch),
  })).sort((a, b) => a.flight - b.flight);
}

function seriesScore(serie, teamId) { return serie.matches.filter((match) => match.winnerId === teamId).length; }
function seriesWinner(serie) {
  if (!serie) return null;
  const aWins = seriesScore(serie, serie.teamAId);
  const bWins = seriesScore(serie, serie.teamBId);
  if (aWins >= serie.targetWins) return serie.teamAId;
  if (bWins >= serie.targetWins) return serie.teamBId;
  return null;
}
function seriesLoser(serie) { const winner = seriesWinner(serie); if (!winner) return null; return winner === serie.teamAId ? serie.teamBId : serie.teamAId; }

function printableScheduleHtml(title, subtitle, matches, teams) {
  const grouped = new Map();
  matches.forEach((match) => { if (!grouped.has(match.flight)) grouped.set(match.flight, []); grouped.get(match.flight).push(match); });
  const rows = [...grouped.entries()].map(([flight, flightMatches]) => `
    <h2>Flight ${flight}</h2>
    <table>
      <thead><tr><th>Match</th><th class="blue">Blå sida</th><th class="yellow">Gul sida</th></tr></thead>
      <tbody>${flightMatches.map((match) => `<tr><td>${match.phase || "Match"} ${match.number}</td><td class="blue">${teamName(teams, match.blueId)}</td><td class="yellow">${teamName(teams, match.yellowId)}</td></tr>`).join("")}${flightMatches[0]?.byeIds?.length ? `<tr><td colspan="3"><b>Står över:</b> ${flightMatches[0].byeIds.map((id) => teamName(teams, id)).join(", ")}</td></tr>` : ""}</tbody>
    </table>
  `).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:28px;color:#0f172a} h1{margin:0 0 4px} p{margin:0 0 20px;color:#475569} h2{margin:22px 0 8px;font-size:18px} table{width:100%;border-collapse:collapse;margin-bottom:12px} th,td{border:1px solid #cbd5e1;padding:10px;text-align:left;font-size:14px} th{background:#f1f5f9}.blue{background:#002f5f;color:white;font-weight:700}.yellow{background:#fde047;color:#111827;font-weight:700}@media print{button{display:none}}
  </style></head><body><button onclick="window.print()" style="padding:10px 14px;margin-bottom:20px;border-radius:10px;border:1px solid #ccc;background:#111;color:#fff">Skriv ut / Spara som PDF</button><h1>${title}</h1><p>${subtitle}</p>${rows}</body></html>`;
}

function openPdfWindow(title, subtitle, matches, teams) {
  const win = window.open("", "_blank");
  if (!win) return alert("Popup blockerad. Tillåt popup-fönster och försök igen.");
  win.document.write(printableScheduleHtml(title, subtitle, matches, teams));
  win.document.close();
}

export default function MatchRacingApp() {
  const [teamCount, setTeamCount] = useState(4);
  const [boatCount, setBoatCount] = useState(4);
  const [teamNames, setTeamNames] = useState(defaultTeams(4));
  const [step, setStep] = useState("setup");
  const [rrMatches, setRrMatches] = useState([]);
  const [manualOrder, setManualOrder] = useState({});
  const [tieGroup, setTieGroup] = useState(null);
  const [playoffFormat, setPlayoffFormat] = useState(null);
  const [semiChoiceId, setSemiChoiceId] = useState("");
  const [targets, setTargets] = useState({ semi: 1, petit: 1, final: 1 });
  const [playoffType, setPlayoffType] = useState(null);
  const [playoffSeries, setPlayoffSeries] = useState([]);

  const teams = useMemo(() => cleanTeams(teamNames, teamCount), [teamNames, teamCount]);
  const standings = useMemo(() => buildStandings(teams, rrMatches, manualOrder), [teams, rrMatches, manualOrder]);
  const unresolved = useMemo(() => standings.filter((row) => row.unresolved), [standings]);
  const allRoundRobinDone = rrMatches.length > 0 && rrMatches.every((match) => match.winnerId);
  const matchesPerFlight = matchesPerFlightFromBoats(boatCount);
  const semiMatches = playoffSeries.filter((serie) => serie.id.startsWith("SF")).flatMap((serie) => serie.matches.map((match) => ({ ...match, phase: serie.title, serieId: serie.id })));
  const finalMatches = playoffSeries.filter((serie) => serie.id === "P" || serie.id === "F").flatMap((serie) => serie.matches.map((match) => ({ ...match, phase: serie.title, serieId: serie.id })));
  const playoffMatches = [...semiMatches, ...finalMatches];
  const semiFlights = useMemo(() => buildFlightView(semiMatches), [semiMatches]);
  const finalFlights = useMemo(() => buildFlightView(finalMatches), [finalMatches]);

  function updateTeamCount(nextCount) {
    const safeCount = clamp(Number(nextCount) || 2, 2, 24);
    setTeamCount(safeCount);
    setTeamNames((current) => {
      const next = [...current];
      while (next.length < safeCount) next.push(`Lag ${next.length + 1}`);
      return next.slice(0, safeCount);
    });
  }
  function updateTeamName(index, value) { setTeamNames((current) => { const next = [...current]; next[index] = value; return next; }); }
  function updateTarget(key, value) { setTargets((current) => ({ ...current, [key]: clamp(Number(value) || 1, 1, 7) })); }

  function startRoundRobin() {
    setManualOrder({}); setTieGroup(null); setPlayoffType(null); setPlayoffFormat(null); setPlayoffSeries([]); setSemiChoiceId("");
    setRrMatches(createRoundRobinMatches(teams, boatCount));
    setStep("roundRobin");
  }
  function setRoundRobinWinner(matchId, winnerId) { setManualOrder({}); setRrMatches((current) => current.map((match) => match.id === matchId ? { ...match, winnerId } : match)); }

  function findFirstTieGroup() {
    const groups = new Map();
    standings.forEach((row) => { if (!row.unresolved) return; if (!groups.has(row.wins)) groups.set(row.wins, []); groups.get(row.wins).push(row); });
    const first = [...groups.entries()].sort((a, b) => b[0] - a[0])[0];
    if (!first) return null;
    const [wins, teamsInGroup] = first;
    return { wins, teams: teamsInGroup, key: teamsInGroup.map((team) => team.id).sort().join("|") };
  }
  function openTieResolver() { const group = findFirstTieGroup(); if (group) setTieGroup({ ...group, order: group.teams.map((team) => team.id) }); }
  function moveTieTeam(index, direction) { setTieGroup((current) => { if (!current) return current; const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= current.order.length) return current; const nextOrder = [...current.order]; [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]]; return { ...current, order: nextOrder }; }); }
  function saveTieOrder() { if (!tieGroup) return; setManualOrder((current) => ({ ...current, [tieGroup.key]: tieGroup.order })); setTieGroup(null); }

  function chooseFormat(format) { setPlayoffFormat(format); setStep("playoffSetup"); }

  function createDirectFinals() {
    const r = (rank) => standings.find((team) => team.rank === rank)?.id;
    const petit = createSeries("P", "Petit final", r(3), r(4), targets.petit, true, standings, boatCount, 1);
    const final = createSeries("F", "Final", r(1), r(2), targets.final, true, standings, boatCount, 1);
    setPlayoffType("finalOnly");
    setPlayoffSeries(assignFlightsToSeries([petit, final], boatCount, ["P", "F"]));
    setStep("playoff");
  }

  function createSemis() {
    const chooser = standings.find((team) => team.rank === 1);
    const candidates = standings.filter((team) => team.rank >= 2 && team.rank <= 4);
    const chosen = candidates.find((team) => team.id === semiChoiceId) || candidates.find((team) => team.rank === 4);
    const remaining = candidates.filter((team) => team.id !== chosen?.id);

    if (!chooser || !chosen || remaining.length !== 2) {
      alert("Kunde inte skapa semifinaler. Kontrollera att topp 4 finns och att ett motståndarlag är valt.");
      return;
    }

    const sf1 = createSeries("SF1", "Semifinal 1", chooser.id, chosen.id, targets.semi, false, standings, boatCount, 1);
    const sf2 = createSeries("SF2", "Semifinal 2", remaining[0].id, remaining[1].id, targets.semi, false, standings, boatCount, 1);
    setPlayoffType("semis");
    setPlayoffSeries(assignFlightsToSeries([sf1, sf2], boatCount, ["SF2", "SF1"]));
    setStep("playoff");
  }

  function setPlayoffWinner(serieId, matchId, winnerId) {
    setPlayoffSeries((current) => current.map((serie) => serie.id !== serieId ? serie : { ...serie, matches: serie.matches.map((match) => match.id === matchId ? { ...match, winnerId } : match) }));
  }

  function createFinalsFromSemis() {
    const sf1 = playoffSeries.find((serie) => serie.id === "SF1");
    const sf2 = playoffSeries.find((serie) => serie.id === "SF2");
    const petit = createSeries("P", "Petit final", seriesLoser(sf1), seriesLoser(sf2), targets.petit, true, standings, boatCount, 1);
    const final = createSeries("F", "Final", seriesWinner(sf1), seriesWinner(sf2), targets.final, true, standings, boatCount, 1);
    setPlayoffSeries((current) => [...current.filter((serie) => serie.id.startsWith("SF")), ...assignFlightsToSeries([petit, final], boatCount, ["P", "F"])]);
  }

  function resetAll() {
    setTeamCount(4); setBoatCount(4); setTeamNames(defaultTeams(4)); setStep("setup"); setRrMatches([]); setManualOrder({}); setTieGroup(null); setPlayoffFormat(null); setSemiChoiceId(""); setTargets({ semi: 1, petit: 1, final: 1 }); setPlayoffType(null); setPlayoffSeries([]);
  }

  const finalSerie = playoffSeries.find((serie) => serie.id === "F");
  const petitSerie = playoffSeries.find((serie) => serie.id === "P");
  const finalWinner = seriesWinner(finalSerie);
  const petitWinner = seriesWinner(petitSerie);
  const finalLoser = seriesLoser(finalSerie);
  const petitLoser = seriesLoser(petitSerie);
  const semisDone = playoffType === "semis" && playoffSeries.filter((serie) => serie.id.startsWith("SF")).length === 2 && playoffSeries.filter((serie) => serie.id.startsWith("SF")).every((serie) => seriesWinner(serie));

  return <div className="min-h-screen bg-slate-50 text-slate-950"><div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-5 sm:py-8">
    <header className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"><Sailboat className="h-6 w-6" /></div><div><h1 className="text-xl font-bold leading-tight">Match Racing</h1><p className="text-sm text-slate-500">Tävlingsplanerare</p></div></div><Button variant="ghost" size="icon" onClick={resetAll}><RotateCcw className="h-5 w-5" /></Button></header>

    {step === "setup" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-5 p-5"><div><div className="mb-1 flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="text-lg font-semibold">Inställningar</h2></div><p className="text-sm text-slate-500">Fyll i lag och antal båtar. Antal båtar avgör hur många matcher som körs per flight.</p></div><NumberPicker label="Antal lag" value={teamCount} min={2} max={24} onChange={updateTeamCount} /><NumberPicker label="Antal båtar" value={boatCount} min={2} max={12} onChange={setBoatCount} /><div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">Med {boatCount} båtar körs <b>{matchesPerFlight}</b> match{matchesPerFlight === 1 ? "" : "er"} per flight.</div></CardContent></Card><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-3 p-5"><h2 className="text-lg font-semibold">Lagnamn</h2><div className="space-y-3">{teams.map((team, index) => <div key={team.id} className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</div><input className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none focus:ring-2 focus:ring-slate-300" value={teamNames[index] || ""} placeholder={`Lag ${index + 1}`} onChange={(event) => updateTeamName(index, event.target.value)} /></div>)}</div></CardContent></Card><Button className="h-13 w-full rounded-2xl py-6 text-base font-semibold" onClick={startRoundRobin}>Skapa round robin <ArrowRight className="ml-2 h-5 w-5" /></Button></motion.div>}

    {step === "roundRobin" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Round robin</h2><p className="text-sm text-slate-500">{rrMatches.length} matcher. {matchesPerFlight} match{matchesPerFlight === 1 ? "" : "er"} per flight.</p></div><Button variant="outline" size="sm" onClick={() => setStep("setup")}><Edit3 className="mr-2 h-4 w-4" />Ändra</Button></div><Button variant="outline" className="w-full" onClick={() => openPdfWindow("Round robin-schema", `${teamCount} lag · ${boatCount} båtar · ${matchesPerFlight} match(er) per flight`, rrMatches, teams)}><FileText className="mr-2 h-4 w-4" />Exportera round robin som PDF</Button><MatchList matches={rrMatches} teams={teams} onWinner={setRoundRobinWinner} /></CardContent></Card><StandingsCard standings={standings} />{allRoundRobinDone && unresolved.length > 0 && <Button className="h-12 w-full rounded-2xl" onClick={openTieResolver}>Red ut lika placering manuellt</Button>}{allRoundRobinDone && unresolved.length === 0 && <Button className="h-12 w-full rounded-2xl" onClick={() => setStep("playoffChoice")}>Gå vidare till avslutande matcher <ArrowRight className="ml-2 h-5 w-5" /></Button>}</motion.div>}

    {step === "playoffChoice" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><StandingsCard standings={standings} /><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5"><div><h2 className="text-lg font-semibold">Välj slutspelsformat</h2><p className="text-sm text-slate-500">Först väljer du format. Sedan fyller du bara i de frågor som hör till formatet.</p></div><div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" className="h-auto rounded-2xl bg-slate-100 py-5 hover:bg-slate-200" onClick={() => chooseFormat("semis")} disabled={teams.length < 4}>Semifinaler</Button><Button variant="outline" className="h-auto rounded-2xl bg-slate-100 py-5 hover:bg-slate-200" onClick={() => chooseFormat("finalOnly")} disabled={teams.length < 4}>Direkt final + petit final</Button></div></CardContent></Card></motion.div>}

    {step === "playoffSetup" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-4 p-5"><div><h2 className="text-lg font-semibold">{playoffFormat === "semis" ? "Inställningar för semifinaler" : "Inställningar för final + petit final"}</h2><p className="text-sm text-slate-500">Fyll i antal vinster och eventuella val.</p></div>{playoffFormat === "semis" && <><NumberPicker label="Semifinal spelas till" value={targets.semi} min={1} max={7} onChange={(value) => updateTarget("semi", value)} /><div className="rounded-2xl bg-slate-100 p-4"><label className="mb-2 block text-sm font-medium text-slate-600">{standings.find((team) => team.rank === 1)?.name} väljer semifinalmotståndare</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3" value={semiChoiceId} onChange={(e) => setSemiChoiceId(e.target.value)}><option value="">Standard: välj rank 4</option>{standings.filter((team) => team.rank >= 2 && team.rank <= 4).map((team) => <option key={team.id} value={team.id}>{team.rank}. {team.name}</option>)}</select><div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-600">Semifinal 1: {standings.find((team) => team.rank === 1)?.name} mot {teamName(teams, semiChoiceId || standings.find((team) => team.rank === 4)?.id)}<br />Semifinal 2: {standings.filter((team) => team.rank >= 2 && team.rank <= 4 && team.id !== (semiChoiceId || standings.find((t) => t.rank === 4)?.id)).map((team) => team.name).join(" mot ")}</div></div></>}<NumberPicker label="Petit final spelas till" value={targets.petit} min={1} max={7} onChange={(value) => updateTarget("petit", value)} /><NumberPicker label="Final spelas till" value={targets.final} min={1} max={7} onChange={(value) => updateTarget("final", value)} /><Button className="h-12 w-full rounded-2xl" onClick={playoffFormat === "semis" ? createSemis : createDirectFinals}>Skapa slutspelsschema</Button><Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => setStep("playoffChoice")}>Tillbaka</Button></CardContent></Card></motion.div>}

    {step === "playoff" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4"><Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Slutspel</h2><p className="text-sm text-slate-500">Final/petit: högst rankad börjar gul och byter sida efter varje match. Petit före stora finalen.</p></div><Button variant="outline" size="sm" onClick={() => setStep("playoffChoice")}><Shuffle className="mr-2 h-4 w-4" />Ändra</Button></div>{semiMatches.length > 0 && <Button variant="outline" className="w-full" onClick={() => openPdfWindow("Semifinalschema", "Semifinaler", semiMatches, teams)}><FileText className="mr-2 h-4 w-4" />Exportera semifinalschema som PDF</Button>}{finalMatches.length > 0 && <Button variant="outline" className="w-full" onClick={() => openPdfWindow("Finalschema", "Petit final och final", finalMatches, teams)}><FileText className="mr-2 h-4 w-4" />Exportera finalschema som PDF</Button>}{semiFlights.length > 0 && <><h3 className="pt-2 text-base font-semibold">Semifinalschema</h3><PlayoffFlightSchedule flights={semiFlights} teams={teams} series={playoffSeries} onWinner={setPlayoffWinner} /></>}{finalFlights.length > 0 && <><h3 className="pt-2 text-base font-semibold">Finalschema</h3><PlayoffFlightSchedule flights={finalFlights} teams={teams} series={playoffSeries} onWinner={setPlayoffWinner} /></>}{semisDone && !playoffSeries.some((serie) => serie.id === "F") && <Button className="h-12 w-full rounded-2xl" onClick={createFinalsFromSemis}>Skapa final och petit final</Button>}</CardContent></Card>{finalWinner && petitWinner && <Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-2"><Trophy className="h-5 w-5" /><h2 className="text-lg font-semibold">Slutresultat</h2></div><ResultRow rank="1" name={teamName(teams, finalWinner)} /><ResultRow rank="2" name={teamName(teams, finalLoser)} /><ResultRow rank="3" name={teamName(teams, petitWinner)} /><ResultRow rank="4" name={teamName(teams, petitLoser)} />{standings.filter((team) => ![finalWinner, finalLoser, petitWinner, petitLoser].includes(team.id)).map((team) => <ResultRow key={team.id} rank={team.rank} name={team.name} />)}</CardContent></Card>}</motion.div>}

    {tieGroup && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"><Card className="w-full max-w-md rounded-2xl border border-slate-200 shadow-xl"><CardContent className="space-y-4 p-5"><div><h2 className="text-lg font-semibold">Manuell tie-break</h2><p className="text-sm text-slate-500">Använd pilarna för att sätta ordningen. Överst blir bäst placerad.</p></div><div className="space-y-2">{tieGroup.order.map((id, index) => <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-100 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-semibold">{index + 1}</div><div className="flex-1 font-medium">{teamName(teams, id)}</div><Button variant="outline" size="sm" onClick={() => moveTieTeam(index, -1)}>Upp</Button><Button variant="outline" size="sm" onClick={() => moveTieTeam(index, 1)}>Ner</Button></div>)}</div><div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => setTieGroup(null)}>Avbryt</Button><Button onClick={saveTieOrder}>Spara ordning</Button></div></CardContent></Card></div>}
  </div></div>;
}

function NumberPicker({ label, value, min, max, onChange }) {
  return <div className="rounded-2xl bg-slate-100 p-4"><label className="mb-3 block text-sm font-medium text-slate-600">{label}</label><div className="flex items-center justify-between gap-3"><Button variant="outline" size="icon" onClick={() => onChange(clamp(value - 1, min, max))}><Minus className="h-4 w-4" /></Button><input className="h-12 w-24 rounded-xl border border-slate-200 bg-white text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-slate-300" type="number" min={min} max={max} value={value} onChange={(event) => onChange(clamp(Number(event.target.value) || min, min, max))} /><Button variant="outline" size="icon" onClick={() => onChange(clamp(value + 1, min, max))}><Plus className="h-4 w-4" /></Button></div></div>;
}

function MatchList({ matches, teams, onWinner }) {
  const grouped = new Map();
  matches.forEach((match) => { if (!grouped.has(match.flight)) grouped.set(match.flight, []); grouped.get(match.flight).push(match); });
  return <div className="space-y-4">{[...grouped.entries()].map(([flight, flightMatches]) => {
    return <div key={flight} className="rounded-2xl bg-slate-100 p-3"><div className="mb-2 text-sm font-bold">Flight {flight}</div><div className="space-y-3">{flightMatches.map((match) => <MatchRow key={match.id} match={match} teams={teams} onWinner={onWinner} />)}</div></div>;
  })}</div>;
}

function MatchRow({ match, teams, onWinner }) {
  const blueSelected = match.winnerId === match.blueId;
  const yellowSelected = match.winnerId === match.yellowId;

  const blueStyle = {
    backgroundColor: "#003b73",
    color: "white",
    borderColor: blueSelected ? "#000000" : "#003b73",
    borderWidth: blueSelected ? "5px" : "2px",
    borderStyle: "solid",
  };

  const yellowStyle = {
    backgroundColor: "#facc15",
    color: "#020617",
    borderColor: yellowSelected ? "#000000" : "#facc15",
    borderWidth: yellowSelected ? "5px" : "2px",
    borderStyle: "solid",
  };

  return <div className="rounded-2xl border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400"><span>{match.phase && match.phase !== "Round robin" ? match.phase : "Match"} {match.number}</span>{match.winnerId && <span className="text-slate-600">Vinnare: {teamName(teams, match.winnerId)}</span>}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" style={blueStyle} className="inline-flex h-auto items-center justify-start rounded-xl px-4 py-4 text-left font-medium transition active:scale-[0.98]" onClick={() => onWinner(match.id, match.blueId)}><Flag className="mr-2 h-4 w-4" />{teamName(teams, match.blueId)}</button><button type="button" style={yellowStyle} className="inline-flex h-auto items-center justify-start rounded-xl px-4 py-4 text-left font-medium transition active:scale-[0.98]" onClick={() => onWinner(match.id, match.yellowId)}><Flag className="mr-2 h-4 w-4" />{teamName(teams, match.yellowId)}</button></div></div>;
}

function StandingsCard({ standings }) {
  return <Card className="rounded-2xl border border-slate-200 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-center gap-2"><Medal className="h-5 w-5" /><h2 className="text-lg font-semibold">Resultat round robin</h2></div><div className="overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">#</th><th className="p-3">Lag</th><th className="p-3 text-center">V</th><th className="p-3 text-center">F</th><th className="p-3 text-center">Vinst %</th></tr></thead><tbody>{standings.map((row) => <tr key={row.id} className="border-t border-slate-200 bg-white"><td className="p-3 font-semibold">{row.rank}</td><td className="p-3 font-medium">{row.name}{row.unresolved && <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">lika</span>}</td><td className="p-3 text-center font-semibold">{row.wins}</td><td className="p-3 text-center">{row.losses}</td><td className="p-3 text-center font-semibold text-slate-700">{winPercent(row)}</td></tr>)}</tbody></table></div></CardContent></Card>;
}

function PlayoffFlightSchedule({ flights, teams, series, onWinner }) {
  return <div className="space-y-4">{flights.map(({ flight, matches }) => (
    <div key={flight} className="rounded-2xl bg-slate-100 p-3">
      <div className="mb-2 text-sm font-bold">Flight {flight}</div>
      <div className="space-y-3">{matches.map((match) => {
        const serie = series.find((item) => item.id === match.serieId);
        const winner = serie ? seriesWinner(serie) : null;
        const matchHasResult = Boolean(match.winnerId);
        const canShow = !winner || matchHasResult;
        if (!canShow) return null;
        return <MatchRow key={match.id} match={match} teams={teams} onWinner={(matchId, winnerId) => onWinner(match.serieId, matchId, winnerId)} />;
      })}</div>
    </div>
  ))}</div>;
}

function SeriesCard({ serie, teams, onWinner }) {
  const winner = seriesWinner(serie);
  const visibleMatches = [];
  for (const match of serie.matches) { visibleMatches.push(match); if (match.winnerId && seriesWinner({ ...serie, matches: visibleMatches })) break; }
  if (!winner && visibleMatches.length < serie.matches.length && visibleMatches.every((m) => m.winnerId)) visibleMatches.push(serie.matches[visibleMatches.length]);
  return <div className="rounded-2xl border border-slate-200 bg-white p-3"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-semibold">{serie.title}</h3><p className="text-sm text-slate-500">{teamName(teams, serie.teamAId)} vs {teamName(teams, serie.teamBId)} · först till {serie.targetWins}</p></div><div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">{seriesScore(serie, serie.teamAId)}–{seriesScore(serie, serie.teamBId)}</div></div><MatchList matches={visibleMatches} teams={teams} onWinner={(matchId, winnerId) => onWinner(serie.id, matchId, winnerId)} />{winner && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold">Vinnare: {teamName(teams, winner)}</div>}</div>;
}

function ResultRow({ rank, name }) { return <div className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold">{rank}</div><div className="font-semibold">{name}</div></div>; }
 