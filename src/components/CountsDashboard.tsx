import React, { useMemo } from "react";
import { manualCountStations } from "../data";
import { TrafficCount } from "../types";
import { Language } from "../i18n";
import { ClipboardList, MapPin, UserRound } from "lucide-react";

interface CountsDashboardProps {
  hourlyData: TrafficCount[];
  selectedHour: number;
  setSelectedHour: (h: number) => void;
  selectedJunction: string | null;
  onSelectJunction: (code: string | null) => void;
  language?: Language;
}

const splitVehicleTask = (task: string) =>
  task
    .split("،")
    .map((item) => item.trim())
    .filter(Boolean);

export const CountsDashboard: React.FC<CountsDashboardProps> = ({
  hourlyData,
  selectedJunction,
  onSelectJunction,
  language = "ar"
}) => {
  const isEn = language === "en";

  const stationVolumes = useMemo(() => {
    const totals: Record<string, number> = {};
    hourlyData.forEach((item) => {
      totals[item.junctionCode] = (totals[item.junctionCode] || 0) + item.volume;
    });
    return totals;
  }, [hourlyData]);

  const visibleStations = selectedJunction
    ? manualCountStations.filter((station) => station.code === selectedJunction)
    : manualCountStations;

  return (
    <div className="flex flex-col gap-5" id="counts-dashboard">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              {isEn ? "Manual Count Points and Staff Duties" : "تفاصيل نقاط العد والأفراد المكلفين"}
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              {isEn
                ? "Only count locations, staff codes, roles, and assigned vehicle classes are shown here."
                : "يعرض هذا القسم نقاط العد فقط، وأكواد الأفراد، ومهمة كل شخص، وتصنيفات المركبات المسؤول عنها."}
            </p>
          </div>

          {selectedJunction && (
            <button
              onClick={() => onSelectJunction(null)}
              className="bg-slate-950 border border-slate-700 text-indigo-300 hover:text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
            >
              {isEn ? "Show all count points" : "عرض كل نقاط العد"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visibleStations.map((station) => {
            const isSelected = selectedJunction === station.code;
            return (
              <article
                key={station.code}
                className={`rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? "bg-indigo-950/30 border-indigo-500/70 shadow-lg shadow-indigo-950/30"
                    : "bg-slate-950/35 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
                  <button
                    onClick={() => onSelectJunction(isSelected ? null : station.code)}
                    className="text-right cursor-pointer"
                  >
                    <h4 className="text-white font-bold text-lg flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      {station.code} - {station.label}
                    </h4>
                    <p className="text-slate-400 text-xs mt-1 font-mono">
                      E {station.x.toFixed(1)} | N {station.y.toFixed(1)}
                    </p>
                  </button>
                  <div className="text-left shrink-0">
                    <div className="text-indigo-300 text-xs font-bold">{station.peopleCount} أفراد</div>
                    <div className="text-slate-500 text-[10px] mt-1">
                      {stationVolumes[station.code]?.toLocaleString() || 0} مركبة
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {station.crew.map((person) => (
                    <div key={person.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-white font-black font-mono text-sm flex items-center gap-2">
                          <UserRound className="w-4 h-4 text-indigo-400" />
                          {person.id}
                        </span>
                        <span className="text-[10px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded px-2 py-1">
                          {person.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-1">
                        {isEn ? "Assigned vehicle classes" : "المركبات المخصصة للرصد"}
                      </div>
                      <ul className="space-y-1">
                        {splitVehicleTask(person.task).map((vehicle) => (
                          <li key={vehicle} className="flex items-start gap-2 text-xs text-slate-300 leading-5">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                            <span>{vehicle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
