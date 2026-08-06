import { describe, expect, it } from "vitest";
import { defaultRoute, parseRoute, routeToUrl } from "../src/lib/router";

function locationFor(path: string): Location {
  const url = new URL(path, "https://open1650.test");
  return {
    pathname: url.pathname,
    search: url.search,
  } as Location;
}

describe("stable reader routes", () => {
  it("parses a Psalm, version, and edition", () => {
    expect(
      parseRoute(locationFor("/psalms/023/alternate?edition=diplomatic")),
    ).toEqual({
      view: "reader",
      psalmNumber: 23,
      version: "alternate",
      edition: "diplomatic",
    });
  });

  it("rejects invalid Psalm numbers and edition names", () => {
    expect(parseRoute(locationFor("/psalms/999/primary?edition=made-up"))).toEqual(
      defaultRoute,
    );
  });

  it("round-trips a stable Psalm URL", () => {
    const route = {
      view: "reader" as const,
      psalmNumber: 100,
      version: "primary" as const,
      edition: "reading" as const,
    };
    expect(parseRoute(locationFor(routeToUrl(route)))).toEqual(route);
    expect(routeToUrl(route)).toBe("/psalms/100/primary");
  });

  it("parses and round-trips a selected tune", () => {
    const route = {
      view: "reader" as const,
      psalmNumber: 100,
      version: "primary" as const,
      edition: "reading" as const,
      tuneSlug: "tallis-canon",
    };

    expect(
      parseRoute(
        locationFor("/psalms/100/primary?tune=tallis-canon"),
      ),
    ).toEqual(route);
    expect(routeToUrl(route)).toBe(
      "/psalms/100/primary?tune=tallis-canon",
    );
    expect(parseRoute(locationFor(routeToUrl(route)))).toEqual(route);
  });

  it("ignores malformed tune query values", () => {
    expect(
      parseRoute(
        locationFor("/psalms/100/primary?tune=Tallis%20Canon"),
      ),
    ).toEqual(defaultRoute);
  });

  it("supports the three secondary pages", () => {
    expect(parseRoute(locationFor("/sources")).view).toBe("sources");
    expect(parseRoute(locationFor("/downloads")).view).toBe("downloads");
    expect(parseRoute(locationFor("/about")).view).toBe("about");
  });
});
