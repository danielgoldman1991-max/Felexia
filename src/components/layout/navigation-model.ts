import { isOperatorPathAllowed } from "@/lib/auth/operator-access";
import { lightSections, sections, type SidebarItem, type SidebarSection } from "./sidebar-data";

type NavigationVisibility = {
  fullAccess: boolean;
  operator: boolean;
  showWelcomeGuide: boolean;
  enabledModules?: readonly string[] | null;
};

export type NavigationLocation = {
  sectionKey?: string;
  itemHref?: string;
  section?: SidebarSection;
  item?: SidebarItem;
  isExact: boolean;
};

/** Keep the sidebar's existing plan, module, onboarding and role visibility rules. */
export function getVisibleNavigationSections({
  fullAccess,
  operator,
  showWelcomeGuide,
  enabledModules,
}: NavigationVisibility): SidebarSection[] {
  return (fullAccess ? sections : lightSections)
    .map((section) => {
      const items = section.items?.filter((item) => !operator || isOperatorPathAllowed(item.href));
      const href = operator && items?.length && !isOperatorPathAllowed(section.href) ? items[0].href : section.href;
      return operator && section.key === "settings"
        ? { ...section, label: "Mon compte", href: "/parametres/profil", items }
        : { ...section, href, items };
    })
    .filter((section) => {
      if (section.hidden) return false;
      if (operator && !isOperatorPathAllowed(section.href) && !section.items?.length) return false;
      if (section.key === "welcome") return showWelcomeGuide;
      if (!section.moduleKey) return true;
      return enabledModules?.includes(section.moduleKey) ?? false;
    });
}

function normalizedPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function matchesRequiredQuery(required: URLSearchParams, current: URLSearchParams): boolean {
  const remaining = new URLSearchParams(current);
  for (const [key, value] of required) {
    const values = remaining.getAll(key);
    const index = values.indexOf(value);
    if (index === -1) return false;
    values.splice(index, 1);
    remaining.delete(key);
    for (const remainingValue of values) remaining.append(key, remainingValue);
  }
  return true;
}

/** Resolve one location: longest path, then required query, then child over section. */
export function resolveNavigationLocation(
  visibleSections: readonly SidebarSection[],
  pathname: string,
  searchParams: URLSearchParams | string,
): NavigationLocation {
  const currentPath = normalizedPath(pathname);
  const currentQuery = new URLSearchParams(searchParams);
  let winner: { location: NavigationLocation; pathLength: number; queryCount: number; isItem: boolean } | undefined;

  function consider(section: SidebarSection, item?: SidebarItem) {
    const href = item?.href ?? section.href;
    const fragmentlessHref = href.split("#")[0];
    const queryIndex = fragmentlessHref.indexOf("?");
    const hrefPath = queryIndex === -1 ? fragmentlessHref : fragmentlessHref.slice(0, queryIndex);
    const targetPath = normalizedPath(hrefPath);
    if (currentPath !== targetPath && targetPath !== "/" && !currentPath.startsWith(`${targetPath}/`)) return;

    const requiredQuery = new URLSearchParams(queryIndex === -1 ? "" : fragmentlessHref.slice(queryIndex + 1));
    if (!matchesRequiredQuery(requiredQuery, currentQuery)) return;
    const queryCount = [...requiredQuery].length;
    const isItem = Boolean(item);
    if (winner && (targetPath.length < winner.pathLength
      || (targetPath.length === winner.pathLength && queryCount < winner.queryCount)
      || (targetPath.length === winner.pathLength && queryCount === winner.queryCount && (!isItem || winner.isItem)))) return;

    winner = {
      pathLength: targetPath.length,
      queryCount,
      isItem,
      location: {
        sectionKey: section.key,
        section,
        ...(item ? { itemHref: item.href, item } : {}),
        isExact: currentPath === targetPath,
      },
    };
  }

  for (const section of visibleSections) {
    if (section.hidden) continue;
    consider(section);
    for (const item of section.items ?? []) {
      if (!item.hidden) consider(section, item);
    }
  }

  return winner?.location ?? { isExact: false };
}
