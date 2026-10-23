import type { AppRoute, EditionKey, VersionKey } from "../data/types";
import { padPsalm } from "./format";

const validEditions: EditionKey[] = [
  "diplomatic",
  "normalized",
  "reading",
];
const tuneSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const defaultRoute: AppRoute = {
  view: "reader",
  psalmNumber: 100,
  version: "primary",
  edition: "reading",
};

export function parseRoute(location: Location = window.location): AppRoute {
  const segments = location.pathname.split("/").filter(Boolean);
  const search = new URLSearchParams(location.search);

  if (segments[0] === "sources") {
    return { ...defaultRoute, view: "sources" };
  }
  if (segments[0] === "downloads") {
    return { ...defaultRoute, view: "downloads" };
  }
  if (segments[0] === "about") {
    return { ...defaultRoute, view: "about" };
  }

  if (segments[0] === "psalms") {
    const psalmNumber = Number.parseInt(segments[1] ?? "1", 10);
    const version: VersionKey =
      segments[2] === "alternate" ? "alternate" : "primary";
    const requestedEdition = search.get("edition") as EditionKey | null;
    const requestedTune = search.get("tune");
    const transpose = Number(search.get("transpose") ?? 0);

    return {
      view: "reader",
      psalmNumber:
        Number.isFinite(psalmNumber) && psalmNumber >= 1 && psalmNumber <= 150
          ? psalmNumber
          : defaultRoute.psalmNumber,
      version,
      edition:
        requestedEdition && validEditions.includes(requestedEdition)
          ? requestedEdition
          : defaultRoute.edition,
      ...(requestedTune && tuneSlugPattern.test(requestedTune)
        ? { tuneSlug: requestedTune }
        : {}),
      ...(Number.isInteger(transpose) && transpose >= -12 && transpose <= 12 && transpose !== 0
        ? { transpose } : {}),
    };
  }

  return defaultRoute;
}

export function routeToUrl(route: AppRoute): string {
  if (route.view !== "reader") {
    return `/${route.view}`;
  }

  const pathname = `/psalms/${padPsalm(route.psalmNumber)}/${route.version}`;
  const search = new URLSearchParams();
  if (route.tuneSlug) search.set("tune", route.tuneSlug);
  if (route.transpose) search.set("transpose", String(route.transpose));
  return search.size ? `${pathname}?${search}` : pathname;
}
