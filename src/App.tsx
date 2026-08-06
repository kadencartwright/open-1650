import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import {
  AboutView,
  DownloadsView,
  SourcesView,
} from "./components/InfoViews";
import { PsalterNav } from "./components/PsalterNav";
import { SingAlong } from "./components/SingAlong";
import { UnarrangedPsalm } from "./components/UnarrangedPsalm";
import { findPsalm, loadPsalm } from "./data/corpus";
import {
  findCompatibleTuneSummaries,
  findDefaultSettingSummary,
  findPsalmSummaryByNumber,
  findTuneSummary,
} from "./data/library";
import {
  findSetting,
  findTune,
  loadDefaultSetting,
  loadTune,
} from "./data/music";
import { retargetSetting } from "./data/retargetSetting";
import type {
  AppRoute,
  PsalmRecord,
  PsalmSetting,
  TuneRecord,
} from "./data/types";
import { defaultRoute, parseRoute, routeToUrl } from "./lib/router";
import type { TogetherSelection } from "./sync/protocol";
import { useTogetherSession } from "./sync/useTogetherSession";

interface RouteData {
  psalm?: PsalmRecord;
  setting?: PsalmSetting;
  tune?: TuneRecord;
}

interface RouteLoadState extends RouteData {
  key: string;
  loading: boolean;
  error: string | null;
}

function routeDataKey(route: AppRoute): string {
  return `${route.psalmNumber}:${route.version}:${route.tuneSlug ?? ""}`;
}

function requestedTuneSummary(route: AppRoute, psalm: PsalmRecord) {
  if (!route.tuneSlug) return undefined;
  const summary = findTuneSummary(`ps1650.tune.${route.tuneSlug}`);
  return summary?.meter === psalm.meter.pattern ? summary : undefined;
}

function cachedRouteData(route: AppRoute): RouteData {
  const psalm = findPsalm(route.psalmNumber, route.version);
  const defaultSetting = psalm ? findSetting(psalm.id) : undefined;
  const defaultTune = defaultSetting
    ? findTune(defaultSetting.tune_id)
    : undefined;
  if (!psalm || !defaultSetting || !defaultTune) {
    return { psalm };
  }

  const requested = requestedTuneSummary(route, psalm);
  if (!requested || requested.id === defaultTune.id) {
    return { psalm, setting: defaultSetting, tune: defaultTune };
  }

  const tune = findTune(requested.id);
  return tune
    ? {
        psalm,
        tune,
        setting: retargetSetting(defaultSetting, defaultTune, tune),
      }
    : { psalm };
}

function cachedRouteIsComplete(route: AppRoute, data: RouteData): boolean {
  if (!data.psalm) {
    return !findPsalmSummaryByNumber(route.psalmNumber, route.version);
  }
  const settingSummary = findDefaultSettingSummary(data.psalm.id);
  return settingSummary
    ? Boolean(data.setting && data.tune)
    : true;
}

async function loadRouteData(route: AppRoute): Promise<RouteData> {
  const psalm = await loadPsalm(route.psalmNumber, route.version);
  if (!psalm) return {};

  const setting = await loadDefaultSetting(psalm.id);
  if (!setting) return { psalm };

  const defaultTune = await loadTune(setting.tune_id);
  if (!defaultTune) return { psalm, setting };

  const requested = requestedTuneSummary(route, psalm);
  if (!requested || requested.id === defaultTune.id) {
    return { psalm, setting, tune: defaultTune };
  }

  const tune = await loadTune(requested.id);
  return tune
    ? {
        psalm,
        tune,
        setting: retargetSetting(setting, defaultTune, tune),
      }
    : { psalm, setting, tune: defaultTune };
}

