"use client";

import {
  BookOpen,
  CircleDollarSign,
  Info,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  drawOpeningHand,
  getGameLabel,
  stages,
  type Robot,
  type Seat,
  type Stage,
} from "@/lib/game-data";

type Outcome = "win" | "draw" | "lose";
type ModalKind = "rules" | "spec";

const chipDelta: Record<Outcome, number> = {
  win: 30,
  draw: 0,
  lose: -20,
};

const views: Array<{ seat: Seat; label: string; shortLabel: string }> = [
  { seat: "left", label: "左斜め前", shortLabel: "左" },
  { seat: "top", label: "まっすぐ", shortLabel: "正面" },
  { seat: "right", label: "右斜め前", shortLabel: "右" },
];

const seatLabel: Record<Seat, string> = {
  right: "右斜め前",
  top: "まっすぐ",
  left: "左斜め前",
};

const viewAngleClass: Record<Seat, string> = {
  left: "-translate-x-4 rotate-[-2deg]",
  top: "translate-x-0",
  right: "translate-x-4 rotate-[2deg]",
};

export default function CasinoGame() {
  const [stageId, setStageId] = useState(1);
  const [chips, setChips] = useState(stages[0].startingChips);
  const [playedRobotIds, setPlayedRobotIds] = useState<string[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<Seat>("right");
  const [modal, setModal] = useState<{ robot: Robot; kind: ModalKind } | null>(
    null,
  );

  const stage = stages.find((item) => item.id === stageId) ?? stages[0];
  const hand = useMemo(() => drawOpeningHand(stage.id), [stage.id]);
  const visibleRobot =
    stage.robots.find((robot) => robot.seat === activeSeat) ?? null;
  const selectedRobot =
    stage.robots.find((robot) => robot.id === selectedRobotId) ?? null;
  const robotChipTotal = stage.robots.reduce((sum, robot) => sum + robot.chips, 0);
  const isStageClear = chips > robotChipTotal;
  const allRobotsPlayed = playedRobotIds.length === stage.robots.length;
  const stageStatus = isStageClear
    ? "CLEAR"
    : allRobotsPlayed
      ? "RESULT"
      : "IN PLAY";

  function resetStage(nextStage: Stage) {
    setStageId(nextStage.id);
    setChips(nextStage.startingChips);
    setPlayedRobotIds([]);
    setSelectedRobotId(null);
    setActiveSeat(nextStage.robots[0]?.seat ?? "right");
    setModal(null);
  }

  function resolveRound(outcome: Outcome) {
    if (!selectedRobot || playedRobotIds.includes(selectedRobot.id)) {
      return;
    }

    setChips((current) => Math.max(0, current + chipDelta[outcome]));
    setPlayedRobotIds((current) => [...current, selectedRobot.id]);
    setSelectedRobotId(null);
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-5 lg:px-8 lg:py-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-3 sm:gap-5">
        <header className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass sm:text-sm sm:tracking-[0.28em]">
                Cacacasino Riddle
              </p>
              <h1 className="mt-1 text-xl font-black leading-tight sm:text-3xl">
                {stage.label} Stage
              </h1>
              <p className="mt-1 text-sm text-stone-300">{stage.title}</p>
            </div>
            <button
              aria-label="ステージをリセット"
              className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/14 bg-white/8 hover:bg-white/14"
              onClick={() => resetStage(stage)}
              title="リセット"
              type="button"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {stages.map((item) => (
              <button
                className={`min-h-11 rounded border px-2 py-2 text-sm font-bold transition ${
                  item.id === stage.id
                    ? "border-brass bg-brass text-stone-950"
                    : "border-white/15 bg-white/8 text-stone-100 hover:bg-white/14"
                }`}
                key={item.id}
                onClick={() => resetStage(item)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <StatusPanel
          allRobotsPlayed={allRobotsPlayed}
          chips={chips}
          isStageClear={isStageClear}
          robotChipTotal={robotChipTotal}
          stageStatus={stageStatus}
        />

        <div className="grid gap-3 lg:grid-cols-[1fr_340px] lg:gap-5">
          <section className="overflow-hidden rounded border border-white/12 bg-[#1a1714] shadow-table">
            <div className="border-b border-white/10 bg-black/24 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                Player View
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {views.map((view) => {
                  const robot = stage.robots.find((item) => item.seat === view.seat);
                  const isActive = activeSeat === view.seat;

                  return (
                    <button
                      className={`min-h-11 rounded border px-2 py-2 text-xs font-bold transition sm:text-sm ${
                        isActive
                          ? "border-brass bg-brass text-stone-950"
                          : robot
                            ? "border-white/15 bg-white/8 text-stone-100 hover:bg-white/14"
                            : "cursor-not-allowed border-white/8 bg-white/4 text-stone-500"
                      }`}
                      disabled={!robot}
                      key={view.seat}
                      onClick={() => setActiveSeat(view.seat)}
                      type="button"
                    >
                      <span className="block sm:hidden">{view.shortLabel}</span>
                      <span className="hidden sm:block">{view.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <FirstPersonTable
              activeSeat={activeSeat}
              hand={hand}
              isStageClear={isStageClear}
              onOpenModal={(robot, kind) => setModal({ robot, kind })}
              onSelectRobot={(robot) => setSelectedRobotId(robot.id)}
              playedRobotIds={playedRobotIds}
              selectedRobotId={selectedRobotId}
              visibleRobot={visibleRobot}
            />
          </section>

          <aside className="flex flex-col gap-3 sm:gap-4">
            <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
              <h2 className="text-base font-bold sm:text-lg">対戦パネル</h2>
              {selectedRobot ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded border border-brass/50 bg-brass/10 p-3">
                    <p className="text-xs text-stone-300">選択中</p>
                    <p className="font-bold">
                      {selectedRobot.name} / {getGameLabel(selectedRobot.gameType)}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-stone-300">ダミー</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="min-h-12 rounded bg-emerald-600 px-2 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                      onClick={() => resolveRound("win")}
                      type="button"
                    >
                      勝利
                    </button>
                    <button
                      className="min-h-12 rounded bg-stone-600 px-2 py-3 text-sm font-bold text-white hover:bg-stone-500"
                      onClick={() => resolveRound("draw")}
                      type="button"
                    >
                      引分
                    </button>
                    <button
                      className="min-h-12 rounded bg-red-700 px-2 py-3 text-sm font-bold text-white hover:bg-red-600"
                      onClick={() => resolveRound("lose")}
                      type="button"
                    >
                      敗北
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  視点を切り替えて、未対戦のロボットを選択してください。謎や正式な勝敗判定は後から差し替えできます。
                </p>
              )}
            </section>

            <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
              <h2 className="text-base font-bold sm:text-lg">共通ルール</h2>
              <p className="mt-3 text-sm leading-6 text-stone-300">ダミー</p>
            </section>
          </aside>
        </div>
      </section>

      {modal ? (
        <div className="fixed inset-0 z-30 grid place-items-end bg-black/70 p-3 sm:place-items-center sm:p-4">
          <section className="max-h-[86vh] w-full overflow-auto rounded border border-white/14 bg-stone-950 p-4 shadow-2xl sm:max-w-lg sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brass">
                  {modal.kind === "rules" ? "ゲームルール" : "ロボット仕様"}
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {modal.robot.name} / {getGameLabel(modal.robot.gameType)}
                </h2>
              </div>
              <button
                aria-label="閉じる"
                className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/12 bg-white/8 hover:bg-white/14"
                onClick={() => setModal(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 min-h-28 rounded border border-white/10 bg-white/6 p-4 leading-7 text-stone-200">
              {modal.kind === "rules" ? modal.robot.ruleText : modal.robot.specText}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function FirstPersonTable({
  activeSeat,
  hand,
  isStageClear,
  onOpenModal,
  onSelectRobot,
  playedRobotIds,
  selectedRobotId,
  visibleRobot,
}: {
  activeSeat: Seat;
  hand: ReturnType<typeof drawOpeningHand>;
  isStageClear: boolean;
  onOpenModal: (robot: Robot, kind: ModalKind) => void;
  onSelectRobot: (robot: Robot) => void;
  playedRobotIds: string[];
  selectedRobotId: string | null;
  visibleRobot: Robot | null;
}) {
  return (
    <div className="relative min-h-[560px] overflow-hidden bg-[#15100e] sm:min-h-[640px]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,6,0.98)_0%,rgba(25,18,15,0.92)_30%,rgba(7,111,79,0.2)_58%,rgba(5,63,47,0.95)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-44 border-b border-brass/25 bg-[radial-gradient(circle_at_50%_0%,rgba(214,168,79,0.18),transparent_58%)]" />
      <div className="absolute left-1/2 top-28 h-1 w-[110%] -translate-x-1/2 rounded-full bg-brass/35 blur-[1px]" />

      <div className="absolute left-1/2 top-20 z-20 w-[min(78%,300px)] -translate-x-1/2">
        <div className={`transition-transform duration-300 ${viewAngleClass[activeSeat]}`}>
          {visibleRobot ? (
            <RobotView
              isPlayed={playedRobotIds.includes(visibleRobot.id)}
              isSelected={selectedRobotId === visibleRobot.id}
              isStageClear={isStageClear}
              onOpenModal={(kind) => onOpenModal(visibleRobot, kind)}
              onSelect={() => onSelectRobot(visibleRobot)}
              robot={visibleRobot}
            />
          ) : (
            <div className="rounded border border-white/14 bg-black/62 p-5 text-center">
              <p className="text-sm text-stone-300">
                この方向には対戦相手がいません。
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-[-18%] bottom-[-90px] h-[390px] rounded-t-[52%] border-[16px] border-rail bg-felt shadow-inner sm:inset-x-8 sm:h-[430px] sm:border-[22px]" />
      <div className="absolute inset-x-8 bottom-[92px] h-px bg-white/20 sm:inset-x-20" />

      <div className="absolute left-1/2 top-[360px] z-10 flex -translate-x-1/2 flex-col items-center gap-2 sm:top-[390px]">
        <div className="grid h-16 w-12 place-items-center rounded border-2 border-brass bg-stone-950 shadow-lg sm:h-20 sm:w-14">
          <span className="text-[11px] font-black text-brass">DECK</span>
        </div>
        <p className="rounded bg-black/52 px-2 py-1 text-[11px] text-stone-200">
          A / J / Q / K x 4
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-brass/25 bg-black/72 px-3 pb-4 pt-3 text-center backdrop-blur-sm sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
          Player Hand
        </p>
        <div className="mt-2 flex justify-center gap-2 sm:gap-3">
          {hand.map((card) => (
            <div
              className="grid h-20 w-14 place-items-center rounded border border-brass bg-stone-50 text-3xl font-black text-casinoRed shadow sm:h-24 sm:w-16"
              key={card.id}
            >
              {card.rank}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RobotView({
  isPlayed,
  isSelected,
  isStageClear,
  onOpenModal,
  onSelect,
  robot,
}: {
  isPlayed: boolean;
  isSelected: boolean;
  isStageClear: boolean;
  onOpenModal: (kind: ModalKind) => void;
  onSelect: () => void;
  robot: Robot;
}) {
  return (
    <article
      className={`rounded border p-4 text-center shadow-2xl transition ${
        isSelected ? "border-brass bg-stone-950" : "border-white/14 bg-black/76"
      }`}
    >
      <p className="text-xs font-semibold text-brass">{seatLabel[robot.seat]}</p>
      <div className="mx-auto mt-3 grid h-20 w-20 place-items-center rounded bg-stone-800 text-2xl font-black text-brass">
        {robot.name.slice(0, 2)}
      </div>
      <h2 className="mt-3 text-xl font-black">{robot.name}</h2>
      <p className="text-sm text-stone-300">{getGameLabel(robot.gameType)}</p>
      <p className="mt-2 text-sm font-semibold">{robot.chips} chips</p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          aria-label={`${robot.name}のルール`}
          className="grid h-10 w-10 place-items-center rounded border border-white/12 bg-white/8 hover:bg-white/16"
          onClick={() => onOpenModal("rules")}
          title="ルール"
          type="button"
        >
          <BookOpen size={18} />
        </button>
        <button
          aria-label={`${robot.name}の仕様`}
          className="grid h-10 w-10 place-items-center rounded border border-white/12 bg-white/8 hover:bg-white/16"
          onClick={() => onOpenModal("spec")}
          title="仕様"
          type="button"
        >
          <Info size={18} />
        </button>
      </div>
      <button
        className={`mt-4 min-h-12 w-full rounded px-3 py-3 text-sm font-bold ${
          isPlayed
            ? "cursor-not-allowed bg-stone-700 text-stone-400"
            : "bg-casinoRed text-white hover:bg-red-700"
        }`}
        disabled={isPlayed || isStageClear}
        onClick={onSelect}
        type="button"
      >
        {isPlayed ? "対戦済み" : "対戦"}
      </button>
    </article>
  );
}

function StatusPanel({
  allRobotsPlayed,
  chips,
  isStageClear,
  robotChipTotal,
  stageStatus,
}: {
  allRobotsPlayed: boolean;
  chips: number;
  isStageClear: boolean;
  robotChipTotal: number;
  stageStatus: string;
}) {
  return (
    <section className="rounded border border-white/12 bg-black/30 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold sm:text-lg">ステータス</h2>
        <span
          className={`rounded px-2 py-1 text-xs font-black ${
            isStageClear ? "bg-emerald-500 text-stone-950" : "bg-brass text-stone-950"
          }`}
        >
          {stageStatus}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <Metric icon={<CircleDollarSign size={18} />} label="Player" value={chips} />
        <Metric icon={<Trophy size={18} />} label="Robots" value={robotChipTotal} />
      </div>
      <div className="mt-3 rounded border border-white/10 bg-white/6 p-3 text-sm leading-6 text-stone-300 sm:mt-4">
        {isStageClear
          ? "プレイヤーのチップがロボット合計を上回りました。ステージクリアです。"
          : allRobotsPlayed
            ? "全ロボットと対戦済みです。チップが足りない場合はリセットしてください。"
            : "ロボットは各ステージで一度だけ対戦できます。"}
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/6 p-3">
      <div className="flex items-center gap-2 text-stone-300">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-xs sm:tracking-[0.16em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
