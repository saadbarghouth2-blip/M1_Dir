import React, { useMemo } from "react";
import { directions, junctions } from "../data";
import { TrafficCount } from "../types";
import { Language, ui } from "../i18n";
import { GitBranch, MapPin, Route, UserRound } from "lucide-react";
import { getPersonColor } from "./MapWidget";

interface DirectionsDashboardProps {
  hourlyData: TrafficCount[];
  selectedDirection: number | null;
  onSelectDirection: (id: number | null) => void;
  selectedJunction: string | null;
  language?: Language;
}

export const DirectionsDashboard: React.FC<DirectionsDashboardProps> = ({
  hourlyData,
  selectedDirection,
  onSelectDirection,
  selectedJunction,
  language = "ar"
}) => {
  const isEn = language === "en";
  const t = ui[language];

  const directionStats = useMemo(() => {
    const totals: Record<number, { volume: number; speedSum: number; count: number }> = {};
    hourlyData.forEach((item) => {
      if (!totals[item.directionId]) {
        totals[item.directionId] = { volume: 0, speedSum: 0, count: 0 };
      }
      totals[item.directionId].volume += item.volume;
      totals[item.directionId].speedSum += item.speed;
      totals[item.directionId].count += 1;
    });
    return totals;
  }, [hourlyData]);

  const groupedByIntersection = useMemo(() => {
    const visibleJunctions = junctions.filter((junction) => !selectedJunction || junction.code === selectedJunction);
    const groups = new Map<string, {
      intersectionCode: string;
      observers: Array<{
        junction: typeof junctions[number];
        directions: Array<typeof directions[number] & { volume: number; speed: number; classification: string }>;
        totalVolume: number;
      }>;
      totalDirections: number;
      totalVolume: number;
    }>();

    visibleJunctions.forEach((junction) => {
      const intersectionCode = junction.code.split("-")[0];
      const observerDirections = directions
        .filter((direction) => direction.member_code === junction.code)
        .map((direction) => {
          const stats = directionStats[direction.id];
          const volume = stats?.volume || 0;
          const speed = stats?.count ? Math.round(stats.speedSum / stats.count) : 0;
          const classification =
            volume > 1500
              ? isEn ? "Heavy flow" : "تدفق كثيف"
              : volume > 800
              ? isEn ? "Medium flow" : "تدفق متوسط"
              : isEn ? "Light flow" : "تدفق خفيف";

          return { ...direction, volume, speed, classification };
        });

      if (observerDirections.length === 0) return;

      const existing = groups.get(intersectionCode) || {
        intersectionCode,
        observers: [],
        totalDirections: 0,
        totalVolume: 0
      };

      const totalVolume = observerDirections.reduce((sum, direction) => sum + direction.volume, 0);
      existing.observers.push({
        junction,
        directions: observerDirections,
        totalVolume
      });
      existing.totalDirections += observerDirections.length;
      existing.totalVolume += totalVolume;
      groups.set(intersectionCode, existing);
    });

    return Array.from(groups.values()).sort((a, b) => a.intersectionCode.localeCompare(b.intersectionCode, undefined, { numeric: true }));
  }, [directionStats, isEn, selectedJunction]);

  return (
    <div className="flex flex-col gap-5" id="directions-dashboard">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            {isEn ? "Detailed Direction Work Plan" : "تفصيل شغل الاتجاهات حسب كل تقاطع وراصد"}
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            {isEn
              ? "Each intersection is separated, then each observer code is listed with its assigned lanes/routes and traffic classification."
              : "كل تقاطع منفصل، وتحته كل كود راصد، وتحته الحارات أو المسارات التابعة له مع اتجاه الحركة والتصنيف."}
          </p>
        </div>

        <div className="space-y-4">
          {groupedByIntersection.map((group) => (
            <article key={group.intersectionCode} className="bg-slate-950/35 border border-slate-800 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
                <div>
                  <h4 className="text-white font-black text-lg">
                    {isEn ? "Intersection" : "تقاطع"} {group.intersectionCode}
                  </h4>
                  <p className="text-slate-400 text-xs mt-1">
                    {group.observers.length} {isEn ? "observer points" : "نقاط راصدين"} / {group.totalDirections} {isEn ? "routes" : "مسارات"}
                  </p>
                </div>
                <div className="text-indigo-300 text-xs font-bold">
                  {group.totalVolume.toLocaleString()} {isEn ? "vehicles" : "مركبة"}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {group.observers.map(({ junction, directions: observerDirections, totalVolume }) => {
                  const pointColor = getPersonColor(junction.code);
                  return (
                    <div key={junction.code} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h5 className="text-white font-black text-sm flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pointColor }}></span>
                            <UserRound className="w-4 h-4 text-indigo-400" />
                            {junction.code}
                          </h5>
                          <p className="text-slate-500 text-[10px] font-mono mt-1">
                            E {junction.x.toFixed(1)} | N {junction.y.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-[10px] text-slate-400">{observerDirections.length} {isEn ? "lanes" : "حارات"}</div>
                          <div className="text-[10px] text-indigo-300 font-mono">{totalVolume.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {observerDirections.map((direction, index) => {
                          const isSelected = selectedDirection === direction.id;
                          return (
                            <button
                              key={direction.id}
                              onClick={() => onSelectDirection(isSelected ? null : direction.id)}
                              className={`w-full text-right rounded-lg border p-3 transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-600/20 border-indigo-500/80"
                                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Route className="w-4 h-4" style={{ color: pointColor }} />
                                    <span className="text-white font-bold font-mono">#{direction.id}</span>
                                    <span className="text-slate-400 text-[10px]">
                                      {isEn ? "Lane" : "حارة"} {index + 1}
                                    </span>
                                    <span className="text-xs font-bold direction-ltr" style={{ color: pointColor }}>
                                      {direction.dir}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                                    <span>{isEn ? "Length" : "الطول"}: <b className="text-slate-200 font-mono">{direction.length.toFixed(1)}{t.meter}</b></span>
                                    <span>{isEn ? "Class" : "التصنيف"}: <b className="text-slate-200">{direction.classification}</b></span>
                                    <span>{isEn ? "Volume" : "الحجم"}: <b className="text-indigo-300 font-mono">{direction.volume.toLocaleString()}</b></span>
                                    <span>{isEn ? "Speed" : "السرعة"}: <b className="text-amber-300 font-mono">{direction.speed || "-"} {isEn ? "km/h" : "كم/س"}</b></span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {isSelected ? (isEn ? "Selected" : "محدد") : (isEn ? "Tap" : "اضغط")}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
