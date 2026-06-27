import { useEffect, useState, useMemo } from "react";
import { TrafficCount, VehicleClass } from "./types";
import { countTrafficData, trafficData } from "./data";
import { MapWidget } from "./components/MapWidget";
import { CountsDashboard } from "./components/CountsDashboard";
import { DirectionsDashboard } from "./components/DirectionsDashboard";
import { SyncHub } from "./components/SyncHub";
import { Language, ui } from "./i18n";
import {
  Activity,
  Compass,
  FileText,
  Clock,
  MapPin,
  TrendingUp,
  Cpu,
  Brain,
  Layers,
  HelpCircle
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"COUNTS" | "DIRECTIONS">("COUNTS");
  const [language, setLanguage] = useState<Language>("ar");
  const t = ui[language];
  
  // Interactive filters
  const [selectedJunction, setSelectedJunction] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [selectedHour, setSelectedHour] = useState<number>(8); // default to morning peak 8:00 AM

  useEffect(() => {
    setSelectedJunction(null);
    setSelectedDirection(null);
  }, [activeTab]);

  const activeTrafficData = activeTab === "COUNTS" ? countTrafficData : trafficData;

  // Filter active traffic data based on selected station/junction, direction, and/or hour
  const filteredTrafficData = useMemo(() => {
    return activeTrafficData.filter((item) => {
      if (selectedJunction && item.junctionCode !== selectedJunction) return false;
      if (activeTab === "DIRECTIONS" && selectedDirection && item.directionId !== selectedDirection) return false;
      return true;
    });
  }, [activeTrafficData, activeTab, selectedJunction, selectedDirection]);

  // Specific data for the active hour selected via the simulation slider
  const hourlyFilteredData = useMemo(() => {
    return filteredTrafficData.filter((item) => item.hour === selectedHour);
  }, [filteredTrafficData, selectedHour]);

  // Compute stats for sync payload
  const totalVolume = useMemo(() => {
    return filteredTrafficData.reduce((sum, d) => sum + d.volume, 0);
  }, [filteredTrafficData]);

  const { peakHour, peakVolume } = useMemo(() => {
    const hourlyTotals = Array(24).fill(0);
    filteredTrafficData.forEach((d) => {
      hourlyTotals[d.hour] += d.volume;
    });
    let maxVol = 0;
    let maxHour = 0;
    hourlyTotals.forEach((vol, hr) => {
      if (vol > maxVol) {
        maxVol = vol;
        maxHour = hr;
      }
    });
    return { peakHour: maxHour, peakVolume: maxVol };
  }, [filteredTrafficData]);

  // AI Transportation Copilot Assistant Insight Generator
  const aiReportInsights = useMemo(() => {
    // Generate intelligent diagnostics dynamically based on filtered stats
    const totalVol = filteredTrafficData.reduce((sum, d) => sum + d.volume, 0);
    const hourlyVol = hourlyFilteredData.reduce((sum, d) => sum + d.volume, 0);
    
    let diagnosis = "";
    let recommendations: string[] = [];
    
    if (selectedJunction) {
      diagnosis = activeTab === "COUNTS"
        ? language === "ar" ? `محطة العد المحددة ${selectedJunction} ترصد تدفقات تراكمية تبلغ ${totalVol.toLocaleString()} مركبة يومياً.` : `Selected count station ${selectedJunction} records ${totalVol.toLocaleString()} vehicles per day.`
        : language === "ar" ? `التقاطع المحدد ${selectedJunction} يشهد تدفقات تراكمية تبلغ ${totalVol.toLocaleString()} مركبة يومياً.` : `Selected junction ${selectedJunction} records ${totalVol.toLocaleString()} vehicles per day.`;
      if (activeTab === "DIRECTIONS" && (selectedJunction === "J4-1" || selectedJunction === "J4-3" || selectedJunction === "J8-1")) {
        diagnosis += language === "ar" ? " يمثل هذا التقاطع شرياناً رئيسياً وحيوياً ذا معدلات إشغال عالية." : " This location is a critical movement corridor with high occupancy levels.";
        recommendations = language === "ar"
          ? ["تعديل جدولة الإشارة الضوئية لإعطاء أولوية زمنية أطول للمحاور ذات التدفق المرتفع.", "توفير حارات انعطاف إضافية لتجنب حدوث ارتداد مروري خلفي.", "تفعيل نظام الاستشعار الذكي للتدفقات المرورية لتقليل التأخير الزمني غير الضروري."]
          : ["Adjust signal timing to prioritize high-flow corridors.", "Provide additional turning lanes to reduce queue spillback.", "Enable smart traffic detection to reduce unnecessary delay."];
      } else {
        diagnosis += language === "ar" ? " التدفقات عند هذا التقاطع معتدلة وضمن السعات التصميمية المقبولة." : " Flow at this location is moderate and within acceptable design capacity.";
        recommendations = language === "ar"
          ? ["الاستمرار في المراقبة الدورية عبر أجهزة الكشف المروري الذاتية.", "تنفيذ عمليات صيانة روتينية للعلامات الأرضية واللوحات الإرشادية.", "الحفاظ على برنامج التوقيت الحالي لعدم وجود اختناقات حرجة."]
          : ["Continue periodic monitoring using traffic detectors.", "Perform routine maintenance for markings and guide signs.", "Keep the current timing plan because no critical bottleneck is detected."];
      }
    } else if (selectedDirection) {
      diagnosis = language === "ar" ? `المسار المحدد يسجل تدفقاً تراكمياً يومياً يبلغ ${totalVol.toLocaleString()} مركبة بمتوسط سرعة تشغيلية مقبولة.` : `The selected route records ${totalVol.toLocaleString()} vehicles per day with acceptable operating speed.`;
      recommendations = language === "ar"
        ? ["مراقبة الالتزام بالسرعات المحددة لضمان سلامة سالكي الطريق.", "دراسة تأثير المسار على نقاط الدمج في نهايته.", "متابعة مستويات الضوضاء والانبعاثات البيئية المحيطة بالمحور."]
        : ["Monitor compliance with posted speeds.", "Study the route impact on downstream merge points.", "Track noise and emission levels around the corridor."];
    } else {
      diagnosis = language === "ar" ? `الشبكة المرورية الكاملة ترصد تدفق ${totalVol.toLocaleString()} مركبة على مدار اليوم. نقاط الاتجاه J8-1 و J4-3 و J4-1 تسجل أعلى مستويات تدفق مروري وحجم إشغال في الشبكة ككل.` : `The full traffic network records ${totalVol.toLocaleString()} vehicles across the day. Direction points J8-1, J4-3, and J4-1 show the highest flow and occupancy levels.`;
      recommendations = language === "ar"
        ? ["إطلاق خطة شاملة لتحسين الممرات الخضراء والموجات الخضراء للإشارات المرورية المتتالية.", "توجيه جزء من الحركة الثقيلة إلى المحاور الفرعية في أوقات ذروة المدارس والموظفين.", "استخدام لوحات الرسائل المتغيرة الإرشادية لتوجيه السائقين لحظياً."]
        : ["Improve green-wave coordination across consecutive signals.", "Redirect part of heavy traffic to secondary corridors during peak periods.", "Use variable message signs to guide drivers in real time."];
    }

    return { diagnosis, recommendations, hourlyVol };
  }, [activeTab, selectedJunction, selectedDirection, filteredTrafficData, hourlyFilteredData, language]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Upper Glowing Control Bar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-extrabold text-xl tracking-tight">{t.title}</h1>
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {t.badge}
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Tab Selection Switch */}
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("COUNTS")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "COUNTS"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{t.countsTab}</span>
            </button>
            <button
              onClick={() => setActiveTab("DIRECTIONS")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "DIRECTIONS"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{t.directionsTab}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-indigo-300 hover:text-white hover:border-indigo-500/60 text-xs font-bold transition-colors cursor-pointer"
          >
            {t.languageLabel}
          </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Interactive Map Block */}
        <div className="w-full">
          <MapWidget
            activeTab={activeTab}
            selectedJunction={selectedJunction}
            selectedDirection={selectedDirection}
            onSelectJunction={(code) => {
              setSelectedJunction(code);
              setSelectedDirection(null); // Clear path selection when clicking junction
            }}
            onSelectDirection={(id) => {
              setSelectedDirection(id);
              setSelectedJunction(null); // Clear junction selection when clicking path
            }}
            hourlyData={hourlyFilteredData}
            language={language}
          />
        </div>

        {/* Dynamic Context Notification Ribbon */}
        {(selectedJunction || selectedDirection) && (
          <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-3 flex justify-between items-center text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400 animate-bounce" />
              <span>
                {t.activeFilter}{" "}
                <strong>
                  {selectedJunction
                    ? activeTab === "COUNTS" ? `${t.countsStation} ${selectedJunction}` : `${t.directionJunction} ${selectedJunction}`
                    : `${t.movementRoute} #${selectedDirection}`}
                </strong>
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedJunction(null);
                setSelectedDirection(null);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
            >
              {t.showFullNetwork}
            </button>
          </div>
        )}

        {/* Dashboard Panels */}
        <div className="w-full">
          {activeTab === "COUNTS" ? (
            <CountsDashboard
              hourlyData={filteredTrafficData}
              selectedHour={selectedHour}
              setSelectedHour={setSelectedHour}
              selectedJunction={selectedJunction}
              onSelectJunction={setSelectedJunction}
              language={language}
            />
          ) : (
            <DirectionsDashboard
              hourlyData={filteredTrafficData}
              selectedDirection={selectedDirection}
              onSelectDirection={setSelectedDirection}
              selectedJunction={selectedJunction}
              language={language}
            />
          )}
        </div>

        {/* Connection & Sync Hub */}
        <SyncHub
          selectedJunction={selectedJunction}
          selectedDirection={selectedDirection}
          selectedHour={selectedHour}
          hourlyData={filteredTrafficData}
          totalVolume={totalVolume}
          peakHour={peakHour}
          peakVolume={peakVolume}
          language={language}
        />

        {/* Real-time AI Analytics Drawer */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{t.aiTitle}</h3>
              <p className="text-slate-400 text-xs">{t.aiSubtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-800 pt-5">
            {/* Diagnosis Panel */}
            <div className="md:col-span-1">
              <span className="text-indigo-400 text-xs font-bold block mb-1">{t.diagnosisTitle}</span>
              <p className="text-slate-300 text-sm leading-relaxed">
                {aiReportInsights.diagnosis}
              </p>
              <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[10px] block">{t.simulatedHourFlow}</span>
                  <span className="text-white text-lg font-bold font-mono">
                    {aiReportInsights.hourlyVol.toLocaleString()}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-slate-500 text-[10px] block">{t.densityGrade}</span>
                  <span className="text-indigo-400 text-xs font-bold">
                    {aiReportInsights.hourlyVol > 1200 ? t.congested : t.normalFlow}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="md:col-span-2">
              <span className="text-indigo-400 text-xs font-bold block mb-2">{t.recommendationsTitle}</span>
              <div className="space-y-2.5">
                {aiReportInsights.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-slate-300 text-sm leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p className="max-w-7xl mx-auto px-6">
          © {new Date().getFullYear()} {t.footer}
        </p>
      </footer>
    </div>
  );
}