function writeRoute(route: AppRoute, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](
    {},
    "",
    routeToUrl(route),
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [routeLoad, setRouteLoad] = useState<RouteLoadState>(() => {
    const initialRoute = parseRoute();
    const initial = cachedRouteData(initialRoute);
    return {
      key: routeDataKey(initialRoute),
      ...initial,
      loading: !cachedRouteIsComplete(initialRoute, initial),
      error: null,
    };
  });

  const activeKey = routeDataKey(route);
  const routeLoadMatches = routeLoad.key === activeKey;
  const cached = routeLoadMatches ? routeLoad : cachedRouteData(route);
  const psalm = cached.psalm;
  const setting = cached.setting;
  const tune = cached.tune;
  const loading = routeLoadMatches
    ? routeLoad.loading
    : !cachedRouteIsComplete(route, cached);
  const togetherSelection = useMemo<TogetherSelection | null>(
    () =>
      psalm && setting && tune
        ? {
            psalmNumber: psalm.psalm_number,
            version: psalm.version,
            tuneSlug: tune.id.replace(/^ps1650\.tune\./, ""),
            performanceId: setting.id,
          }
        : null,
    [psalm, setting, tune],
  );
  const applyTogetherSelection = useCallback(
    (nextSelection: TogetherSelection) => {
      const nextRoute: AppRoute = {
        view: "reader",
        psalmNumber: nextSelection.psalmNumber,
        version: nextSelection.version,
        edition: "reading",
        tuneSlug: nextSelection.tuneSlug,
      };
      setRoute(nextRoute);
      writeRoute(nextRoute, true);
      setLibraryOpen(false);
    },
    [],
  );
  const together = useTogetherSession({
    selection: togetherSelection,
    onRemoteSelection: applyTogetherSelection,
  });

  useEffect(() => {
    if (window.location.pathname === "/") {
      writeRoute(defaultRoute, true);
    }

    const onPopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const key = routeDataKey(route);
    const initial = cachedRouteData(route);
    if (cachedRouteIsComplete(route, initial)) {
      setRouteLoad({
        key,
        ...initial,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setRouteLoad({
      key,
      ...initial,
      loading: true,
      error: null,
    });
    void loadRouteData(route)
      .then((data) => {
        if (!cancelled) {
          setRouteLoad({
            key,
            ...data,
            loading: false,
            error: null,
          });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setRouteLoad({
            key,
            ...initial,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "The Psalm could not be loaded.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [route.psalmNumber, route.tuneSlug, route.version]);

  const navigate = (nextRoute: AppRoute, options?: { replace?: boolean }) => {
    if (together.snapshot.mode === "guest") return;
    setRoute(nextRoute);
    writeRoute(nextRoute, options?.replace);
    setLibraryOpen(false);
  };

  const navigateView = (view: AppRoute["view"]) => {
    navigate({ ...route, view });
  };

  const navigatePsalm = (psalmNumber: number) => {
    navigate({
      view: "reader",
      psalmNumber,
      version: "primary",
      edition: "reading",
    });
  };

  const selectTune = (tuneId: string) => {
    if (!psalm || together.snapshot.mode === "guest") return;
    const selected = findTuneSummary(tuneId);
    if (!selected || selected.meter !== psalm.meter.pattern) return;

    const defaultTuneId = findDefaultSettingSummary(psalm.id)?.tune_id;
    navigate(
      {
        ...route,
        view: "reader",
        tuneSlug:
          tuneId === defaultTuneId
            ? undefined
            : tuneId.replace(/^ps1650\.tune\./, ""),
      },
      { replace: true },
    );
  };

  const readerMode = route.view === "reader";

  return (
    <div className="flex h-full min-w-0 flex-col font-sans text-[#26251f] selection:bg-[#7f352d] selection:text-white [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-[#7f352d] motion-reduce:[&_*]:scroll-auto motion-reduce:[&_*]:duration-[0.01ms] print:h-auto">
      <Header
        route={route}
        onNavigate={navigateView}
        onOpenLibrary={() => {
          if (together.snapshot.mode !== "guest") setLibraryOpen(true);
        }}
      />

      <div
        className="grid min-h-0 min-w-0 flex-1 grid-cols-[254px_minmax(0,1fr)] overflow-hidden max-[1240px]:grid-cols-[230px_minmax(0,1fr)] max-[980px]:block max-[980px]:overflow-y-auto print:block print:overflow-visible"
        data-reader={readerMode}
      >
        <PsalterNav
          selectedPsalm={route.psalmNumber}
          open={libraryOpen}
          onSelect={navigatePsalm}
          onClose={() => setLibraryOpen(false)}
        />

        {readerMode && loading && (
          <main
            id="main-content"
            className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] [background:radial-gradient(circle_at_50%_-10%,rgb(167_136_86_/_11%),transparent_32%),linear-gradient(90deg,rgb(215_205_187_/_8%)_1px,transparent_1px)_0_0/41px_41px,#fbfaf6] max-[980px]:overflow-visible print:h-auto print:overflow-visible"
            tabIndex={-1}
          >
            <section
              className="grid min-h-full place-items-center p-[42px] text-center max-[430px]:p-[22px]"
              aria-live="polite"
            >
              <p>Loading Psalm {route.psalmNumber}…</p>
            </section>
          </main>
        )}

        {readerMode && !loading && psalm && setting && tune && (
          <SingAlong
            key={setting.id}
            psalm={psalm}
            tune={tune}
            setting={setting}
            compatibleTunes={findCompatibleTuneSummaries(
              psalm.meter.pattern,
            )}
            together={together}
            togetherSelection={togetherSelection!}
            onSelectTune={selectTune}
            onViewSources={() => navigateView("sources")}
          />
        )}

        {readerMode && !loading && (!psalm || !setting || !tune) && (
          <UnarrangedPsalm
            number={route.psalmNumber}
            onChoosePsalm={() => setLibraryOpen(true)}
          />
        )}

        {!readerMode && loading && (
          <main
            id="main-content"
            className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] [background:radial-gradient(circle_at_90%_3%,rgb(127_53_45_/_7%),transparent_25%),#fbfaf6] max-[980px]:overflow-visible"
            tabIndex={-1}
          >
            <article
              className="mx-auto w-full max-w-[1120px] px-[66px] pt-[66px] pb-[100px] max-[1240px]:px-11 max-[720px]:px-[21px] max-[720px]:pt-[38px] max-[720px]:pb-[75px]"
              aria-live="polite"
            >
              <p>Loading…</p>
            </article>
          </main>
        )}

        {!loading && route.view === "sources" && psalm && (
          <SourcesView
            psalm={psalm}
            tune={tune}
            edition="reading"
            onRead={() => navigate({ ...route, view: "reader" })}
          />
        )}
        {!loading && route.view === "downloads" && psalm && (
          <DownloadsView
            psalm={psalm}
            edition="reading"
            onRead={() => navigate({ ...route, view: "reader" })}
          />
        )}
        {!loading && route.view === "about" && psalm && (
          <AboutView
            psalm={psalm}
            edition="reading"
            onRead={() => navigate({ ...route, view: "reader" })}
          />
        )}

        {routeLoadMatches && routeLoad.error && (
          <p
            className="m-0 border-t border-white/8 bg-[rgb(127_53_45_/_70%)] px-[18px] py-2 text-[9px] text-[#ffe9e6]"
            role="alert"
          >
            {routeLoad.error}
          </p>
        )}
      </div>
    </div>
  );
}
